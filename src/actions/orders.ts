"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import { deleteAttachment, uploadOrderAttachment } from "@/lib/object-storage";
import {
  customerOrderSchema,
  firstError,
  nextOrderNo,
  parseOrderItems,
  supplierOrderSchema,
  values,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

const customerOrderKeys = ["customerId", "locationId", "customerContractId", "orderDate", "status", "remark"];
const supplierOrderKeys = ["supplierId", "supplierContractId", "orderDate", "status", "remark"];
const orderUpdateKeys = ["orderDate", "status", "remark"];

function isRedirect(error: unknown) {
  return (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ?? false;
}

function databaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "订单编号已存在。";
  return "保存失败，请稍后重试。";
}

function attachmentError(error: unknown) {
  return error instanceof Error && error.message.startsWith("附件") ? error.message : databaseError(error);
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// 客户订单与供应商订单共用同一当日序列，单号全局唯一。
async function nextOrderNumber() {
  const [customerNos, supplierNos] = await Promise.all([
    prisma.customerOrder.findMany({ select: { orderNo: true } }),
    prisma.supplierOrder.findMany({ select: { orderNo: true } }),
  ]);
  return nextOrderNo(new Date(), [...customerNos, ...supplierNos].map((row) => row.orderNo));
}

async function verifyCustomerRefs(input: { customerId: string; locationId: string; customerContractId: string }) {
  const [location, contract] = await Promise.all([
    prisma.location.findFirst({ where: { id: input.locationId, customerId: input.customerId }, select: { id: true } }),
    prisma.customerFrameworkContract.findFirst({ where: { id: input.customerContractId, customers: { some: { id: input.customerId } } }, select: { id: true } }),
  ]);
  if (!location) return "部署地点不属于所选客户，请重新选择。";
  if (!contract) return "所选客户框架合同未关联该客户，请重新选择。";
  return null;
}

async function verifySupplierRefs(input: { supplierId: string; supplierContractId: string }) {
  const contract = await prisma.supplierFrameworkContract.findFirst({ where: { id: input.supplierContractId, supplierId: input.supplierId }, select: { id: true } });
  if (!contract) return "所选供应商框架合同不属于该供应商，请重新选择。";
  return null;
}

function attachmentFrom(formData: FormData) {
  const file = formData.get("attachment");
  return file instanceof File && file.size ? file : null;
}

export async function createCustomerOrder(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = customerOrderSchema.safeParse(values(formData, customerOrderKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const items = parseOrderItems(formData);
  if (!items.ok) return { error: items.error };
  const refError = await verifyCustomerRefs(parsed.data);
  if (refError) return { error: refError };
  const packageIds = items.items.map((item) => item.packageId);
  const applicableCount = await prisma.customerPackage.count({
    where: { id: { in: packageIds }, OR: [{ customerId: null }, { customerId: parsed.data.customerId }] },
  });
  if (applicableCount !== new Set(packageIds).size) return { error: "明细包含不存在或不适用于该客户的套餐。" };

  let attachmentUrl: string | null = null;
  try {
    const file = attachmentFrom(formData);
    if (file) attachmentUrl = await uploadOrderAttachment(file, "customer");
  } catch (error) {
    return { error: attachmentError(error) };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const item = await prisma.customerOrder.create({
        data: {
          ...parsed.data,
          orderNo: await nextOrderNumber(),
          orderAttachmentUrl: attachmentUrl,
          items: {
            create: items.items.map((entry) => ({
              customerPackageId: entry.packageId,
              quantity: entry.quantity,
              plannedEntryDate: entry.plannedEntryDate,
              remark: entry.remark,
            })),
          },
        },
      });
      revalidatePath("/customer-orders");
      redirect(`/customer-orders/${item.id}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      // 并发下单撞唯一编号时，按最新当日序号重新取号重试。
      if (isUniqueConflict(error) && attempt < 2) continue;
      await deleteAttachment(attachmentUrl);
      return { error: attachmentError(error) };
    }
  }
  await deleteAttachment(attachmentUrl);
  return { error: "保存失败，请稍后重试。" };
}

export async function updateCustomerOrder(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = customerOrderSchema.pick({ orderDate: true, status: true, remark: true }).safeParse(values(formData, orderUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const items = parseOrderItems(formData);
  if (!items.ok) return { error: items.error };
  const existing = await prisma.customerOrder.findUniqueOrThrow({ where: { id }, select: { customerId: true, orderAttachmentUrl: true } });
  const packageIds = items.items.map((item) => item.packageId);
  const applicableCount = await prisma.customerPackage.count({
    where: { id: { in: packageIds }, OR: [{ customerId: null }, { customerId: existing.customerId }] },
  });
  if (applicableCount !== new Set(packageIds).size) return { error: "明细包含不存在或不适用于该客户的套餐。" };

  let newUrl: string | null = null;
  try {
    const file = attachmentFrom(formData);
    if (file) newUrl = await uploadOrderAttachment(file, "customer");
    // 明细整体替换：先删后建，与表头更新同事务。
    await prisma.$transaction([
      prisma.customerOrderItem.deleteMany({ where: { customerOrderId: id } }),
      prisma.customerOrder.update({ where: { id }, data: { ...parsed.data, orderAttachmentUrl: newUrl ?? existing.orderAttachmentUrl } }),
      ...items.items.map((entry) =>
        prisma.customerOrderItem.create({
          data: { customerOrderId: id, customerPackageId: entry.packageId, quantity: entry.quantity, plannedEntryDate: entry.plannedEntryDate, remark: entry.remark },
        }),
      ),
    ]);
    if (newUrl) await deleteAttachment(existing.orderAttachmentUrl);
    revalidatePath("/customer-orders");
    revalidatePath(`/customer-orders/${id}`);
    redirect(`/customer-orders/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await deleteAttachment(newUrl);
    return { error: attachmentError(error) };
  }
}

export async function deleteCustomerOrder(id: string) {
  await requireAdmin();
  const item = await prisma.customerOrder.delete({ where: { id } });
  await deleteAttachment(item.orderAttachmentUrl);
  revalidatePath("/customer-orders");
  redirect("/customer-orders");
}

export async function createSupplierOrder(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = supplierOrderSchema.safeParse(values(formData, supplierOrderKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const items = parseOrderItems(formData);
  if (!items.ok) return { error: items.error };
  const refError = await verifySupplierRefs(parsed.data);
  if (refError) return { error: refError };
  const packageIds = items.items.map((item) => item.packageId);
  const applicableCount = await prisma.supplierPackage.count({ where: { id: { in: packageIds }, supplierId: parsed.data.supplierId } });
  if (applicableCount !== new Set(packageIds).size) return { error: "明细包含不存在或不属于该供应商的套餐。" };

  let attachmentUrl: string | null = null;
  try {
    const file = attachmentFrom(formData);
    if (file) attachmentUrl = await uploadOrderAttachment(file, "supplier");
  } catch (error) {
    return { error: attachmentError(error) };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const item = await prisma.supplierOrder.create({
        data: {
          ...parsed.data,
          orderNo: await nextOrderNumber(),
          orderAttachmentUrl: attachmentUrl,
          items: {
            create: items.items.map((entry) => ({
              supplierPackageId: entry.packageId,
              quantity: entry.quantity,
              plannedEntryDate: entry.plannedEntryDate,
              remark: entry.remark,
            })),
          },
        },
      });
      revalidatePath("/supplier-orders");
      redirect(`/supplier-orders/${item.id}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      // 并发下单撞唯一编号时，按最新当日序号重新取号重试。
      if (isUniqueConflict(error) && attempt < 2) continue;
      await deleteAttachment(attachmentUrl);
      return { error: attachmentError(error) };
    }
  }
  await deleteAttachment(attachmentUrl);
  return { error: "保存失败，请稍后重试。" };
}

export async function updateSupplierOrder(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = supplierOrderSchema.pick({ orderDate: true, status: true, remark: true }).safeParse(values(formData, orderUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const items = parseOrderItems(formData);
  if (!items.ok) return { error: items.error };
  const existing = await prisma.supplierOrder.findUniqueOrThrow({ where: { id }, select: { supplierId: true, orderAttachmentUrl: true } });
  const packageIds = items.items.map((item) => item.packageId);
  const applicableCount = await prisma.supplierPackage.count({ where: { id: { in: packageIds }, supplierId: existing.supplierId } });
  if (applicableCount !== new Set(packageIds).size) return { error: "明细包含不存在或不属于该供应商的套餐。" };

  let newUrl: string | null = null;
  try {
    const file = attachmentFrom(formData);
    if (file) newUrl = await uploadOrderAttachment(file, "supplier");
    // 明细整体替换：先删后建，与表头更新同事务。
    await prisma.$transaction([
      prisma.supplierOrderItem.deleteMany({ where: { supplierOrderId: id } }),
      prisma.supplierOrder.update({ where: { id }, data: { ...parsed.data, orderAttachmentUrl: newUrl ?? existing.orderAttachmentUrl } }),
      ...items.items.map((entry) =>
        prisma.supplierOrderItem.create({
          data: { supplierOrderId: id, supplierPackageId: entry.packageId, quantity: entry.quantity, plannedEntryDate: entry.plannedEntryDate, remark: entry.remark },
        }),
      ),
    ]);
    if (newUrl) await deleteAttachment(existing.orderAttachmentUrl);
    revalidatePath("/supplier-orders");
    revalidatePath(`/supplier-orders/${id}`);
    redirect(`/supplier-orders/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await deleteAttachment(newUrl);
    return { error: attachmentError(error) };
  }
}

export async function deleteSupplierOrder(id: string) {
  await requireAdmin();
  const item = await prisma.supplierOrder.delete({ where: { id } });
  await deleteAttachment(item.orderAttachmentUrl);
  revalidatePath("/supplier-orders");
  redirect("/supplier-orders");
}
