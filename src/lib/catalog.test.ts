import { describe, expect, it } from "vitest";
import {
  customerPackageSchema,
  customerPackageUpdateSchema,
  machineModelSchema,
  nextVersion,
  supplierPackageSchema,
} from "./catalog";

const validCustomerPackage = {
  packageCode: "CP-A",
  packageName: "彩色标准套餐 A",
  monthlyRent: "450",
  monthlyFreeBwEquivalent: "16000",
  overageRateBwEquivalent: "0.03",
  customerId: "",
  effectiveFrom: "2026-09-01",
  status: "active",
  remark: "",
};

describe("TASK 03 catalog validation", () => {
  it("accepts the acceptance-example customer package", () => {
    const result = customerPackageSchema.safeParse(validCustomerPackage);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customerId).toBeNull();
  });

  it("treats an empty customerId as the standard package", () => {
    const result = customerPackageSchema.parse({ ...validCustomerPackage, customerId: "" });
    expect(result.customerId).toBeNull();
  });

  it("rejects empty or non-numeric prices", () => {
    for (const monthlyRent of ["", "abc", "-1"]) {
      const result = customerPackageSchema.safeParse({ ...validCustomerPackage, monthlyRent });
      expect(result.success).toBe(false);
    }
  });

  it("rejects prices exceeding their decimal precision", () => {
    expect(customerPackageSchema.safeParse({ ...validCustomerPackage, monthlyRent: "450.999" }).success).toBe(false);
    expect(customerPackageSchema.safeParse({ ...validCustomerPackage, overageRateBwEquivalent: "0.03001" }).success).toBe(false);
    expect(customerPackageSchema.safeParse({ ...validCustomerPackage, overageRateBwEquivalent: "0.025" }).success).toBe(true);
  });

  it("requires effectiveFrom and a supplier for supplier packages", () => {
    const supplierBase = { ...validCustomerPackage, supplierId: "" } as Record<string, string>;
    delete supplierBase.customerId;
    expect(supplierPackageSchema.safeParse(supplierBase).success).toBe(false);
    expect(supplierPackageSchema.safeParse({ ...supplierBase, supplierId: "s1" }).success).toBe(true);
    expect(
      supplierPackageSchema.safeParse({ ...supplierBase, supplierId: "s1", effectiveFrom: "" }).success,
    ).toBe(false);
  });

  it("validates machine model deviceType", () => {
    const base = { brand: "富士胶片", modelName: "Apeos C3570", deviceType: "color", status: "active", remark: "" };
    expect(machineModelSchema.safeParse(base).success).toBe(true);
    expect(machineModelSchema.safeParse({ ...base, deviceType: "laser" }).success).toBe(false);
  });

  it("update schemas freeze prices, code and ownership", () => {
    expect(customerPackageUpdateSchema.safeParse({ ...validCustomerPackage, monthlyRent: "999" }).success).toBe(true);
    const fields = Object.keys(customerPackageUpdateSchema.shape);
    expect(fields).not.toContain("monthlyRent");
    expect(fields).not.toContain("packageCode");
    expect(fields).not.toContain("customerId");
  });

  it("computes the next package version from existing versions", () => {
    expect(nextVersion([])).toBe(1);
    expect(nextVersion([1])).toBe(2);
    expect(nextVersion([1, 3, 2])).toBe(4);
  });
});
