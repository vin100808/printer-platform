import { describe, expect, it } from "vitest";
import { activeDaysInMonth, computeSettlement, computeSettlementOptionalSupplier, computeSettlementSide, daysInMonth, summarizeOrderSettlements } from "@/lib/settlement";

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

describe("computeSettlementOptionalSupplier", () => {
  const base = {
    year: 2026,
    month: 9,
    entryDate: d("2026-09-20"),
    exitDate: null,
    bwUsage: 8000,
    colorUsage: 300,
    bwEquivalentUsage: 11000,
    customerPackage: { monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03" },
  };

  it("供应商套餐缺失时客户侧照常计算，供应商与毛利为 null", () => {
    const result = computeSettlementOptionalSupplier({ ...base, supplierPackage: null });
    if (!result) throw new Error("不应为 null");
    expect(result.customer.monthlyAmount.toString()).toBe("385");
    expect(result.supplier).toBeNull();
    expect(result.operatingGrossProfit).toBeNull();
  });

  it("供应商套餐存在时与 computeSettlement 结果一致", () => {
    const supplierPackage = { monthlyRent: "400", monthlyFreeBwEquivalent: "16000", overageRateBwEquivalent: "0.03" };
    const flexible = computeSettlementOptionalSupplier({ ...base, supplierPackage });
    const strict = computeSettlement({ ...base, supplierPackage });
    if (!flexible || !strict) throw new Error("不应为 null");
    expect(flexible.customer.monthlyAmount.toString()).toBe(strict.customer.monthlyAmount.toString());
    expect(flexible.supplier?.monthlyAmount.toString()).toBe(strict.supplier.monthlyAmount.toString());
    expect(flexible.operatingGrossProfit?.toString()).toBe(strict.operatingGrossProfit.toString());
  });

  it("当月不在场仍返回 null", () => {
    expect(computeSettlementOptionalSupplier({ ...base, supplierPackage: null, entryDate: d("2026-10-01") })).toBeNull();
  });
});

describe("summarizeOrderSettlements", () => {
  const terms = { monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03" };
  const supplierTerms = { monthlyRent: "400", monthlyFreeBwEquivalent: "16000", overageRateBwEquivalent: "0.03" };
  const printerResult = (overrides: Partial<Parameters<typeof computeSettlementOptionalSupplier>[0]>) =>
    computeSettlementOptionalSupplier({
      year: 2026,
      month: 9,
      entryDate: d("2026-09-20"),
      exitDate: null,
      bwUsage: 8000,
      colorUsage: 300,
      bwEquivalentUsage: 11000,
      customerPackage: terms,
      supplierPackage: supplierTerms,
      ...overrides,
    });

  it("空结果返回 null", () => {
    expect(summarizeOrderSettlements([])).toBeNull();
  });

  it("取最近业务月份并汇总双侧金额与毛利", () => {
    const older = printerResult({ year: 2026, month: 8, entryDate: d("2026-08-10"), bwUsage: 5000, colorUsage: 0, bwEquivalentUsage: 5000 });
    const a = printerResult({});
    const b = printerResult({});
    if (!older || !a || !b) throw new Error("不应为 null");
    const summary = summarizeOrderSettlements([older, a, b]);
    if (!summary) throw new Error("不应为 null");
    expect(summary.year).toBe(2026);
    expect(summary.month).toBe(9);
    expect(summary.printerCount).toBe(2);
    expect(summary.customerAmount.toString()).toBe("770"); // 385 × 2
    expect(summary.supplierAmount?.toString()).toBe("601.34"); // 300.67 × 2
    expect(summary.operatingGrossProfit?.toString()).toBe("168.66");
  });

  it("跨月取最新：8 月更早的结果不参与汇总", () => {
    const latest = printerResult({});
    const stale = printerResult({ year: 2026, month: 8, entryDate: d("2026-08-10") });
    if (!latest || !stale) throw new Error("不应为 null");
    const summary = summarizeOrderSettlements([latest, stale]);
    if (!summary) throw new Error("不应为 null");
    expect(summary.month).toBe(9);
    expect(summary.printerCount).toBe(1);
    expect(summary.customerAmount.toString()).toBe("385");
  });

  it("任一打印机缺供应商侧价格时：客户侧照常汇总，应付与毛利为 null", () => {
    const full = printerResult({});
    const withoutSupplier = printerResult({ supplierPackage: null });
    if (!full || !withoutSupplier) throw new Error("不应为 null");
    const summary = summarizeOrderSettlements([full, withoutSupplier]);
    if (!summary) throw new Error("不应为 null");
    expect(summary.customerAmount.toString()).toBe("770");
    expect(summary.supplierAmount).toBeNull();
    expect(summary.operatingGrossProfit).toBeNull();
  });

  it("金额四舍五入：非整除月租逐台计算后汇总", () => {
    const odd = printerResult({ bwUsage: 0, colorUsage: 0, bwEquivalentUsage: 0 }); // 只有折算月租 165
    const even = printerResult({});
    if (!odd || !even) throw new Error("不应为 null");
    const summary = summarizeOrderSettlements([odd, even]);
    if (!summary) throw new Error("不应为 null");
    expect(summary.customerAmount.toString()).toBe("550"); // 165 + 385
  });
});
