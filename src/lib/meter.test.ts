import { describe, expect, it } from "vitest";
import { COLOR_BW_EQUIVALENT, computeUsages, currentPeriod, meterAdminUpdateSchema, meterStatusLabel, meterSubmitSchema, meterWindow } from "@/lib/meter";

describe("meterWindow", () => {
  it("每月 1-3 日开放提交上一自然月", () => {
    expect(meterWindow(new Date(2026, 9, 1, 0, 0, 0))).toEqual({ phase: "open", year: 2026, month: 9 });
    expect(meterWindow(new Date(2026, 9, 3, 23, 59, 59))).toEqual({ phase: "open", year: 2026, month: 9 });
  });

  it("1 月开放时业务月份为上一年 12 月", () => {
    expect(meterWindow(new Date(2026, 0, 2))).toEqual({ phase: "open", year: 2025, month: 12 });
  });

  it("每月 4-25 日显示本期已关闭", () => {
    expect(meterWindow(new Date(2026, 9, 4))).toEqual({ phase: "closed", year: 2026, month: 9 });
    expect(meterWindow(new Date(2026, 9, 15))).toEqual({ phase: "closed", year: 2026, month: 9 });
  });

  it("每月 26 日起显示本期尚未开放", () => {
    expect(meterWindow(new Date(2026, 8, 30))).toEqual({ phase: "before", year: 2026, month: 9 });
    expect(meterWindow(new Date(2026, 8, 26))).toEqual({ phase: "before", year: 2026, month: 9 });
  });
});

describe("currentPeriod", () => {
  it("与 meterWindow 同一业务月份", () => {
    expect(currentPeriod(new Date(2026, 9, 2))).toEqual({ year: 2026, month: 9 });
    expect(currentPeriod(new Date(2026, 9, 15))).toEqual({ year: 2026, month: 9 });
    expect(currentPeriod(new Date(2026, 8, 30))).toEqual({ year: 2026, month: 9 });
  });
});

describe("computeUsages", () => {
  it("黑白 8000 + 彩色 300 = 11000 BW Equivalent（10:1 固定规则）", () => {
    const result = computeUsages(2000, 10000, 100, 400);
    expect(result.bwUsage).toBe(8000);
    expect(result.colorUsage).toBe(300);
    expect(result.bwEquivalentUsage).toBe(8000 + 300 * COLOR_BW_EQUIVALENT);
  });

  it("当前读数低于上期读数时抛错", () => {
    expect(() => computeUsages(100, 99, 0, 0)).toThrow("当前黑白读数不能低于上期读数");
    expect(() => computeUsages(0, 0, 50, 49)).toThrow("当前彩色读数不能低于上期读数");
  });

  it("黑白机零用量时等价用量为 0", () => {
    expect(computeUsages(500, 500, 0, 0).bwEquivalentUsage).toBe(0);
  });
});

describe("提交 schema", () => {
  it("黑白读数必填且为非负整数", () => {
    expect(meterSubmitSchema.safeParse({ currentBwReading: "1200", currentColorReading: "" }).success).toBe(true);
    expect(meterSubmitSchema.safeParse({ currentBwReading: "", currentColorReading: "" }).success).toBe(false);
    expect(meterSubmitSchema.safeParse({ currentBwReading: "-1", currentColorReading: "" }).success).toBe(false);
    expect(meterSubmitSchema.safeParse({ currentBwReading: "1.5", currentColorReading: "" }).success).toBe(false);
  });

  it("管理员修改需要备注", () => {
    expect(meterAdminUpdateSchema.safeParse({ currentBwReading: "1200", currentColorReading: "", adminNote: "客户电话报数更正" }).success).toBe(true);
    expect(meterAdminUpdateSchema.safeParse({ currentBwReading: "1200", currentColorReading: "", adminNote: "" }).success).toBe(false);
  });
});

describe("状态标签", () => {
  it("识别已提交与已调整", () => {
    expect(meterStatusLabel("submitted")).toBe("已提交");
    expect(meterStatusLabel("adjusted")).toBe("已调整");
  });
});
