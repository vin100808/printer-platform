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
