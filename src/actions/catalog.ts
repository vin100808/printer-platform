"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import {
  customerPackageSchema,
  customerPackageUpdateSchema,
  firstError,
  machineModelSchema,
  supplierPackageSchema,
  supplierPackageUpdateSchema,
  values,
} from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

const machineModelKeys = ["brand", "modelName", "deviceType", "status", "remark"];
const customerPackageKeys = ["packageCode", "packageName", "monthlyRent", "monthlyFreeBwEquivalent", "overageRateBwEquivalent", "customerId", "effectiveFrom", "status", "remark"];
const supplierPackageKeys = ["packageCode", "packageName", "monthlyRent", "monthlyFreeBwEquivalent", "overageRateBwEquivalent", "supplierId", "effectiveFrom", "status", "remark"];
const packageUpdateKeys = ["packageName", "effectiveFrom", "status", "remark"];

function isRedirect(error: unknown) {
  return (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ?? false;
}

function databaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "套餐编码与版本组合已存在。";
  return "保存失败，请稍后重试。";
}

function machineModelError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "该品牌下已存在相同型号。";
  return "保存失败，请稍后重试。";
}

function machineIdsFrom(formData: FormData) {
  return formData.getAll("machineIds").map(String).filter(Boolean);
}

export async function createMachineModel(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = machineModelSchema.safeParse(values(formData, machineModelKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    const item = await prisma.machineModel.create({ data: parsed.data });
    revalidatePath("/machine-models");
    redirect(`/machine-models/${item.id}/edit`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: machineModelError(error) };
  }
}

export async function updateMachineModel(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = machineModelSchema.safeParse(values(formData, machineModelKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await prisma.machineModel.update({ where: { id }, data: parsed.data });
    revalidatePath("/machine-models");
    redirect("/machine-models");
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: machineModelError(error) };
  }
}

export async function deleteMachineModel(id: string) {
  await requireAdmin();
  await prisma.machineModel.delete({ where: { id } });
  revalidatePath("/machine-models");
  redirect("/machine-models");
}

export async function createCustomerPackage(versionOf: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = customerPackageSchema.safeParse(values(formData, customerPackageKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    let packageCode = parsed.data.packageCode;
    let version = 1;
    if (versionOf) {
      // 新版本继承源套餐编码，版本号服务端自增，价格等字段以表单为准。
      const source = await prisma.customerPackage.findUnique({ where: { id: versionOf } });
      if (!source) return { error: "源套餐不存在，无法创建新版本" };
      packageCode = source.packageCode;
      version = source.version + 1;
    }
    const item = await prisma.customerPackage.create({
      data: {
        packageCode,
        packageName: parsed.data.packageName,
        monthlyRent: parsed.data.monthlyRent,
        monthlyFreeBwEquivalent: parsed.data.monthlyFreeBwEquivalent,
        overageRateBwEquivalent: parsed.data.overageRateBwEquivalent,
        customerId: parsed.data.customerId,
        version,
        effectiveFrom: parsed.data.effectiveFrom,
        status: parsed.data.status,
        remark: parsed.data.remark,
        machineModels: { connect: machineIdsFrom(formData).map((machineId) => ({ id: machineId })) },
      },
    });
    revalidatePath("/customer-packages");
    redirect(`/customer-packages/${item.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

export async function updateCustomerPackage(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = customerPackageUpdateSchema.safeParse(values(formData, packageUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await prisma.customerPackage.update({
      where: { id },
      data: { ...parsed.data, machineModels: { set: machineIdsFrom(formData).map((machineId) => ({ id: machineId })) } },
    });
    revalidatePath("/customer-packages");
    revalidatePath(`/customer-packages/${id}`);
    redirect(`/customer-packages/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

export async function deleteCustomerPackage(id: string) {
  await requireAdmin();
  await prisma.customerPackage.delete({ where: { id } });
  revalidatePath("/customer-packages");
  redirect("/customer-packages");
}

export async function createSupplierPackage(versionOf: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = supplierPackageSchema.safeParse(values(formData, supplierPackageKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    let packageCode = parsed.data.packageCode;
    let version = 1;
    if (versionOf) {
      const source = await prisma.supplierPackage.findUnique({ where: { id: versionOf } });
      if (!source) return { error: "源套餐不存在，无法创建新版本" };
      packageCode = source.packageCode;
      version = source.version + 1;
    }
    const item = await prisma.supplierPackage.create({
      data: {
        packageCode,
        packageName: parsed.data.packageName,
        monthlyRent: parsed.data.monthlyRent,
        monthlyFreeBwEquivalent: parsed.data.monthlyFreeBwEquivalent,
        overageRateBwEquivalent: parsed.data.overageRateBwEquivalent,
        supplierId: parsed.data.supplierId,
        version,
        effectiveFrom: parsed.data.effectiveFrom,
        status: parsed.data.status,
        remark: parsed.data.remark,
        machineModels: { connect: machineIdsFrom(formData).map((machineId) => ({ id: machineId })) },
      },
    });
    revalidatePath("/supplier-packages");
    redirect(`/supplier-packages/${item.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

export async function updateSupplierPackage(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = supplierPackageUpdateSchema.safeParse(values(formData, packageUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await prisma.supplierPackage.update({
      where: { id },
      data: { ...parsed.data, machineModels: { set: machineIdsFrom(formData).map((machineId) => ({ id: machineId })) } },
    });
    revalidatePath("/supplier-packages");
    revalidatePath(`/supplier-packages/${id}`);
    redirect(`/supplier-packages/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

export async function deleteSupplierPackage(id: string) {
  await requireAdmin();
  await prisma.supplierPackage.delete({ where: { id } });
  revalidatePath("/supplier-packages");
  redirect("/supplier-packages");
}
