"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import { firstError, canChangeLifecycle, isBeforeDay, newQrToken, printerRemoveSchema, printerReplaceSchema, printerSchema, printerUpdateSchema, values } from "@/lib/printers";
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
  const existing = await prisma.printer.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return { error: "打印机不存在。" };
  if (!canChangeLifecycle(existing.status) && existing.status !== "draft") return { error: "已换机或已撤机的打印机保留历史，不能编辑。" };
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

const replaceKeys = ["printerCode", "supplierAssetCode", "machineModelId", "supplierOrderItemId", "replaceDate", "initialBwReading", "initialColorReading", "remark"];

// 换机：旧机 replaced + exitDate，新机 active + previousPrinterId，同事务完成。
export async function replacePrinter(oldId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = printerReplaceSchema.safeParse(values(formData, replaceKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const old = await prisma.printer.findUnique({
    where: { id: oldId },
    select: { id: true, status: true, entryDate: true, customerOrderItemId: true },
  });
  if (!old) return { error: "原打印机不存在。" };
  if (!canChangeLifecycle(old.status)) return { error: "只有运行中的打印机可以换机。" };
  if (isBeforeDay(parsed.data.replaceDate, old.entryDate)) return { error: "换机日期不能早于原打印机进场日期。" };
  const [machineModel, supplierItem] = await Promise.all([
    prisma.machineModel.findUnique({ where: { id: parsed.data.machineModelId }, select: { id: true } }),
    prisma.supplierOrderItem.findUnique({
      where: { id: parsed.data.supplierOrderItemId },
      // 旧机即将退场，统计容量时把它排除。
      select: { quantity: true, order: { select: { status: true } }, printers: { where: { status: "active", id: { not: oldId } }, select: { id: true } } },
    }),
  ]);
  if (!machineModel) return { error: "所选机型不存在，请重新选择。" };
  if (!supplierItem) return { error: "所选供应商订单明细不存在，请重新选择。" };
  if (supplierItem.order.status === "cancelled") return { error: "所选供应商订单已取消，不能用于换机。" };
  if (supplierItem.printers.length >= supplierItem.quantity) return { error: "所选供应商订单明细已交付满，不能用于换机。" };
  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.printer.update({ where: { id: oldId }, data: { status: "replaced", exitDate: parsed.data.replaceDate } });
      return tx.printer.create({
        data: {
          printerCode: parsed.data.printerCode,
          supplierAssetCode: parsed.data.supplierAssetCode,
          machineModelId: parsed.data.machineModelId,
          customerOrderItemId: old.customerOrderItemId,
          supplierOrderItemId: parsed.data.supplierOrderItemId,
          entryDate: parsed.data.replaceDate,
          initialBwReading: parsed.data.initialBwReading,
          initialColorReading: parsed.data.initialColorReading,
          status: "active",
          previousPrinterId: oldId,
          qrToken: newQrToken(),
          remark: parsed.data.remark,
        },
      });
    });
    revalidatePath("/printers");
    revalidatePath(`/printers/${oldId}`);
    revalidatePath("/customer-orders");
    revalidatePath("/supplier-orders");
    redirect(`/printers/${created.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

// 撤机：填写 exitDate，状态 removed；历史保留不删除。
export async function removePrinter(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = printerRemoveSchema.safeParse(values(formData, ["exitDate"]));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const item = await prisma.printer.findUnique({ where: { id }, select: { status: true, entryDate: true } });
  if (!item) return { error: "打印机不存在。" };
  if (!canChangeLifecycle(item.status)) return { error: "只有运行中的打印机可以撤机。" };
  if (isBeforeDay(parsed.data.exitDate, item.entryDate)) return { error: "撤机日期不能早于进场日期。" };
  await prisma.printer.update({ where: { id }, data: { status: "removed", exitDate: parsed.data.exitDate } });
  revalidatePath("/printers");
  revalidatePath(`/printers/${id}`);
  revalidatePath("/customer-orders");
  revalidatePath("/supplier-orders");
  redirect(`/printers/${id}`);
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
