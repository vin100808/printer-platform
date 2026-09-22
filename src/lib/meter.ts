import { z } from "zod";

// 1 张黑白 = 1 BW Equivalent；1 张彩色 = 10 BW Equivalent（系统固定规则）。
export const COLOR_BW_EQUIVALENT = 10;

const readingInput = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.coerce
      .number({ error: `${label}必须是数字` })
      .int(`${label}必须是整数`)
      .min(0, `${label}不能为负数`)
      .max(999999999, `${label}超出允许范围`),
  );

export const meterSubmitSchema = z.object({
  currentBwReading: readingInput("当前黑白读数"),
  currentColorReading: z.string().trim(),
});

export const meterAdminUpdateSchema = z.object({
  currentBwReading: readingInput("当前黑白读数"),
  currentColorReading: z.string().trim(),
  adminNote: z.string().trim().min(1, "请填写调整说明").max(500),
});

// 后台手动新增抄表：不受客户 QR 每月 1-3 日窗口限制，允许补录历史月份；照片与备注可选。
export const meterAdminCreateSchema = z.object({
  readingYear: z.coerce
    .number({ error: "抄表年份必须是数字" })
    .int("抄表年份必须是整数")
    .min(2000, "抄表年份不正确")
    .max(2100, "抄表年份不正确"),
  readingMonth: z.coerce
    .number({ error: "抄表月份必须是数字" })
    .int("抄表月份必须是整数")
    .min(1, "抄表月份必须在 1-12 之间")
    .max(12, "抄表月份必须在 1-12 之间"),
  currentBwReading: readingInput("当前黑白读数"),
  currentColorReading: z.string().trim(),
  adminNote: z.string().trim().max(500, "备注不能超过 500 字"),
});

// 彩色机必须填写彩色读数；黑白机禁止提交彩色读数（防篡改同样在校验层强制执行）。
export function parseColorReading(raw: string, deviceType: "black_white" | "color") {
  if (deviceType === "black_white") {
    if (raw && raw !== "0") throw new Error("黑白设备无需填写彩色读数");
    return 0;
  }
  if (!raw) throw new Error("请填写当前彩色读数");
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error("当前彩色读数必须是非负整数");
  return value;
}

function monthIndex(year: number, month: number) {
  return year * 12 + month;
}

function periodLabel(year: number, month: number) {
  return `${year} 年 ${month} 月`;
}

/**
 * 后台手动录入的月份范围校验：允许当前月与历史月份补录；
 * 月份必须落在打印机在役期间内（进场月份 ≤ 抄表月份 ≤ 退场月份），已换机 / 已撤机同样适用。
 * entryDate / exitDate 为 @db.Date（UTC 零点），按 UTC 取年月；now 按服务器本地时间（与抄表窗口一致）。
 */
export function adminReadingPeriodError(
  year: number,
  month: number,
  entryDate: Date,
  exitDate: Date | null,
  now: Date,
): string | null {
  const target = monthIndex(year, month);
  if (target > monthIndex(now.getFullYear(), now.getMonth() + 1)) return "不能录入未来月份的抄表记录。";
  const entry = monthIndex(entryDate.getUTCFullYear(), entryDate.getUTCMonth() + 1);
  if (target < entry) {
    return `该月份早于打印机进场月份（${periodLabel(entryDate.getUTCFullYear(), entryDate.getUTCMonth() + 1)}）。`;
  }
  if (exitDate) {
    const exit = monthIndex(exitDate.getUTCFullYear(), exitDate.getUTCMonth() + 1);
    if (target > exit) {
      return `该月份晚于打印机退场月份（${periodLabel(exitDate.getUTCFullYear(), exitDate.getUTCMonth() + 1)}），已换机 / 已撤机设备只能补录在役期间内的历史抄表。`;
    }
  }
  return null;
}

/** 编辑历史月份时的上界校验：修改后的累计读数不得高于下一期累计读数（BW / 彩色分别校验）。 */
export function nextReadingBoundError(
  current: { bw: number; color: number },
  next: { readingYear: number; readingMonth: number; currentBwReading: number; currentColorReading: number } | null,
): string | null {
  if (!next) return null;
  const label = periodLabel(next.readingYear, next.readingMonth);
  if (current.bw > next.currentBwReading) return `当前黑白读数不能高于下一期（${label}）读数 ${next.currentBwReading}`;
  if (current.color > next.currentColorReading) return `当前彩色读数不能高于下一期（${label}）读数 ${next.currentColorReading}`;
  return null;
}

export type MeterWindow =
  | { phase: "open"; year: number; month: number } // 每月 1-3 日：可提交上一自然月
  | { phase: "before"; year: number; month: number } // 每月 26 日起：本期尚未开放
  | { phase: "closed"; year: number; month: number }; // 每月 4-25 日：本期已关闭

/** 抄表开放窗口：每月 1 日 00:00 至 3 日 23:59:59，提交上一自然月份。 */
export function meterWindow(now: Date): MeterWindow {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  if (day <= 3) return { phase: "open", ...previous };
  if (day >= 26) return { phase: "before", year, month };
  return { phase: "closed", ...previous };
}

/** 当前结算/抄表周期：与 meterWindow 同一业务月份（开放 / 关闭期为上一自然月，月末尚未开放期为当月）。 */
export function currentPeriod(now: Date) {
  const window = meterWindow(now);
  return { year: window.year, month: window.month };
}

/** 由前后读数计算用量；当前读数低于上期读数视为非法。 */
export function computeUsages(previousBw: number, currentBw: number, previousColor: number, currentColor: number) {
  const bwUsage = currentBw - previousBw;
  const colorUsage = currentColor - previousColor;
  if (bwUsage < 0) throw new Error("当前黑白读数不能低于上期读数");
  if (colorUsage < 0) throw new Error("当前彩色读数不能低于上期读数");
  return { bwUsage, colorUsage, bwEquivalentUsage: bwUsage + colorUsage * COLOR_BW_EQUIVALENT };
}

export function meterStatusLabel(status: string) {
  return status === "adjusted" ? "已调整" : "已提交";
}

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

export function values(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key)]));
}
