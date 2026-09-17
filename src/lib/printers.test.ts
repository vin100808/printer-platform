import { describe, expect, it } from "vitest";
import { deviceTypeLabel, firstError, hasDeploymentCapacity, newQrToken, printerSchema, printerStatusLabel, printerUpdateSchema } from "@/lib/printers";

const validInput = {
  printerCode: "PRN-001",
  supplierAssetCode: "SA-8888",
  machineModelId: "model-1",
  customerOrderItemId: "coi-1",
  supplierOrderItemId: "soi-1",
  entryDate: "2026-09-17",
  initialBwReading: "1200",
  initialColorReading: "0",
  remark: "",
};

describe("printerSchema", () => {
  it("接受合法输入并转换类型", () => {
    const parsed = printerSchema.safeParse(validInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.initialBwReading).toBe(1200);
      expect(parsed.data.entryDate).toBeInstanceOf(Date);
      expect(parsed.data.remark).toBeNull();
    }
  });

  it("拒绝空打印机编码", () => {
    const parsed = printerSchema.safeParse({ ...validInput, printerCode: "  " });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstError(parsed.error)).toBe("请输入打印机编码");
  });

  it("拒绝空供应商资产编码", () => {
    const parsed = printerSchema.safeParse({ ...validInput, supplierAssetCode: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstError(parsed.error)).toBe("请输入供应商资产编码");
  });

  it("拒绝未选择的订单明细与机型", () => {
    const parsed = printerSchema.safeParse({ ...validInput, machineModelId: "", customerOrderItemId: "", supplierOrderItemId: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstError(parsed.error)).toBe("请选择机型");
  });

  it("拒绝非整数与负数的初始读数", () => {
    const negative = printerSchema.safeParse({ ...validInput, initialBwReading: "-1" });
    expect(negative.success).toBe(false);
    if (!negative.success) expect(firstError(negative.error)).toBe("黑白初始读数不能为负数");
    const fraction = printerSchema.safeParse({ ...validInput, initialColorReading: "1.5" });
    expect(fraction.success).toBe(false);
    if (!fraction.success) expect(firstError(fraction.error)).toBe("彩色初始读数必须是整数");
  });

  it("拒绝缺失进场日期", () => {
    const parsed = printerSchema.safeParse({ ...validInput, entryDate: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstError(parsed.error)).toBe("请选择进场日期");
  });

  it("编辑模式不需要订单明细", () => {
    const editInput = {
      printerCode: validInput.printerCode,
      supplierAssetCode: validInput.supplierAssetCode,
      machineModelId: validInput.machineModelId,
      entryDate: validInput.entryDate,
      initialBwReading: validInput.initialBwReading,
      initialColorReading: validInput.initialColorReading,
      remark: validInput.remark,
    };
    expect(printerUpdateSchema.safeParse(editInput).success).toBe(true);
  });
});

describe("newQrToken", () => {
  it("生成 URL 安全且不重复的 token", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newQrToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hasDeploymentCapacity", () => {
  it("已部署小于数量时仍有容量", () => {
    expect(hasDeploymentCapacity(0, 2)).toBe(true);
    expect(hasDeploymentCapacity(1, 2)).toBe(true);
    expect(hasDeploymentCapacity(2, 2)).toBe(false);
  });
});

describe("标签完整性", () => {
  it("打印机状态与设备类型标签覆盖全部枚举值", () => {
    expect(Object.keys(printerStatusLabel).sort()).toEqual(["active", "draft", "removed", "replaced"]);
    expect(Object.values(printerStatusLabel)).toContain("运行中");
    expect(Object.keys(deviceTypeLabel).sort()).toEqual(["black_white", "color"]);
  });
});
