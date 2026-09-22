import { describe, expect, it } from "vitest";
import { COLOR_BW_EQUIVALENT, adminReadingPeriodError, computeUsages, currentPeriod, meterAdminCreateSchema, meterAdminUpdateSchema, meterStatusLabel, meterSubmitSchema, meterWindow, nextReadingBoundError, parseColorReading } from "@/lib/meter";

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

describe("TASK 19 后台手动抄表", () => {
  describe("meterAdminCreateSchema", () => {
    it("年月与黑白读数必填，备注可选", () => {
      expect(meterAdminCreateSchema.safeParse({ readingYear: "2026", readingMonth: "8", currentBwReading: "1200", currentColorReading: "", adminNote: "" }).success).toBe(true);
      expect(meterAdminCreateSchema.safeParse({ readingYear: "2026", readingMonth: "8", currentBwReading: "1200", currentColorReading: "", adminNote: "电话报数补录" }).success).toBe(true);
      expect(meterAdminCreateSchema.safeParse({ readingYear: "1999", readingMonth: "8", currentBwReading: "1200", currentColorReading: "", adminNote: "" }).success).toBe(false);
      expect(meterAdminCreateSchema.safeParse({ readingYear: "2026", readingMonth: "13", currentBwReading: "1200", currentColorReading: "", adminNote: "" }).success).toBe(false);
      expect(meterAdminCreateSchema.safeParse({ readingYear: "2026", readingMonth: "0", currentBwReading: "1200", currentColorReading: "", adminNote: "" }).success).toBe(false);
      expect(meterAdminCreateSchema.safeParse({ readingYear: "2026", readingMonth: "8", currentBwReading: "", currentColorReading: "", adminNote: "" }).success).toBe(false);
    });
  });

  describe("parseColorReading", () => {
    it("黑白机不要求彩色读数且禁止填报", () => {
      expect(parseColorReading("", "black_white")).toBe(0);
      expect(parseColorReading("0", "black_white")).toBe(0);
      expect(() => parseColorReading("5", "black_white")).toThrow("黑白设备无需填写彩色读数");
    });

    it("彩色机必须填写非负整数彩色读数", () => {
      expect(parseColorReading("120", "color")).toBe(120);
      expect(() => parseColorReading("", "color")).toThrow("请填写当前彩色读数");
      expect(() => parseColorReading("1.5", "color")).toThrow("当前彩色读数必须是非负整数");
    });
  });

  describe("adminReadingPeriodError", () => {
    const entry = new Date("2026-06-01");
    it("不受客户 QR 每月 1-3 日窗口限制：窗口关闭日也可补录历史月份", () => {
      // 2026-09-15 对客户 QR 而言是「本期已关闭」，但管理员可补录 2026-08 及更早月份。
      expect(adminReadingPeriodError(2026, 8, entry, null, new Date(2026, 8, 15))).toBeNull();
      expect(adminReadingPeriodError(2026, 6, entry, null, new Date(2026, 8, 15))).toBeNull();
      // 当前月份同样允许。
      expect(adminReadingPeriodError(2026, 9, entry, null, new Date(2026, 8, 15))).toBeNull();
    });

    it("拒绝未来月份", () => {
      expect(adminReadingPeriodError(2026, 10, entry, null, new Date(2026, 8, 22))).toContain("未来月份");
      expect(adminReadingPeriodError(2027, 1, entry, null, new Date(2026, 11, 31))).toContain("未来月份");
    });

    it("拒绝早于进场月份的补录", () => {
      expect(adminReadingPeriodError(2026, 5, entry, null, new Date(2026, 8, 22))).toContain("早于打印机进场月份");
      expect(adminReadingPeriodError(2026, 6, entry, null, new Date(2026, 8, 22))).toBeNull();
    });

    it("已撤机 / 已换机设备允许补录在役期间内的历史月份，拒绝退场之后", () => {
      const exit = new Date("2026-08-15");
      expect(adminReadingPeriodError(2026, 7, entry, exit, new Date(2026, 8, 22))).toBeNull();
      expect(adminReadingPeriodError(2026, 8, entry, exit, new Date(2026, 8, 22))).toBeNull();
      expect(adminReadingPeriodError(2026, 9, entry, exit, new Date(2026, 8, 22))).toContain("晚于打印机退场月份");
    });
  });

  describe("nextReadingBoundError", () => {
    const next = { readingYear: 2026, readingMonth: 10, currentBwReading: 20000, currentColorReading: 500 };
    it("修改后的读数不得高于下一期", () => {
      expect(nextReadingBoundError({ bw: 20001, color: 500 }, next)).toContain("不能高于下一期");
      expect(nextReadingBoundError({ bw: 20000, color: 501 }, next)).toContain("不能高于下一期");
      expect(nextReadingBoundError({ bw: 20000, color: 500 }, next)).toBeNull();
      expect(nextReadingBoundError({ bw: 15000, color: 300 }, next)).toBeNull();
    });

    it("没有下一期时不做上界校验", () => {
      expect(nextReadingBoundError({ bw: 999999, color: 999 }, null)).toBeNull();
    });
  });
});
