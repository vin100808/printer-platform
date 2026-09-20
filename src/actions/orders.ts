"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import { deleteAttachment, uploadContractAttachment, uploadOrderAttachment } from "@/lib/object-storage";
import {
  computeDepositAmount,
  customerOrderSchema,
  defaultEndDate,
  firstError,
  nextOrderNo,
  orderUpdateSchema,
  parseOrderItems,
  supplierOrderSchema,
  values,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";

const customerOrderKeys = ["customerId", "supplierId", "installationAddress", "startDate", "endDate", "billingCycle", "orderDate", "status", "depositReceivedDate", "remark"];
const supplierOrderKeys = ["supplierId", "supplierContractId", "orderDate", "status", "remark"];
const orderUpdateKeys = ["supplierId", "installationAddress", "startDate", "endDate", "billingCycle", "orderDate", "status", "depositReceivedDate", "remark"];

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

async function verifySupplierRefs(input: { supplierId: string; supplierContractId: string }) {
  const contract = await prisma.supplierFrameworkContract.findFirst({ where: { id: input.supplierContractId, supplierId: input.supplierId }, select: { id: true } });
  if (!contract) return "所选供应商框架合同不属于该供应商，请重新选择。";
  return null;
}

function attachmentFrom(formData: FormData, name = "attachment") {
  const file = formData.get(name);
  return file instanceof File && file.size ? file : null;
}

type DeployedOldItem = {
  customerPackageId?: string;
  supplierPackageId?: string;
  customerPackage?: { packageName: string };
  supplierPackage?: { packageName: string };
  printers: { id: string }[];
};

// 数量守卫：按套餐汇总已部署台数（运行中打印机），修改后的明细总数量不得低于已部署台数。
async function verifyDeployedGuard(oldItemsQuery: Promise<DeployedOldItem[]>, submitted: { packageId: string; quantity: number }[]) {
  const oldItems = await oldItemsQuery;
  const submittedByPackage = new Map<string, number>();
  for (const item of submitted) submittedByPackage.set(item.packageId, (submittedByPackage.get(item.packageId) ?? 0) + item.quantity);
  for (const old of oldItems) {
    const deployed = old.printers.length;
    if (!deployed) continue;
    const packageId = old.customerPackageId ?? old.supplierPackageId ?? "";
    const packageName = old.customerPackage?.packageName ?? old.supplierPackage?.packageName ?? "";
    if ((submittedByPackage.get(packageId) ?? 0) < deployed) {
      return `套餐「${packageName}」已部署 ${deployed} 台，修改后的总数量不能低于已部署台数。`;
    }
  }
  return null;
}

export async function createCustomerOrder(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  // 下单日期服务端取当天，不接受表单值。
  const today = new Date();
  const raw = values(formData, customerOrderKeys);
  raw.orderDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const parsed = customerOrderSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const items = parseOrderItems(formData);
  if (!items.ok) return { error: items.error };
  const supplier = await prisma.supplier.findFirst({ where: { id: parsed.data.supplierId }, select: { id: true } });
  if (!supplier) return { error: "所选供应商不存在" };
  const packageIds = items.items.map((item) => item.packageId);
  const applicableCount = await prisma.customerPackage.count({
    where: { id: { in: packageIds }, OR: [{ customerId: null }, { customerId: parsed.data.customerId }] },
  });
  if (applicableCount !== new Set(packageIds).size) return { error: "明细包含不存在或不适用于该客户的套餐。" };

  let attachmentUrl: string | null = null;
  let contractUrl: string | null = null;
  try {
    const file = attachmentFrom(formData);
    if (file) attachmentUrl = await uploadOrderAttachment(file, "customer");
    const contractFile = attachmentFrom(formData, "contractAttachment");
    if (contractFile) contractUrl = await uploadContractAttachment(contractFile, "customer");
  } catch (error) {
    await Promise.all([deleteAttachment(attachmentUrl), deleteAttachment(contractUrl)]);
    return { error: attachmentError(error) };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const item = await prisma.customerOrder.create({
        data: {
          customerId: parsed.data.customerId,
          supplierId: parsed.data.supplierId,
          installationAddress: parsed.data.installationAddress,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate ?? defaultEndDate(parsed.data.startDate),
          billingCycle: parsed.data.billingCycle,
          orderDate: today,
          status: parsed.data.status,
          depositReceivedDate: parsed.data.depositReceivedDate,
          remark: parsed.data.remark,
          depositAmount: computeDepositAmount(items.items.reduce((sum, entry) => sum + entry.quantity, 0)),
          orderNo: await nextOrderNumber(),
          orderAttachmentUrl: attachmentUrl,
          contractAttachmentUrl: contractUrl,
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
      revalidatePath("/orders");
      redirect(`/orders/${item.id}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      // 并发下单撞唯一编号时，按最新当日序号重新取号重试。
      if (isUniqueConflict(error) && attempt < 2) continue;
      await Promise.all([deleteAttachment(attachmentUrl), deleteAttachment(contractUrl)]);
      return { error: attachmentError(error) };
    }
  }
  await Promise.all([deleteAttachment(attachmentUrl), deleteAttachment(contractUrl)]);
  return { error: "保存失败，请稍后重试。" };
}

export async function updateCustomerOrder(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = orderUpdateSchema.safeParse(values(formData, orderUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const items = parseOrderItems(formData);
  if (!items.ok) return { error: items.error };
  const [existing, existingItems] = await Promise.all([
    prisma.customerOrder.findUniqueOrThrow({ where: { id }, select: { customerId: true, orderAttachmentUrl: true, contractAttachmentUrl: true } }),
    prisma.customerOrderItem.findMany({
      where: { customerOrderId: id },
      include: { printers: { select: { id: true, status: true } }, customerPackage: { select: { packageName: true } } },
    }),
  ]);
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const submittedIds = new Set<string>();
  for (const entry of items.items) {
    if (!entry.itemId) continue;
    const old = existingById.get(entry.itemId);
    // a) 带 itemId 的行必须属于本订单
    if (!old) return { error: "明细数据已过期，请刷新页面重试" };
    submittedIds.add(entry.itemId);
    // b) 已有打印机记录的行不能更换套餐
    if (old.customerPackageId !== entry.packageId && old.printers.length > 0) {
      return { error: `套餐「${old.customerPackage.packageName}」下已有打印机记录，不能更换套餐；如需变更请通过换机/撤机或新建订单处理。` };
    }
  }
  // c) 被移除的行下仍有打印机记录时不能删除
  for (const old of existingItems) {
    if (submittedIds.has(old.id)) continue;
    if (old.printers.length > 0) {
      return { error: `不能删除套餐「${old.customerPackage.packageName}」所在明细行：其下仍有 ${old.printers.length} 台打印机记录。请先撤机或换机后再调整。` };
    }
  }
  const packageIds = items.items.map((item) => item.packageId);
  const applicableCount = await prisma.customerPackage.count({
    where: { id: { in: packageIds }, OR: [{ customerId: null }, { customerId: existing.customerId }] },
  });
  if (applicableCount !== new Set(packageIds).size) return { error: "明细包含不存在或不适用于该客户的套餐。" };

  const removedIds = existingItems.filter((item) => !submittedIds.has(item.id)).map((item) => item.id);
  const totalQuantity = items.items.reduce((sum, entry) => sum + entry.quantity, 0);

  let newUrl: string | null = null;
  let newContractUrl: string | null = null;
  try {
    const file = attachmentFrom(formData);
    if (file) newUrl = await uploadOrderAttachment(file, "customer");
    const contractFile = attachmentFrom(formData, "contractAttachment");
    if (contractFile) newContractUrl = await uploadContractAttachment(contractFile, "customer");
    // 按行 diff 更新：表头 + 删除被移除行 + 逐行更新保留行 + 新建无 itemId 的行，同事务。
    await prisma.$transaction([
      prisma.customerOrder.update({
        where: { id },
        data: {
          supplierId: parsed.data.supplierId,
          installationAddress: parsed.data.installationAddress,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate ?? defaultEndDate(parsed.data.startDate),
          billingCycle: parsed.data.billingCycle,
          orderDate: parsed.data.orderDate,
          status: parsed.data.status,
          depositReceivedDate: parsed.data.depositReceivedDate,
          remark: parsed.data.remark,
          depositAmount: computeDepositAmount(totalQuantity),
          orderAttachmentUrl: newUrl ?? existing.orderAttachmentUrl,
          contractAttachmentUrl: newContractUrl ?? existing.contractAttachmentUrl,
        },
      }),
      ...(removedIds.length ? [prisma.customerOrderItem.deleteMany({ where: { id: { in: removedIds }, customerOrderId: id } })] : []),
      ...items.items.flatMap((entry) =>
        entry.itemId
          ? [
              prisma.customerOrderItem.update({
                where: { id: entry.itemId },
                data: { customerPackageId: entry.packageId, quantity: entry.quantity, plannedEntryDate: entry.plannedEntryDate, remark: entry.remark },
              }),
            ]
          : [],
      ),
      ...items.items.flatMap((entry) =>
        entry.itemId
          ? []
          : [
              prisma.customerOrderItem.create({
                data: { customerOrderId: id, customerPackageId: entry.packageId, quantity: entry.quantity, plannedEntryDate: entry.plannedEntryDate, remark: entry.remark },
              }),
            ],
      ),
    ]);
    if (newUrl) await deleteAttachment(existing.orderAttachmentUrl);
    if (newContractUrl) await deleteAttachment(existing.contractAttachmentUrl);
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
    redirect(`/orders/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await Promise.all([deleteAttachment(newUrl), deleteAttachment(newContractUrl)]);
    return { error: attachmentError(error) };
  }
}

export async function deleteCustomerOrder(id: string) {
  await requireAdmin();
  const printerCount = await prisma.printer.count({ where: { customerOrderItem: { customerOrderId: id } } });
  if (printerCount > 0) redirect(`/orders/${id}?error=${encodeURIComponent("该订单已有打印机台账记录，无法删除。")}`);
  const item = await prisma.customerOrder.delete({ where: { id } });
  await Promise.all([deleteAttachment(item.orderAttachmentUrl), deleteAttachment(item.contractAttachmentUrl)]);
  revalidatePath("/orders");
  redirect("/orders");
}

// 结束订单：只把订单状态改为「已结束」，不触碰 Printer / MeterReading / 附件 / 任何历史数据。
// 仍有运行中打印机时由前端弹风险提示，管理员确认后继续（管理员保留最终操作权）。
export async function completeCustomerOrder(id: string) {
  await requireAdmin();
  const order = await prisma.customerOrder.findUnique({ where: { id }, select: { status: true } });
  if (!order) redirect("/orders");
  if (order.status === "cancelled") redirect(`/orders/${id}?error=${encodeURIComponent("已取消的订单不能改为已结束。")}`);
  if (order.status !== "completed") {
    await prisma.customerOrder.update({ where: { id }, data: { status: "completed" } });
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  redirect(`/orders/${id}?completed=1`);
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
  const deployedGuard = await verifyDeployedGuard(
    prisma.supplierOrderItem.findMany({
      where: { supplierOrderId: id },
      select: { supplierPackageId: true, supplierPackage: { select: { packageName: true } }, printers: { where: { status: "active" }, select: { id: true } } },
    }),
    items.items,
  );
  if (deployedGuard) return { error: deployedGuard };

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
  const printerCount = await prisma.printer.count({ where: { supplierOrderItem: { supplierOrderId: id } } });
  if (printerCount > 0) redirect(`/supplier-orders/${id}?error=${encodeURIComponent("该订单已有打印机台账记录，无法删除。")}`);
  const item = await prisma.supplierOrder.delete({ where: { id } });
  await deleteAttachment(item.orderAttachmentUrl);
  revalidatePath("/supplier-orders");
  redirect("/supplier-orders");
}
