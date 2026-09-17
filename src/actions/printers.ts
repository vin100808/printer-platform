"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import { firstError, newQrToken, printerSchema, printerUpdateSchema, values } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

const printerKeys = ["printerCode", "supplierAssetCode", "machineModelId", "customerOrderItemId", "supplierOrderItemId", "entryDate", "initialBwReading", "initialColorReading", "remark"];
const printerUpdateKeys = ["printerCode", "supplierAssetCode", "machineModelId", "entryDate", "initialBwReading", "initialColorReading", "remark"];

function isRedirect(error: unknown) {
  return (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ?? false;
}

function databaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "打印机编码已存在。";
  return "保存失败，请稍后重试。";
}

async function verifyPrinterRefs(input: { machineModelId: string; customerOrderItemId: string; supplierOrderItemId: string }) {
  const [machineModel, customerItem, supplierItem] = await Promise.all([
    prisma.machineModel.findUnique({ where: { id: input.machineModelId }, select: { id: true } }),
    prisma.customerOrderItem.findUnique({
      where: { id: input.customerOrderItemId },
      select: {
        id: true,
        quantity: true,
        order: { select: { status: true } },
        printers: { where: { status: "active" }, select: { id: true } },
      },
    }),
    prisma.supplierOrderItem.findUnique({
      where: { id: input.supplierOrderItemId },
      select: {
        id: true,
        quantity: true,
        order: { select: { status: true } },
        printers: { where: { status: "active" }, select: { id: true } },
      },
    }),
  ]);
  if (!machineModel) return "所选机型不存在，请重新选择。";
  if (!customerItem) return "所选客户订单明细不存在，请重新选择。";
  if (!supplierItem) return "所选供应商订单明细不存在，请重新选择。";
  if (customerItem.order.status === "cancelled") return "所选客户订单已取消，不能部署打印机。";
  if (supplierItem.order.status === "cancelled") return "所选供应商订单已取消，不能部署打印机。";
  if (customerItem.printers.length >= customerItem.quantity) return "所选客户订单明细已部署满，不能继续新增打印机。";
  if (supplierItem.printers.length >= supplierItem.quantity) return "所选供应商订单明细已交付满，不能继续新增打印机。";
  return null;
}

export async function createPrinter(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = printerSchema.safeParse(values(formData, printerKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const refError = await verifyPrinterRefs(parsed.data);
  if (refError) return { error: refError };
  try {
    const item = await prisma.printer.create({
      data: { ...parsed.data, status: "active", qrToken: newQrToken() },
    });
    revalidatePath("/printers");
    revalidatePath("/customer-orders");
    revalidatePath("/supplier-orders");
    redirect(`/printers/${item.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

export async function updatePrinter(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = printerUpdateSchema.safeParse(values(formData, printerUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const machineModel = await prisma.machineModel.findUnique({ where: { id: parsed.data.machineModelId }, select: { id: true } });
  if (!machineModel) return { error: "所选机型不存在，请重新选择。" };
  try {
    await prisma.printer.update({ where: { id }, data: parsed.data });
    revalidatePath("/printers");
    revalidatePath(`/printers/${id}`);
    revalidatePath("/customer-orders");
    revalidatePath("/supplier-orders");
    redirect(`/printers/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

// 只有未发生过生命周期变化的打印机允许删除（录错撤销）；已换机 / 已撤机记录保留历史不删除。
export async function deletePrinter(id: string) {
  await requireAdmin();
  const item = await prisma.printer.findUniqueOrThrow({ where: { id }, select: { status: true } });
  if (item.status === "replaced" || item.status === "removed") redirect(`/printers/${id}?error=history-protected`);
  await prisma.printer.delete({ where: { id } });
  revalidatePath("/printers");
  revalidatePath("/customer-orders");
  revalidatePath("/supplier-orders");
  redirect("/printers");
}
