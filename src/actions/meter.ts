"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/actions/master-data";
import { requireAdmin } from "@/lib/auth";
import { computeUsages, firstError, meterAdminCreateSchema, meterAdminUpdateSchema, meterSubmitSchema, meterWindow, parseColorReading, values } from "@/lib/meter";
import { createAdminMeterReading, updateAdminMeterReading } from "@/lib/meter-admin";
import { deleteAttachment, uploadMeterPhoto } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";

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

function revalidateMeterPages(printerId: string) {
  revalidatePath(`/printers/${printerId}`);
  revalidatePath("/meter-readings");
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

const meterCreateKeys = ["readingYear", "readingMonth", "currentBwReading", "currentColorReading", "adminNote"];

// 后台手动新增抄表（TASK 19）：不受客户 QR 每月 1-3 日窗口限制，允许历史月份补录；照片可选。
export async function createMeterReading(printerId: string, _: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = meterAdminCreateSchema.safeParse(values(formData, meterCreateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const photo = photoFrom(formData);
  let photoUrl: string | null = null;
  if (photo) {
    try {
      photoUrl = await uploadMeterPhoto(photo);
      if (!photoUrl) throw new Error("照片上传失败，请重试");
    } catch (error) {
      return { error: error instanceof Error ? error.message : "照片上传失败，请重试" };
    }
  }

  const result = await createAdminMeterReading({
    printerId,
    readingYear: parsed.data.readingYear,
    readingMonth: parsed.data.readingMonth,
    currentBwReading: parsed.data.currentBwReading,
    currentColorRaw: parsed.data.currentColorReading,
    photoUrl,
    adminNote: parsed.data.adminNote || null,
    operator: admin.name,
  });
  if ("error" in result) {
    await deleteAttachment(photoUrl);
    return { error: result.error };
  }
  revalidateMeterPages(printerId);
  redirect(`/printers/${printerId}`);
}

const meterUpdateKeys = ["currentBwReading", "currentColorReading", "adminNote"];

export async function updateMeterReading(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = meterAdminUpdateSchema.safeParse(values(formData, meterUpdateKeys));
  if (!parsed.success) return { error: firstError(parsed.error) };

  // 后台编辑可选项更换照片：先上传新照片，保存成功后清理旧照片。
  const photo = photoFrom(formData);
  let photoUrl: string | null = null;
  if (photo) {
    try {
      photoUrl = await uploadMeterPhoto(photo);
      if (!photoUrl) throw new Error("照片上传失败，请重试");
    } catch (error) {
      return { error: error instanceof Error ? error.message : "照片上传失败，请重试" };
    }
  }

  const previousPhoto = await prisma.meterReading.findUnique({ where: { id }, select: { photoUrl: true, printerId: true } });
  const result = await updateAdminMeterReading({
    id,
    currentBwReading: parsed.data.currentBwReading,
    currentColorRaw: parsed.data.currentColorReading,
    adminNote: parsed.data.adminNote,
    operator: admin.name,
    photoUrl: photoUrl ?? undefined,
  });
  if ("error" in result) {
    await deleteAttachment(photoUrl);
    return { error: result.error };
  }
  if (photoUrl && previousPhoto?.photoUrl && previousPhoto.photoUrl !== photoUrl) {
    await deleteAttachment(previousPhoto.photoUrl);
  }
  revalidateMeterPages(result.reading.printerId);
  redirect(`/printers/${result.reading.printerId}`);
}
