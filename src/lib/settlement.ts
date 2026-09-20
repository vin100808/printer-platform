import Decimal from "decimal.js";

const DAY_MS = 86_400_000;

// 金额统一保留两位小数（HALF_UP）；额度/超印量保留两位小数；不使用浮点数。
const money2 = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const quota2 = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

// 以 UTC 日历日对齐 @db.Date 存储，避免时区漂移。
function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 机器在指定自然月的在场天数：进场当天计入，退场当天不计入（已撤走不再计费）。
 * 进场晚于当月或未进场返回 0；退场早于月初返回 0。
 */
export function activeDaysInMonth(year: number, month: number, entryDate: Date, exitDate: Date | null) {
  const days = daysInMonth(year, month);
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month - 1, days);
  const from = Math.max(monthStart, utcDay(entryDate));
  const to = Math.min(monthEnd, exitDate ? utcDay(exitDate) - DAY_MS : monthEnd);
  if (to < from) return 0;
  return Math.round((to - from) / DAY_MS) + 1;
}

export interface PackageTerms {
  monthlyRent: Decimal.Value;
  monthlyFreeBwEquivalent: Decimal.Value;
  overageRateBwEquivalent: Decimal.Value;
}

export interface SettlementSide {
  actualMonthlyRent: Decimal;
  actualFreeQuota: Decimal;
  overageUsage: Decimal;
  overageFee: Decimal;
  monthlyAmount: Decimal;
}

/** 单侧（客户或供应商）结算：月租与免费额度按在场天数折算，超印量 = MAX(等价用量 - 折算额度, 0)。 */
export function computeSettlementSide(terms: PackageTerms, activeDays: number, dim: number, bwEquivalentUsage: Decimal.Value): SettlementSide {
  const divisor = new Decimal(dim);
  const actualMonthlyRent = money2(new Decimal(terms.monthlyRent).mul(activeDays).div(divisor));
  const actualFreeQuota = quota2(new Decimal(terms.monthlyFreeBwEquivalent).mul(activeDays).div(divisor));
  const overageUsage = quota2(Decimal.max(new Decimal(bwEquivalentUsage).sub(actualFreeQuota), 0));
  const overageFee = money2(overageUsage.mul(new Decimal(terms.overageRateBwEquivalent)));
  return { actualMonthlyRent, actualFreeQuota, overageUsage, overageFee, monthlyAmount: actualMonthlyRent.add(overageFee) };
}

export interface SettlementInput {
  year: number;
  month: number;
  entryDate: Date;
  exitDate: Date | null;
  bwUsage: Decimal.Value;
  colorUsage: Decimal.Value;
  bwEquivalentUsage: Decimal.Value;
  customerPackage: PackageTerms;
  supplierPackage: PackageTerms;
}

export interface SettlementResult {
  year: number;
  month: number;
  daysInMonth: number;
  activeDays: number;
  bwUsage: Decimal;
  colorUsage: Decimal;
  bwEquivalentUsage: Decimal;
  customer: SettlementSide;
  supplier: SettlementSide;
  /** 毛利 = 客户应收 - 供应商应付 */
  operatingGrossProfit: Decimal;
}

export interface OptionalSupplierSettlementResult extends Omit<SettlementResult, "supplier" | "operatingGrossProfit"> {
  supplier: SettlementSide | null;
  operatingGrossProfit: Decimal | null;
}

/**
 * 供应商侧价格可能缺失（新流程不再强制 SupplierOrder/SupplierPackage）。
 * 客户侧照常计算；supplier 为 null 时运营毛利为 null（暂不可计算），不得因此报错或阻塞。
 */
export function computeSettlementOptionalSupplier(
  input: Omit<SettlementInput, "supplierPackage"> & { supplierPackage: PackageTerms | null },
): OptionalSupplierSettlementResult | null {
  const activeDays = activeDaysInMonth(input.year, input.month, input.entryDate, input.exitDate);
  if (activeDays <= 0) return null;
  const dim = daysInMonth(input.year, input.month);
  const customer = computeSettlementSide(input.customerPackage, activeDays, dim, input.bwEquivalentUsage);
  const supplier = input.supplierPackage
    ? computeSettlementSide(input.supplierPackage, activeDays, dim, input.bwEquivalentUsage)
    : null;
  return {
    year: input.year,
    month: input.month,
    daysInMonth: dim,
    activeDays,
    bwUsage: new Decimal(input.bwUsage),
    colorUsage: new Decimal(input.colorUsage),
    bwEquivalentUsage: new Decimal(input.bwEquivalentUsage),
    customer,
    supplier,
    operatingGrossProfit: supplier ? money2(customer.monthlyAmount.sub(supplier.monthlyAmount)) : null,
  };
}

export interface OrderSettlementSummary {
  year: number;
  month: number;
  /** 参与该月汇总的打印机台数 */
  printerCount: number;
  customerAmount: Decimal;
  /** 任一打印机缺供应商侧价格时为 null（不可汇总应付与毛利） */
  supplierAmount: Decimal | null;
  operatingGrossProfit: Decimal | null;
}

/**
 * 订单结算摘要：取各打印机结算结果中最近的一个业务月份，汇总该月各打印机的金额。
 * 无有效结果（全部当月不在场或无抄表）返回 null；供应商侧缺失的打印机不阻塞客户侧合计。
 */
export function summarizeOrderSettlements(results: OptionalSupplierSettlementResult[]): OrderSettlementSummary | null {
  if (!results.length) return null;
  const latest = results.reduce(
    (acc, result) => (result.year > acc.year || (result.year === acc.year && result.month > acc.month) ? { year: result.year, month: result.month } : acc),
    { year: results[0].year, month: results[0].month },
  );
  const inMonth = results.filter((result) => result.year === latest.year && result.month === latest.month);
  const customerAmount = money2(inMonth.reduce((sum, result) => sum.add(result.customer.monthlyAmount), new Decimal(0)));
  const supplierAmount = inMonth.every((result) => result.supplier)
    ? money2(inMonth.reduce((sum, result) => sum.add(result.supplier!.monthlyAmount), new Decimal(0)))
    : null;
  return {
    year: latest.year,
    month: latest.month,
    printerCount: inMonth.length,
    customerAmount,
    supplierAmount,
    operatingGrossProfit: supplierAmount ? money2(customerAmount.sub(supplierAmount)) : null,
  };
}

/** 整月结算：当月不在场（0 天）返回 null，不产生金额。 */
export function computeSettlement(input: SettlementInput): SettlementResult | null {
  const activeDays = activeDaysInMonth(input.year, input.month, input.entryDate, input.exitDate);
  if (activeDays <= 0) return null;
  const dim = daysInMonth(input.year, input.month);
  const customer = computeSettlementSide(input.customerPackage, activeDays, dim, input.bwEquivalentUsage);
  const supplier = computeSettlementSide(input.supplierPackage, activeDays, dim, input.bwEquivalentUsage);
  return {
    year: input.year,
    month: input.month,
    daysInMonth: dim,
    activeDays,
    bwUsage: new Decimal(input.bwUsage),
    colorUsage: new Decimal(input.colorUsage),
    bwEquivalentUsage: new Decimal(input.bwEquivalentUsage),
    customer,
    supplier,
    operatingGrossProfit: money2(customer.monthlyAmount.sub(supplier.monthlyAmount)),
  };
}
