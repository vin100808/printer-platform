import { describe, expect, it } from "vitest";
import { contractSchema, customerInputSchema, customerSchema, locationSchema } from "./master-data";

describe("TASK 02 master data validation", () => {
  it("accepts a valid customer and normalizes empty optional values", () => {
    const result = customerSchema.parse({ customerCode: "C001", customerName: "客户 A", customerType: "external", taxpayerIdentificationNo: "", registeredAddress: "", bankName: "", bankAccountName: "", bankAccountNo: "", contactName: "", contactPhone: "", status: "active", remark: "" });
    expect(result.registeredAddress).toBeNull();
  });

  it("customer form input no longer carries a business status", () => {
    // TASK 21A：Customer 无业务状态，表单不提交 status，新建由服务端固定为 active。
    const result = customerInputSchema.safeParse({ customerName: "客户 A", customerType: "external", status: "inactive", remark: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("status");
  });

  it("requires an actual deployment address for a location", () => {
    const result = locationSchema.safeParse({ locationCode: "L001", locationName: "总部", address: "", contactName: "", contactPhone: "", status: "active", remark: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a contract whose expiry precedes its effective date", () => {
    const result = contractSchema.safeParse({ contractNo: "HT-001", contractName: "框架合同", effectiveDate: "2026-09-16", expiryDate: "2026-09-15", status: "active", remark: "" });
    expect(result.success).toBe(false);
  });
});
