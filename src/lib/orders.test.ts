import { describe, expect, it } from "vitest";
import { customerOrderSchema, computeDepositAmount, defaultEndDate, deploymentStatus, nextOrderNo, parseOrderItems, supplierOrderSchema } from "./orders";

function formDataOf(entries: Record<string, string[]>) {
  const formData = new FormData();
  for (const [key, values] of Object.entries(entries)) {
    for (const value of values) formData.append(key, value);
  }
  return formData;
}

describe("TASK 04 order validation", () => {
  it("accepts a valid customer order header without an orderNo field", () => {
    const result = customerOrderSchema.safeParse({ orderNo: "IGNORED-0001", customerId: "c1", locationId: "l1", customerContractId: "ct1", orderDate: "2026-09-16", status: "draft", remark: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("orderNo");
  });

  it("requires location, contract and order date on customer orders", () => {
    const base = { customerId: "c1", locationId: "l1", customerContractId: "ct1", orderDate: "2026-09-16", status: "draft", remark: "" };
    expect(customerOrderSchema.safeParse({ ...base, locationId: "" }).success).toBe(false);
    expect(customerOrderSchema.safeParse({ ...base, customerContractId: "" }).success).toBe(false);
    expect(customerOrderSchema.safeParse({ ...base, orderDate: "" }).success).toBe(false);
  });

  it("accepts only valid order statuses", () => {
    const base = { supplierId: "s1", supplierContractId: "ct1", orderDate: "2026-09-16", status: "draft", remark: "" };
    expect(supplierOrderSchema.safeParse({ ...base, status: "confirmed" }).success).toBe(true);
    expect(supplierOrderSchema.safeParse({ ...base, status: "unknown" }).success).toBe(false);
  });

  it("generates daily order numbers shared across customer and supplier orders", () => {
    const day = new Date(2026, 8, 16); // 2026-09-16 本地时间
    expect(nextOrderNo(day, [])).toBe("2026091601");
    expect(nextOrderNo(day, ["2026091601"])).toBe("2026091602");
    // 客户订单与供应商订单共用同一序列：两侧编号一起参与排序
    expect(nextOrderNo(day, ["2026091601", "2026091602"])).toBe("2026091603");
    // 其他日期与不符合规则的编号不影响当日序号
    expect(nextOrderNo(day, ["2026091509", "CO-OLD-1", ""])).toBe("2026091601");
    // 已删除订单的编号不复用
    expect(nextOrderNo(day, ["2026091601", "2026091603"])).toBe("2026091604");
    // 序号自然增长超过两位
    expect(nextOrderNo(day, ["2026091699"])).toBe("20260916100");
  });

  it("parses multi-row order items and skips fully empty rows", () => {
    const formData = formDataOf({
      itemPackageId: ["p1", "", "p2"],
      itemQuantity: ["2", "", "1"],
      itemPlannedEntryDate: ["2026-10-01", "", "2026-10-15"],
      itemRemark: ["首批", "", ""],
    });
    const result = parseOrderItems(formData);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({ packageId: "p1", quantity: 2, plannedEntryDate: new Date("2026-10-01"), remark: "首批" });
      expect(result.items[1]).toMatchObject({ packageId: "p2", quantity: 1, plannedEntryDate: new Date("2026-10-15"), remark: null });
    }
  });

  it("requires a planned entry date on every filled item row", () => {
    const missing = parseOrderItems(formDataOf({ itemPackageId: ["p1"], itemQuantity: ["1"], itemPlannedEntryDate: [""] }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain("计划进场日期");
  });

  it("rejects orders without any item and rows with invalid quantity", () => {
    const empty = parseOrderItems(formDataOf({ itemPackageId: [""], itemQuantity: [""] }));
    expect(empty).toMatchObject({ ok: false, error: "请至少添加一个订单明细" });

    const badQuantity = parseOrderItems(formDataOf({ itemPackageId: ["p1"], itemQuantity: ["0"] }));
    expect(badQuantity.ok).toBe(false);
    if (!badQuantity.ok) expect(badQuantity.error).toContain("第 1 行明细");

    const fractional = parseOrderItems(formDataOf({ itemPackageId: ["p1"], itemQuantity: ["1.5"] }));
    expect(fractional.ok).toBe(false);
  });

  it("computes deployment status dynamically", () => {
    expect(deploymentStatus(0, 2)).toBe("未部署");
    expect(deploymentStatus(1, 2)).toBe("部分部署");
    expect(deploymentStatus(2, 2)).toBe("已部署");
  });

  it("computes deposit as total quantity × 2000", () => {
    expect(computeDepositAmount(0)).toBe(0);
    expect(computeDepositAmount(1)).toBe(2000);
    // A3 × 2 + A4 × 3 = 5 台 → 10000
    expect(computeDepositAmount(5)).toBe(10000);
    expect(() => computeDepositAmount(1.5)).toThrow();
    expect(() => computeDepositAmount(-1)).toThrow();
  });

  it("defaults endDate to startDate + 3 years - 1 day", () => {
    expect(defaultEndDate(new Date(Date.UTC(2026, 9, 1)))).toEqual(new Date(Date.UTC(2029, 8, 30)));
    expect(defaultEndDate(new Date(Date.UTC(2026, 0, 1)))).toEqual(new Date(Date.UTC(2029, 0, 0)));
    // 闰日起点不崩溃
    expect(defaultEndDate(new Date(Date.UTC(2028, 1, 29)))).toEqual(new Date(Date.UTC(2031, 1, 28)));
  });
});
