import type { MeterReading } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { adminReadingPeriodError, computeUsages, nextReadingBoundError, parseColorReading } from "@/lib/meter";
import { prisma } from "@/lib/prisma";

// 后台手动新增 / 编辑抄表的核心逻辑（不含登录校验、照片上传、revalidate / redirect，便于集成测试直接调用）。
// 与客户 QR 抄表共用同一 MeterReading 模型与用量计算规则；结算引擎直接读取这些记录。

type Result = { error: string } | { reading: MeterReading };

type AdjacentReading = {
  readingYear: number;
  readingMonth: number;
  currentBwReading: number;
  currentColorReading: number;
};

/** 与目标月份相邻的已有抄表：上一期（更早的最近一条）与下一期（更晚的最早一条）。 */
async function adjacentReadings(printerId: string, year: number, month: number) {
  const select = { readingYear: true, readingMonth: true, currentBwReading: true, currentColorReading: true };
  const [previous, next] = await Promise.all([
    prisma.meterReading.findFirst({
      where: { printerId, OR: [{ readingYear: { lt: year } }, { readingYear: year, readingMonth: { lt: month } }] },
      orderBy: [{ readingYear: "desc" }, { readingMonth: "desc" }],
      select,
    }),
    prisma.meterReading.findFirst({
      where: { printerId, OR: [{ readingYear: { gt: year } }, { readingYear: year, readingMonth: { gt: month } }] },
      orderBy: [{ readingYear: "asc" }, { readingMonth: "asc" }],
      select,
    }),
  ]);
  return { previous, next };
}

function checkUsages(
  previous: { currentBwReading: number; currentColorReading: number },
  next: AdjacentReading | null,
  currentBw: number,
  currentColor: number,
): { error: string } | { usages: { bwUsage: number; colorUsage: number; bwEquivalentUsage: number } } {
  let usages: { bwUsage: number; colorUsage: number; bwEquivalentUsage: number };
  try {
    usages = computeUsages(previous.currentBwReading, currentBw, previous.currentColorReading, currentColor);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "读数不正确" };
  }
  const boundError = nextReadingBoundError({ bw: currentBw, color: currentColor }, next);
  if (boundError) return { error: boundError };
  return { usages };
}

export async function createAdminMeterReading(input: {
  printerId: string;
  readingYear: number;
  readingMonth: number;
  currentBwReading: number;
  currentColorRaw: string;
  photoUrl?: string | null;
  adminNote?: string | null;
  operator?: string;
  now?: Date;
}): Promise<Result> {
  const printer = await prisma.printer.findUnique({
    where: { id: input.printerId },
    include: { machineModel: { select: { deviceType: true } } },
  });
  if (!printer) return { error: "打印机不存在。" };

  const periodError = adminReadingPeriodError(input.readingYear, input.readingMonth, printer.entryDate, printer.exitDate, input.now ?? new Date());
  if (periodError) return { error: periodError };

  const existing = await prisma.meterReading.findUnique({
    where: { printerId_readingYear_readingMonth: { printerId: printer.id, readingYear: input.readingYear, readingMonth: input.readingMonth } },
    select: { id: true },
  });
  if (existing) return { error: "该月份已有抄表记录，请使用编辑功能修改。" };

  let currentColor: number;
  try {
    currentColor = parseColorReading(input.currentColorRaw, printer.machineModel.deviceType);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "读数不正确" };
  }

  const { previous, next } = await adjacentReadings(printer.id, input.readingYear, input.readingMonth);
  // 上一期缺省时使用打印机进场初始读数（与客户 QR 首次抄表一致）。
  const previousReading = previous ?? { currentBwReading: printer.initialBwReading, currentColorReading: printer.initialColorReading };
  const checked = checkUsages(previousReading, next, input.currentBwReading, currentColor);
  if ("error" in checked) return checked;

  try {
    const reading = await prisma.meterReading.create({
      data: {
        printerId: printer.id,
        readingYear: input.readingYear,
        readingMonth: input.readingMonth,
        previousBwReading: previousReading.currentBwReading,
        currentBwReading: input.currentBwReading,
        previousColorReading: previousReading.currentColorReading,
        currentColorReading: currentColor,
        ...checked.usages,
        photoUrl: input.photoUrl ?? null,
        adminNote: input.adminNote || null,
        updatedBy: input.adminNote ? (input.operator ?? null) : null,
      },
    });
    return { reading };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "该月份已有抄表记录，请使用编辑功能修改。" };
    }
    throw error;
  }
}

export async function updateAdminMeterReading(input: {
  id: string;
  currentBwReading: number;
  currentColorRaw: string;
  adminNote: string;
  operator?: string;
  photoUrl?: string;
}): Promise<Result> {
  const reading = await prisma.meterReading.findUnique({
    where: { id: input.id },
    include: { printer: { select: { machineModel: { select: { deviceType: true } } } } },
  });
  if (!reading) return { error: "抄表记录不存在。" };

  let currentColor: number;
  try {
    currentColor = parseColorReading(input.currentColorRaw, reading.printer.machineModel.deviceType);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "读数不正确" };
  }

  const { next } = await adjacentReadings(reading.printerId, reading.readingYear, reading.readingMonth);
  const checked = checkUsages(
    { currentBwReading: reading.previousBwReading, currentColorReading: reading.previousColorReading },
    next,
    input.currentBwReading,
    currentColor,
  );
  if ("error" in checked) return checked;

  const updated = await prisma.meterReading.update({
    where: { id: reading.id },
    data: {
      currentBwReading: input.currentBwReading,
      currentColorReading: currentColor,
      ...checked.usages,
      adminNote: input.adminNote,
      status: "adjusted",
      updatedBy: input.operator ?? null,
      ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
    },
  });
  return { reading: updated };
}
