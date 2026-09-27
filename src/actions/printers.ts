"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import { firstError, canChangeLifecycle, isBeforeDay, newQrToken, printerRemoveSchema, printerReplaceSchema, printerSchema, printerUpdateSchema, resolvePrinterCode, values } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

const printerKeys = ["printerCode", "supplierAssetCode", "machineModelId", "customerOrderItemId", "supplierOrderItemId", "entryDate", "initialBwReading", "initialColorReading", "remark"];
const printerUpdateKeys = ["printerCode", "supplierAssetCode", "machineModelId", "entryDate", "initialBwReading", "initialColorReading", "remark"];

function isRedirect(error: unknown) {
  return (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ?? false;
}

function databaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "数据唯一性冲突（如该原打印机已有后续替换机），请检查后重试。";
  return "保存失败，请稍后重试。";
}

// 解析新打印机编码；手填 / 供应商资产编码若与运行中打印机重名，给出应用层提示（printerCode 已无全库唯一约束）。
async function resolveNewPrinterCode(input: { printerCode: string | null; supplierAssetCode: string | null }) {
  if (!input.printerCode && !input.supplierAssetCode) {
    const rows = await prisma.printer.findMany({ select: { printerCode: true } });
    return { code: resolvePrinterCode(input, rows.map((row) => row.printerCode)).code };
  }
  const { code } = resolvePrinterCode(input, []);
  const conflict = await prisma.printer.findFirst({
    where: { printerCode: code, status: "active" },
    select: { customerOrderItem: { select: { order: { select: { customer: { select: { customerName: true } } } } } } },
  });
  if (conflict) return { error: `已有运行中的打印机使用编码「${code}」（客户：${conflict.customerOrderItem.order.customer.customerName}）。如确为不同设备，请更换编码或留空由系统生成。` };
  return { code };
}

async function verifyPrinterRefs(input: { machineModelId: string; customerOrderItemId: string; supplierOrderItemId: string | null }) {
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
    input.supplierOrderItemId
      ? prisma.supplierOrderItem.findUnique({
          where: { id: input.supplierOrderItemId },
          select: {
            id: true,
            quantity: true,
            order: { select: { status: true } },
            printers: { where: { status: "active" }, select: { id: true } },
          },
        })
      : null,
  ]);
  if (!machineModel) return "所选机型不存在，请重新选择。";
  if (!customerItem) return "所选客户订单明细不存在，请重新选择。";
  if (input.supplierOrderItemId && !supplierItem) return "所选供应商订单明细不存在，请重新选择。";
  if (customerItem.order.status === "cancelled") return "所选客户订单已取消，不能部署打印机。";
  if (customerItem.order.status === "completed") return "所选客户订单已结束，不能部署打印机。";
  if (supplierItem?.order.status === "cancelled") return "所选供应商订单已取消，不能部署打印机。";
  if (supplierItem?.order.status === "completed") return "所选供应商订单已结束，不能部署打印机。";
  if (customerItem.printers.length >= customerItem.quantity) return "所选客户订单明细已部署满，不能继续新增打印机。";
  if (supplierItem && supplierItem.printers.length >= supplierItem.quantity) return "所选供应商订单明细已交付满，不能继续新增打印机。";
  return null;
}

export async function createPrinter(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = printerSchema.safeParse(values(formData, printerKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const refError = await verifyPrinterRefs(parsed.data);
  if (refError) return { error: refError };
  const resolved = await resolveNewPrinterCode(parsed.data);
  if ("error" in resolved) return { error: resolved.error };
  try {
    const item = await prisma.printer.create({
      data: { ...parsed.data, printerCode: resolved.code, status: "active", qrToken: newQrToken() },
    });
    revalidatePath("/printers");
    revalidatePath("/orders");
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
    revalidatePath("/orders");
    revalidatePath("/supplier-orders");
    redirect(`/printers/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { error: databaseError(error) };
  }
}

const replaceKeys = ["printerCode", "supplierAssetCode", "machineModelId", "supplierOrderItemId", "replaceDate", "initialBwReading", "initialColorReading", "remark"];

// 换机：旧机 replaced + exitDate，新机 active + previousPrinterId，同事务完成。
// 供应商明细留空 = 沿用原机（原机未关联则新机也不关联）；printerCode 留空按规则生成。
export async function replacePrinter(oldId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = printerReplaceSchema.safeParse(values(formData, replaceKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const old = await prisma.printer.findUnique({
    where: { id: oldId },
    select: {
      id: true,
      status: true,
      entryDate: true,
      customerOrderItemId: true,
      supplierOrderItemId: true,
      customerOrderItem: { select: { order: { select: { status: true } } } },
    },
  });
  if (!old) return { error: "原打印机不存在。" };
  if (!canChangeLifecycle(old.status)) return { error: "只有运行中的打印机可以换机。" };
  // 换机会在同一客户订单明细下创建新打印机，已结束 / 已取消订单同样禁止（与新增打印机同一规则）。
  if (old.customerOrderItem.order.status === "completed" || old.customerOrderItem.order.status === "cancelled") {
    return { error: "所属客户订单已结束或已取消，不能换机部署新打印机。" };
  }
  if (isBeforeDay(parsed.data.replaceDate, old.entryDate)) return { error: "换机日期不能早于原打印机进场日期。" };
  const supplierOrderItemId = parsed.data.supplierOrderItemId ?? old.supplierOrderItemId;
  const [machineModel, supplierItem] = await Promise.all([
    prisma.machineModel.findUnique({ where: { id: parsed.data.machineModelId }, select: { id: true } }),
    supplierOrderItemId
      ? prisma.supplierOrderItem.findUnique({
          where: { id: supplierOrderItemId },
          // 旧机即将退场，统计容量时把它排除。
          select: { quantity: true, order: { select: { status: true } }, printers: { where: { status: "active", id: { not: oldId } }, select: { id: true } } },
        })
      : null,
  ]);
  if (!machineModel) return { error: "所选机型不存在，请重新选择。" };
  if (supplierOrderItemId && !supplierItem) return { error: "所选供应商订单明细不存在，请重新选择。" };
  if (supplierItem?.order.status === "cancelled" || supplierItem?.order.status === "completed") return { error: "所选供应商订单已取消或已结束，不能用于换机。" };
  if (supplierItem && supplierItem.printers.length >= supplierItem.quantity) return { error: "所选供应商订单明细已交付满，不能用于换机。" };
  const resolved = await resolveNewPrinterCode(parsed.data);
  if ("error" in resolved) return { error: resolved.error };
  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.printer.update({ where: { id: oldId }, data: { status: "replaced", exitDate: parsed.data.replaceDate } });
      return tx.printer.create({
        data: {
          printerCode: resolved.code,
          supplierAssetCode: parsed.data.supplierAssetCode,
          machineModelId: parsed.data.machineModelId,
          customerOrderItemId: old.customerOrderItemId,
          supplierOrderItemId,
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
    revalidatePath("/orders");
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
  revalidatePath("/orders");
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
  revalidatePath("/orders");
  revalidatePath("/supplier-orders");
  redirect("/printers");
}
