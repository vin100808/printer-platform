import { describe, expect, it } from "vitest";
import { activeDaysInMonth, computeSettlement, computeSettlementSide, daysInMonth } from "@/lib/settlement";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("activeDaysInMonth", () => {
  it("9 月 20 日进场，9 月在场 11 天（进场日计入）", () => {
    expect(activeDaysInMonth(2026, 9, d("2026-09-20"), null)).toBe(11);
    expect(daysInMonth(2026, 9)).toBe(30);
  });

  it("进场早于月初则整月在场", () => {
    expect(activeDaysInMonth(2026, 9, d("2026-08-31"), null)).toBe(30);
  });

  it("退场当天不计入", () => {
    expect(activeDaysInMonth(2026, 9, d("2026-09-20"), d("2026-09-25"))).toBe(5); // 20-24
  });

  it("退场早于月初或进场晚于月末为 0 天", () => {
    expect(activeDaysInMonth(2026, 9, d("2026-08-01"), d("2026-08-31"))).toBe(0);
    expect(activeDaysInMonth(2026, 9, d("2026-10-01"), null)).toBe(0);
  });

  it("2 月跨月计算正确", () => {
    expect(activeDaysInMonth(2026, 2, d("2026-02-01"), null)).toBe(28);
  });
});

describe("computeSettlementSide", () => {
  it("文档验收示例：450 × 11 / 30 = 165", () => {
    const side = computeSettlementSide({ monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03" }, 11, 30, 11000);
    expect(side.actualMonthlyRent.toString()).toBe("165");
    expect(side.actualFreeQuota.toString()).toBe("3666.67");
    expect(side.overageUsage.toString()).toBe("7333.33");
    expect(side.overageFee.toString()).toBe("220");
    expect(side.monthlyAmount.toString()).toBe("385");
  });

  it("用量不超过折算额度时超印为 0", () => {
    const side = computeSettlementSide({ monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03" }, 30, 30, 9000);
    expect(side.actualFreeQuota.toString()).toBe("10000");
    expect(side.overageUsage.toString()).toBe("0");
    expect(side.overageFee.toString()).toBe("0");
    expect(side.monthlyAmount.toString()).toBe("450");
  });

  it("非整除月租四舍五入到两位小数", () => {
    const side = computeSettlementSide({ monthlyRent: "100", monthlyFreeBwEquivalent: "100", overageRateBwEquivalent: "0.03" }, 11, 30, 0);
    expect(side.actualMonthlyRent.toString()).toBe("36.67");
  });
});

describe("computeSettlement", () => {
  const base = {
    year: 2026,
    month: 9,
    entryDate: d("2026-09-20"),
    exitDate: null,
    bwUsage: 8000,
    colorUsage: 300,
    bwEquivalentUsage: 11000,
    customerPackage: { monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03" },
    supplierPackage: { monthlyRent: "400", monthlyFreeBwEquivalent: "16000", overageRateBwEquivalent: "0.03" },
  };

  it("文档验收示例：客户应收 385，供应商应付 146.67，毛利 238.33", () => {
    const result = computeSettlement(base);
    if (!result) throw new Error("不应为 null");
    expect(result.activeDays).toBe(11);
    expect(result.bwEquivalentUsage.toString()).toBe("11000");
    expect(result.customer.monthlyAmount.toString()).toBe("385"); // 165 + 220
    expect(result.supplier.actualMonthlyRent.toString()).toBe("146.67"); // 400×11/30
    expect(result.supplier.actualFreeQuota.toString()).toBe("5866.67"); // 16000×11/30
    expect(result.supplier.overageUsage.toString()).toBe("5133.33");
    expect(result.supplier.overageFee.toString()).toBe("154"); // 5133.33×0.03
    expect(result.supplier.monthlyAmount.toString()).toBe("300.67");
    expect(result.operatingGrossProfit.toString()).toBe("84.33"); // 385 - 300.67
  });

  it("当月不在场返回 null", () => {
    expect(computeSettlement({ ...base, entryDate: d("2026-10-01") })).toBeNull();
    expect(computeSettlement({ ...base, exitDate: d("2026-08-31") })).toBeNull();
  });
});
