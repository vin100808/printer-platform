import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeUsages } from "@/lib/meter";
import { newQrToken } from "@/lib/printers";
import { computeSettlement } from "@/lib/settlement";
import { prisma } from "@/lib/prisma";

// 数据库未运行时（如未启动 Docker）跳过集成测试，保持 npm test 可用。
let dbUp = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbUp = true;
} catch {
  dbUp = false;
}
const dbDescribe = dbUp ? describe : describe.skip;

async function expectPrismaError(promise: Promise<unknown>, codes: string[]) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(codes).toContain((error as Prisma.PrismaClientKnownRequestError).code);
    return;
  }
  throw new Error(`应被 ${codes.join("/")} 拒绝，但实际成功了`);
}

type Fixture = {
  customerId: string;
  locationId: string;
  contractId: string;
  cPackageId: string;
  supplierId: string;
  sContractId: string;
  sPackageId: string;
  modelId: string;
  cOrderId: string;
  cItemId: string;
  sOrderId: string;
  sItemId: string;
};

const fx = {} as Fixture;
const printerIds: string[] = [];

async function createPrinter(code: string, entryDate: Date) {
  const printer = await prisma.printer.create({
    data: {
      printerCode: code,
      supplierAssetCode: `${code}-ASSET`,
      machineModelId: fx.modelId,
      customerOrderItemId: fx.cItemId,
      supplierOrderItemId: fx.sItemId,
      entryDate,
      initialBwReading: 1000,
      initialColorReading: 50,
      status: "active",
      qrToken: newQrToken(),
    },
  });
  printerIds.push(printer.id);
  return printer;
}

