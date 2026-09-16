"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { nextCode } from "@/lib/codes";
import {
  contractSchema,
  customerInputSchema,
  firstError,
  locationSchema,
  supplierInputSchema,
  values,
} from "@/lib/master-data";
import { deleteAttachment, uploadContractAttachment } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";

export type FormState = { error?: string };

const customerKeys = ["customerName", "customerType", "taxpayerIdentificationNo", "registeredAddress", "bankName", "bankAccountName", "bankAccountNo", "contactName", "contactPhone", "status", "remark"];
const supplierKeys = ["supplierName", "taxpayerIdentificationNo", "registeredAddress", "bankName", "bankAccountName", "bankAccountNo", "contactName", "contactPhone", "serviceArea", "status", "remark"];
const locationKeys = ["locationCode", "locationName", "address", "contactName", "contactPhone", "status", "remark"];
const contractKeys = ["contractNo", "contractName", "effectiveDate", "expiryDate", "status", "remark"];

function isRedirect(error: unknown) {
  return (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ?? false;
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function nextCustomerCode() {
  const rows = await prisma.customer.findMany({ select: { customerCode: true } });
  return nextCode("C", rows.map((row) => row.customerCode));
}

async function nextSupplierCode() {
  const rows = await prisma.supplier.findMany({ select: { supplierCode: true } });
  return nextCode("S", rows.map((row) => row.supplierCode));
}

function databaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "编码已存在，请使用其他编码。";
  return "保存失败，请稍后重试。";
}

function contractError(error: unknown) {
  return error instanceof Error && error.message.startsWith("附件") ? error.message : databaseError(error);
}

export async function createCustomer(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = customerInputSchema.safeParse(values(formData, customerKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const item = await prisma.customer.create({ data: { ...parsed.data, customerCode: await nextCustomerCode() } });
      revalidatePath("/customers");
      redirect(`/customers/${item.id}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      // 并发新增撞唯一编码时，按最新最大编码重新取号重试。
      if (isUniqueConflict(error) && attempt < 2) continue;
      return { error: databaseError(error) };
    }
  }
  return { error: "保存失败，请稍后重试。" };
}

export async function updateCustomer(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = customerInputSchema.safeParse(values(formData, customerKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await prisma.customer.update({ where: { id }, data: parsed.data });
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    redirect(`/customers/${id}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { error: databaseError(error) };
  }
}

export async function deleteCustomer(id: string) {
  await requireAdmin();
  try {
    await prisma.customer.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      redirect(`/customers?error=${encodeURIComponent("该客户存在专属套餐，请先处理其客户套餐后再删除客户。")}`);
    }
    throw error;
  }
  revalidatePath("/customers");
  redirect("/customers");
}

export async function createSupplier(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = supplierInputSchema.safeParse(values(formData, supplierKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const item = await prisma.supplier.create({ data: { ...parsed.data, supplierCode: await nextSupplierCode() } });
      revalidatePath("/suppliers");
      redirect(`/suppliers/${item.id}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      // 并发新增撞唯一编码时，按最新最大编码重新取号重试。
      if (isUniqueConflict(error) && attempt < 2) continue;
      return { error: databaseError(error) };
    }
  }
  return { error: "保存失败，请稍后重试。" };
}

export async function updateSupplier(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = supplierInputSchema.safeParse(values(formData, supplierKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await prisma.supplier.update({ where: { id }, data: parsed.data });
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    redirect(`/suppliers/${id}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { error: databaseError(error) };
  }
}

export async function deleteSupplier(id: string) {
  await requireAdmin();
  const attachments = await prisma.supplierFrameworkContract.findMany({ where: { supplierId: id }, select: { attachmentUrl: true } });
  try {
    await prisma.supplier.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      redirect(`/suppliers?error=${encodeURIComponent("该供应商存在采购套餐，请先处理其供应商套餐后再删除供应商。")}`);
    }
    throw error;
  }
  await Promise.all(attachments.map((item) => deleteAttachment(item.attachmentUrl)));
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function createLocation(customerId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = locationSchema.safeParse(values(formData, locationKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await prisma.location.create({ data: { ...parsed.data, customerId } });
    revalidatePath(`/customers/${customerId}`);
    redirect(`/customers/${customerId}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { error: databaseError(error) };
  }
}

export async function updateLocation(customerId: string, id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = locationSchema.safeParse(values(formData, locationKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await prisma.location.update({ where: { id, customerId }, data: parsed.data });
    revalidatePath(`/customers/${customerId}`);
    redirect(`/customers/${customerId}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { error: databaseError(error) };
  }
}

export async function deleteLocation(customerId: string, id: string) {
  await requireAdmin();
  await prisma.location.delete({ where: { id, customerId } });
  revalidatePath(`/customers/${customerId}`);
}

async function contractData(formData: FormData) {
  const parsed = contractSchema.safeParse(values(formData, contractKeys));
  return parsed;
}

export async function createCustomerContract(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = await contractData(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const customerIds = formData.getAll("customerIds").map(String).filter(Boolean);
  if (!customerIds.length) return { error: "请至少关联一个客户" };
  let attachmentUrl: string | null = null;
  try {
    const file = formData.get("attachment");
    if (file instanceof File && file.size) attachmentUrl = await uploadContractAttachment(file, "customer");
    const item = await prisma.customerFrameworkContract.create({ data: { ...parsed.data, attachmentUrl, customers: { connect: customerIds.map((id) => ({ id })) } } });
    revalidatePath("/customer-contracts");
    revalidatePath("/customers", "layout");
    redirect(`/customer-contracts/${item.id}/edit`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    await deleteAttachment(attachmentUrl);
    return { error: contractError(error) };
  }
}

export async function updateCustomerContract(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = await contractData(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const customerIds = formData.getAll("customerIds").map(String).filter(Boolean);
  if (!customerIds.length) return { error: "请至少关联一个客户" };
  const existing = await prisma.customerFrameworkContract.findUniqueOrThrow({ where: { id } });
  let newUrl: string | null = null;
  try {
    const file = formData.get("attachment");
    if (file instanceof File && file.size) newUrl = await uploadContractAttachment(file, "customer");
    await prisma.customerFrameworkContract.update({ where: { id }, data: { ...parsed.data, attachmentUrl: newUrl ?? existing.attachmentUrl, customers: { set: customerIds.map((customerId) => ({ id: customerId })) } } });
    if (newUrl) await deleteAttachment(existing.attachmentUrl);
    revalidatePath("/customer-contracts");
    revalidatePath("/customers", "layout");
    redirect(`/customer-contracts/${id}/edit`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    await deleteAttachment(newUrl);
    return { error: contractError(error) };
  }
}

export async function deleteCustomerContract(id: string) {
  await requireAdmin();
  const item = await prisma.customerFrameworkContract.delete({ where: { id } });
  await deleteAttachment(item.attachmentUrl);
  revalidatePath("/customer-contracts");
  redirect("/customer-contracts");
}

export async function createSupplierContract(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = await contractData(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!supplierId) return { error: "请选择供应商" };
  let attachmentUrl: string | null = null;
  try {
    const file = formData.get("attachment");
    if (file instanceof File && file.size) attachmentUrl = await uploadContractAttachment(file, "supplier");
    const item = await prisma.supplierFrameworkContract.create({ data: { ...parsed.data, supplierId, attachmentUrl } });
    revalidatePath("/supplier-contracts");
    revalidatePath(`/suppliers/${supplierId}`);
    redirect(`/supplier-contracts/${item.id}/edit`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    await deleteAttachment(attachmentUrl);
    return { error: contractError(error) };
  }
}

export async function updateSupplierContract(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = await contractData(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!supplierId) return { error: "请选择供应商" };
  const existing = await prisma.supplierFrameworkContract.findUniqueOrThrow({ where: { id } });
  let newUrl: string | null = null;
  try {
    const file = formData.get("attachment");
    if (file instanceof File && file.size) newUrl = await uploadContractAttachment(file, "supplier");
    await prisma.supplierFrameworkContract.update({ where: { id }, data: { ...parsed.data, supplierId, attachmentUrl: newUrl ?? existing.attachmentUrl } });
    if (newUrl) await deleteAttachment(existing.attachmentUrl);
    revalidatePath("/supplier-contracts");
    revalidatePath(`/suppliers/${supplierId}`);
    redirect(`/supplier-contracts/${id}/edit`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    await deleteAttachment(newUrl);
    return { error: contractError(error) };
  }
}

export async function deleteSupplierContract(id: string) {
  await requireAdmin();
  const item = await prisma.supplierFrameworkContract.delete({ where: { id } });
  await deleteAttachment(item.attachmentUrl);
  revalidatePath("/supplier-contracts");
  redirect("/supplier-contracts");
}
