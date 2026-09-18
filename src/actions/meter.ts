"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import { computeUsages, firstError, meterAdminUpdateSchema, meterSubmitSchema, meterWindow, values } from "@/lib/meter";
import { deleteAttachment, uploadMeterPhoto } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";

// 彩色机必须填写彩色读数；黑白机禁止提交彩色读数（防篡改同样在校验层强制执行）。
function parseColorReading(raw: string, deviceType: "black_white" | "color") {
  if (deviceType === "black_white") {
    if (raw && raw !== "0") throw new Error("黑白设备无需填写彩色读数");
    return 0;
  }
  if (!raw) throw new Error("请填写当前彩色读数");
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error("当前彩色读数必须是非负整数");
  return value;
}

// 上期读数：最近一次抄表的当前读数；首次抄表使用打印机进场初始读数。
async function resolvePreviousReadings(printerId: string) {
  const latest = await prisma.meterReading.findFirst({
    where: { printerId },
    orderBy: [{ readingYear: "desc" }, { readingMonth: "desc" }],
    select: { currentBwReading: true, currentColorReading: true },
  });
  if (latest) return { previousBw: latest.currentBwReading, previousColor: latest.currentColorReading };
  const printer = await prisma.printer.findUniqueOrThrow({ where: { id: printerId }, select: { initialBwReading: true, initialColorReading: true } });
  return { previousBw: printer.initialBwReading, previousColor: printer.initialColorReading };
}

function photoFrom(formData: FormData) {
  const file = formData.get("photo");
  return file instanceof File && file.size ? file : null;
}

export async function submitMeterReading(token: string, _: FormState, formData: FormData): Promise<FormState> {
  const parsed = meterSubmitSchema.safeParse(values(formData, ["currentBwReading", "currentColorReading"]));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const printer = await prisma.printer.findUnique({ where: { qrToken: token }, include: { machineModel: { select: { deviceType: true } } } });
  if (!printer) return { error: "二维码无效或设备不存在。" };
  if (printer.status !== "active") return { error: "该设备当前已停止使用。" };
  const window = meterWindow(new Date());
  if (window.phase !== "open") {
    return { error: window.phase === "before" ? "本期抄表尚未开放，请于每月 1-3 日提交。" : "本期抄表已关闭，如需补录请联系管理员。" };
  }
  const existing = await prisma.meterReading.findUnique({
    where: { printerId_readingYear_readingMonth: { printerId: printer.id, readingYear: window.year, readingMonth: window.month } },
    select: { id: true },
  });
  if (existing) return { error: "本期抄表已提交，如需修改请联系管理员。" };

  const currentColor = parseColorReading(parsed.data.currentColorReading, printer.machineModel.deviceType);
  const { previousBw, previousColor } = await resolvePreviousReadings(printer.id);
  let usages: { bwUsage: number; colorUsage: number; bwEquivalentUsage: number };
  try {
    usages = computeUsages(previousBw, parsed.data.currentBwReading, previousColor, currentColor);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "读数不正确" };
  }

  const photo = photoFrom(formData);
  if (!photo) return { error: "请上传抄表照片。" };
  let photoUrl: string | null = null;
  try {
    photoUrl = await uploadMeterPhoto(photo);
    if (!photoUrl) throw new Error("照片上传失败，请重试");
    await prisma.meterReading.create({
      data: {
        printerId: printer.id,
        readingYear: window.year,
        readingMonth: window.month,
        previousBwReading: previousBw,
        currentBwReading: parsed.data.currentBwReading,
        previousColorReading: previousColor,
        currentColorReading: currentColor,
        ...usages,
        photoUrl,
      },
    });
  } catch (error) {
    await deleteAttachment(photoUrl);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "本期抄表已提交，如需修改请联系管理员。" };
    if (error instanceof Error && (error.message.startsWith("照片") || error.message.startsWith("附件"))) return { error: error.message };
    return { error: "提交失败，请稍后重试。" };
  }
  revalidatePath(`/meter/${token}`);
  redirect(`/meter/${token}?submitted=1`);
}

const meterUpdateKeys = ["currentBwReading", "currentColorReading", "adminNote"];

export async function updateMeterReading(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = meterAdminUpdateSchema.safeParse(values(formData, meterUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const reading = await prisma.meterReading.findUnique({
    where: { id },
    include: { printer: { select: { machineModel: { select: { deviceType: true } } } } },
  });
  if (!reading) return { error: "抄表记录不存在。" };

  const currentColor = parseColorReading(parsed.data.currentColorReading, reading.printer.machineModel.deviceType);
  let usages: { bwUsage: number; colorUsage: number; bwEquivalentUsage: number };
  try {
    usages = computeUsages(reading.previousBwReading, parsed.data.currentBwReading, reading.previousColorReading, currentColor);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "读数不正确" };
  }
  await prisma.meterReading.update({
    where: { id },
    data: {
      currentBwReading: parsed.data.currentBwReading,
      currentColorReading: currentColor,
      ...usages,
      adminNote: parsed.data.adminNote,
      status: "adjusted",
      updatedBy: admin.name,
    },
  });
  revalidatePath(`/printers/${reading.printerId}`);
  redirect(`/printers/${reading.printerId}`);
}