dbDescribe("数据完整性与 V1 验收场景", () => {
  let printer: { id: string };

  beforeAll(async () => {
    const customer = await prisma.customer.create({ data: { customerCode: "IT10-C", customerName: "完整性测试客户", customerType: "external" } });
    const location = await prisma.location.create({ data: { customerId: customer.id, locationCode: "L1", locationName: "测试地点", address: "测试地址" } });
    const contract = await prisma.customerFrameworkContract.create({ data: { contractNo: "IT10-CT", contractName: "测试合同", effectiveDate: new Date("2026-01-01"), customers: { connect: { id: customer.id } } } });
    const cPackage = await prisma.customerPackage.create({ data: { packageCode: "IT10-CP", packageName: "测试客户套餐", monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03", effectiveFrom: new Date("2026-01-01") } });
    const supplier = await prisma.supplier.create({ data: { supplierCode: "IT10-S", supplierName: "完整性测试供应商" } });
    const sContract = await prisma.supplierFrameworkContract.create({ data: { supplierId: supplier.id, contractNo: "IT10-SCT", contractName: "测试供应商合同", effectiveDate: new Date("2026-01-01") } });
    const sPackage = await prisma.supplierPackage.create({ data: { supplierId: supplier.id, packageCode: "IT10-SP", packageName: "测试供应商套餐", monthlyRent: "400", monthlyFreeBwEquivalent: "16000", overageRateBwEquivalent: "0.03", effectiveFrom: new Date("2026-01-01") } });
    const model = await prisma.machineModel.create({ data: { brand: "测试品牌", modelName: "IT10-MODEL", deviceType: "color" } });
    const cOrder = await prisma.customerOrder.create({
      data: { orderNo: "IT10-CO", customerId: customer.id, locationId: location.id, customerContractId: contract.id, orderDate: new Date("2026-09-01"), status: "confirmed", items: { create: [{ customerPackageId: cPackage.id, quantity: 2, plannedEntryDate: new Date("2026-09-20") }] } },
      include: { items: true },
    });
    const sOrder = await prisma.supplierOrder.create({
      data: { orderNo: "IT10-SO", supplierId: supplier.id, supplierContractId: sContract.id, orderDate: new Date("2026-09-01"), status: "confirmed", items: { create: [{ supplierPackageId: sPackage.id, quantity: 2, plannedEntryDate: new Date("2026-09-20") }] } },
      include: { items: true },
    });
    Object.assign(fx, {
      customerId: customer.id, locationId: location.id, contractId: contract.id, cPackageId: cPackage.id,
      supplierId: supplier.id, sContractId: sContract.id, sPackageId: sPackage.id, modelId: model.id,
      cOrderId: cOrder.id, cItemId: cOrder.items[0].id, sOrderId: sOrder.id, sItemId: sOrder.items[0].id,
    });
    printer = await createPrinter("IT10-P1", new Date("2026-09-20"));
  });

  afterAll(async () => {
    await prisma.printer.deleteMany({ where: { id: { in: printerIds } } });
    await prisma.customerOrder.delete({ where: { id: fx.cOrderId } });
    await prisma.supplierOrder.delete({ where: { id: fx.sOrderId } });
    await prisma.customerPackage.deleteMany({ where: { packageCode: "IT10-CP" } });
    await prisma.supplierPackage.deleteMany({ where: { packageCode: "IT10-SP" } });
    await prisma.machineModel.deleteMany({ where: { id: fx.modelId } });
    await prisma.customerFrameworkContract.deleteMany({ where: { id: fx.contractId } });
    await prisma.supplierFrameworkContract.deleteMany({ where: { id: fx.sContractId } });
    await prisma.location.deleteMany({ where: { id: fx.locationId } });
    await prisma.customer.deleteMany({ where: { id: fx.customerId } });
    await prisma.supplier.deleteMany({ where: { id: fx.supplierId } });
  });

  describe("数据完整性规则（数据库层兜底）", () => {
  it("MeterReading 唯一性：同一 Printer + 年 + 月只能一条", async () => {
    await prisma.meterReading.create({
      data: { printerId: printer.id, readingYear: 2026, readingMonth: 9, previousBwReading: 1000, currentBwReading: 9000, previousColorReading: 50, currentColorReading: 350, bwUsage: 8000, colorUsage: 300, bwEquivalentUsage: 11000, photoUrl: "/api/files/meter-readings/photos/it10.jpg" },
    });
    await expectPrismaError(
      prisma.meterReading.create({
        data: { printerId: printer.id, readingYear: 2026, readingMonth: 9, previousBwReading: 1000, currentBwReading: 9100, previousColorReading: 50, currentColorReading: 350, bwUsage: 8100, colorUsage: 300, bwEquivalentUsage: 11100, photoUrl: "/api/files/meter-readings/photos/it10-dup.jpg" },
      }),
      ["P2002"],
    );
  });

  it("Package：历史使用中的套餐不得硬删除（Restrict 外键）", async () => {
    await expectPrismaError(prisma.customerPackage.delete({ where: { id: fx.cPackageId } }), ["P2003", "P2014"]);
    await expectPrismaError(prisma.supplierPackage.delete({ where: { id: fx.sPackageId } }), ["P2003", "P2014"]);
  });

  it("Printer：有打印机的订单不得删除，机型被引用不得删除", async () => {
    await expectPrismaError(prisma.customerOrder.delete({ where: { id: fx.cOrderId } }), ["P2003", "P2014"]);
    await expectPrismaError(prisma.supplierOrder.delete({ where: { id: fx.sOrderId } }), ["P2003", "P2014"]);
    await expectPrismaError(prisma.machineModel.delete({ where: { id: fx.modelId } }), ["P2003", "P2014"]);
  });

  it("MeterReading 随打印机级联删除", async () => {
    const transient = await createPrinter("IT10-PX", new Date("2026-09-21"));
    await prisma.meterReading.create({
      data: { printerId: transient.id, readingYear: 2026, readingMonth: 9, previousBwReading: 0, currentBwReading: 10, previousColorReading: 0, currentColorReading: 0, bwUsage: 10, colorUsage: 0, bwEquivalentUsage: 10, photoUrl: "/api/files/meter-readings/photos/it10-x.jpg" },
    });
    await prisma.printer.delete({ where: { id: transient.id } });
    expect(await prisma.meterReading.count({ where: { printerId: transient.id } })).toBe(0);
  });

  it("读数规则：current 不得低于 previous（计算层抛错，提交入口拦截）", () => {
    expect(() => computeUsages(9000, 8999, 350, 350)).toThrow("当前黑白读数不能低于上期读数");
    expect(() => computeUsages(9000, 9000, 350, 349)).toThrow("当前彩色读数不能低于上期读数");
  });
});

describe("最终 V1 验收场景（端到端数据链路）", () => {
  let p1: { id: string; printerCode: string };
  let p2: { id: string; printerCode: string };

  beforeAll(async () => {
    p1 = await createPrinter("V1-P001", new Date("2026-09-20"));
    p2 = await createPrinter("V1-P002", new Date("2026-09-20"));
  });

  it("Scenario 1｜新客户：订单 → 明细 ×2 → 双侧订单 → 两台 Printer 均 active", async () => {
    const item = await prisma.customerOrderItem.findUniqueOrThrow({ where: { id: fx.cItemId }, select: { quantity: true } });
    expect(item.quantity).toBe(2);
    const actives = await prisma.printer.count({ where: { id: { in: [p1.id, p2.id] }, status: "active" } });
    expect(actives).toBe(2);
  });

  it("Scenario 2｜扫码抄表：9 月读数提交后后台可见，结算自动算出应收 / 应付 / 毛利", async () => {
    const usages = computeUsages(1000, 9000, 50, 350); // 黑白 8000 + 彩色 300 → 11000
    const reading = await prisma.meterReading.create({
      data: { printerId: p1.id, readingYear: 2026, readingMonth: 9, previousBwReading: 1000, currentBwReading: 9000, previousColorReading: 50, currentColorReading: 350, ...usages, photoUrl: "/api/files/meter-readings/photos/v1-s2.jpg" },
    });
    expect(reading.bwEquivalentUsage).toBe(11000);

    const printer = await prisma.printer.findUniqueOrThrow({ where: { id: p1.id }, include: { customerOrderItem: { include: { customerPackage: true } }, supplierOrderItem: { include: { supplierPackage: true } } } });
    const settlement = computeSettlement({
      year: 2026, month: 9, entryDate: printer.entryDate, exitDate: printer.exitDate,
      bwUsage: reading.bwUsage, colorUsage: reading.colorUsage, bwEquivalentUsage: reading.bwEquivalentUsage,
      customerPackage: printer.customerOrderItem.customerPackage,
      supplierPackage: printer.supplierOrderItem!.supplierPackage,
    });
    if (!settlement) throw new Error("结算不应为 null");
    expect(settlement.customer.monthlyAmount.toString()).toBe("385"); // 165 + 220
    expect(settlement.supplier.monthlyAmount.toString()).toBe("300.67");
    expect(settlement.operatingGrossProfit.toString()).toBe("84.33");
  });

  it("Scenario 3｜坏机换机：旧机 replaced 且历史抄表保留，新机从初始读数开始并记录 previousPrinterId", async () => {
    await prisma.printer.update({ where: { id: p1.id }, data: { status: "replaced", exitDate: new Date("2026-10-01") } });
    const p3 = await prisma.printer.create({
      data: {
        printerCode: "V1-P003", supplierAssetCode: "V1-P003-ASSET", machineModelId: fx.modelId,
        customerOrderItemId: fx.cItemId, supplierOrderItemId: fx.sItemId, entryDate: new Date("2026-10-01"),
        initialBwReading: 0, initialColorReading: 0, status: "active", previousPrinterId: p1.id, qrToken: newQrToken(),
      },
    });
    printerIds.push(p3.id);

    const oldOne = await prisma.printer.findUniqueOrThrow({ where: { id: p1.id }, include: { meterReadings: true, replacementPrinter: { select: { printerCode: true } } } });
    expect(oldOne.status).toBe("replaced");
    expect(oldOne.meterReadings).toHaveLength(1); // 9 月抄表留在旧机
    expect(oldOne.replacementPrinter?.printerCode).toBe("V1-P003");

    const newOne = await prisma.printer.findUniqueOrThrow({ where: { id: p3.id }, include: { previousPrinter: { select: { printerCode: true } }, meterReadings: true } });
    expect(newOne.previousPrinter?.printerCode).toBe("V1-P001");
    expect(newOne.meterReadings).toHaveLength(0); // 新机无历史，首期上期 = 初始读数
  });

  it("Scenario 4｜新增机器必须走新订单：新订单 + 新机，原明细数量不被修改", async () => {
    const orderCountBefore = await prisma.customerOrder.count({ where: { customerId: fx.customerId } });
    const cOrder2 = await prisma.customerOrder.create({
      data: { orderNo: "IT10-CO-2", customerId: fx.customerId, locationId: fx.locationId, customerContractId: fx.contractId, orderDate: new Date("2026-10-02"), status: "confirmed", items: { create: [{ customerPackageId: fx.cPackageId, quantity: 1, plannedEntryDate: new Date("2026-10-05") }] } },
      include: { items: true },
    });
    const sOrder2 = await prisma.supplierOrder.create({
      data: { orderNo: "IT10-SO-2", supplierId: fx.supplierId, supplierContractId: fx.sContractId, orderDate: new Date("2026-10-02"), status: "confirmed", items: { create: [{ supplierPackageId: fx.sPackageId, quantity: 1, plannedEntryDate: new Date("2026-10-05") }] } },
      include: { items: true },
    });
    const p4 = await prisma.printer.create({
      data: { printerCode: "V1-P004", supplierAssetCode: "V1-P004-ASSET", machineModelId: fx.modelId, customerOrderItemId: cOrder2.items[0].id, supplierOrderItemId: sOrder2.items[0].id, entryDate: new Date("2026-10-05"), initialBwReading: 0, initialColorReading: 0, status: "active", qrToken: newQrToken() },
    });
    printerIds.push(p4.id);

    const originalItem = await prisma.customerOrderItem.findUniqueOrThrow({ where: { id: fx.cItemId }, select: { quantity: true } });
    expect(originalItem.quantity).toBe(2); // 历史订单数量未被改动
    expect(await prisma.customerOrder.count({ where: { customerId: fx.customerId } })).toBe(orderCountBefore + 1);
    await prisma.printer.delete({ where: { id: p4.id } });
    printerIds.splice(printerIds.indexOf(p4.id), 1);
    await prisma.customerOrder.delete({ where: { id: cOrder2.id } });
    await prisma.supplierOrder.delete({ where: { id: sOrder2.id } });
  });

  it("Scenario 5｜撤机：状态 removed，历史数据仍可查询", async () => {
    await prisma.printer.update({ where: { id: p2.id }, data: { status: "removed", exitDate: new Date("2026-10-03") } });
    const removed = await prisma.printer.findUniqueOrThrow({ where: { id: p2.id } });
    expect(removed.status).toBe("removed");
    expect(removed.exitDate).not.toBeNull();
    // 历史链路完整可查：订单、明细、套餐仍在
    const order = await prisma.customerOrder.findUniqueOrThrow({ where: { id: fx.cOrderId }, include: { items: true } });
    expect(order.items[0].quantity).toBe(2);
  });
  });
});
