import { describe, expect, it } from "vitest";
import { customerOrderCreateSchema, customerOrderSchema, computeDepositAmount, defaultEndDate, deploymentStatus, nextOrderNo, orderUpdateSchema, parseOrderItems, supplierOrderSchema } from "./orders";

function formDataOf(entries: Record<string, string[]>) {
  const formData = new FormData();
  for (const [key, values] of Object.entries(entries)) {
    for (const value of values) formData.append(key, value);
  }
  return formData;
}

describe("TASK 04 order validation", () => {
  it("accepts a valid customer order header without an orderNo field", () => {
    const result = customerOrderSchema.safeParse({ orderNo: "IGNORED-0001", customerId: "c1", supplierId: "s1", installationAddress: "上海市浦东新区张江高科技园区", startDate: "2026-10-01", orderDate: "2026-09-16", billingCycle: "monthly", status: "draft", remark: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("orderNo");
  });

  it("requires supplier, installation address, start date and a valid billing cycle", () => {
    const base = { customerId: "c1", supplierId: "s1", installationAddress: "上海市浦东新区张江高科技园区", startDate: "2026-10-01", orderDate: "2026-09-16", billingCycle: "monthly", status: "draft", remark: "" };
    expect(customerOrderSchema.safeParse({ ...base, supplierId: "" }).success).toBe(false);
    expect(customerOrderSchema.safeParse({ ...base, installationAddress: "" }).success).toBe(false);
    expect(customerOrderSchema.safeParse({ ...base, installationAddress: "  " }).success).toBe(false);
    expect(customerOrderSchema.safeParse({ ...base, startDate: "" }).success).toBe(false);
    expect(customerOrderSchema.safeParse({ ...base, billingCycle: "yearly" }).success).toBe(false);
  });

  it("rejects an endDate earlier than startDate and accepts an omitted endDate", () => {
    const base = { customerId: "c1", supplierId: "s1", installationAddress: "上海市浦东新区张江高科技园区", startDate: "2026-10-01", orderDate: "2026-09-16", billingCycle: "monthly", status: "draft", remark: "" };
    const reversed = customerOrderSchema.safeParse({ ...base, endDate: "2026-09-30" });
    expect(reversed.success).toBe(false);
    if (!reversed.success) expect(reversed.error.issues[0]?.message).toBe("结束日期不能早于开始日期");
    expect(customerOrderSchema.safeParse({ ...base, endDate: "2026-10-01" }).success).toBe(true);
    expect(customerOrderSchema.safeParse(base).success).toBe(true);
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

  it("preserves itemId per row when present and defaults it to undefined", () => {
    const formData = formDataOf({
      itemId: ["id-1", "id-2", ""],
      itemPackageId: ["p1", "p2", "p3"],
      itemQuantity: ["2", "1", "1"],
      itemPlannedEntryDate: ["2026-10-01", "2026-10-15", "2026-11-01"],
      itemRemark: ["", "", ""],
    });
    const result = parseOrderItems(formData);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toMatchObject({ itemId: "id-1", packageId: "p1" });
      expect(result.items[1]).toMatchObject({ itemId: "id-2", packageId: "p2" });
      expect(result.items[2]).toMatchObject({ packageId: "p3" });
      expect(result.items[2].itemId).toBeUndefined();
    }
    // 旧调用没有 itemId 字段时照常工作
    const legacy = parseOrderItems(formDataOf({ itemPackageId: ["p1"], itemQuantity: ["1"], itemPlannedEntryDate: ["2026-10-01"] }));
    expect(legacy.ok).toBe(true);
    if (legacy.ok) expect(legacy.items[0].itemId).toBeUndefined();
  });

  it("does not require a planned entry date on item rows", () => {
    // TASK 21A：计划进场日期退出日常维护，普通流程存 null。
    const missing = parseOrderItems(formDataOf({ itemPackageId: ["p1"], itemQuantity: ["1"], itemPlannedEntryDate: [""] }));
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.items[0].plannedEntryDate).toBeNull();

    const omitted = parseOrderItems(formDataOf({ itemPackageId: ["p1"], itemQuantity: ["1"] }));
    expect(omitted.ok).toBe(true);
    if (omitted.ok) expect(omitted.items[0].plannedEntryDate).toBeNull();
  });

  it("new-order schema ignores status and update schema omits it", () => {
    // TASK 21A：新建订单不接受表单状态（服务端强制 confirmed）；编辑不通过表单改状态。
    const base = { customerId: "c1", supplierId: "s1", installationAddress: "上海市浦东新区张江高科技园区", startDate: "2026-10-01", orderDate: "2026-09-16", billingCycle: "monthly", remark: "" };
    const created = customerOrderCreateSchema.safeParse(base);
    expect(created.success).toBe(true);
    if (created.success) expect(created.data).not.toHaveProperty("status");

    const updated = orderUpdateSchema.safeParse({ ...base, status: "cancelled" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data).not.toHaveProperty("status");
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
