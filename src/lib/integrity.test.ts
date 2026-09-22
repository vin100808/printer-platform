import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeUsages } from "@/lib/meter";
import { computeDepositAmount, defaultEndDate } from "@/lib/orders";
import { newQrToken } from "@/lib/printers";
import { aggregateQuarterlySettlement, computeSettlement, computeSettlementOptionalSupplier, summarizeOrderQuarterlySettlements, summarizeOrderSettlements } from "@/lib/settlement";
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

  it("Scenario 6｜新流程（TASK 15）：无供应商订单 / 资产编码进场 → 抄表 → 换机（保持无关联）→ 撤机", async () => {
    // 进场：不关联 SupplierOrderItem、不填供应商资产编码（列已可空）
    const p5 = await prisma.printer.create({
      data: { printerCode: "V1-P005", supplierAssetCode: null, machineModelId: fx.modelId, customerOrderItemId: fx.cItemId, supplierOrderItemId: null, entryDate: new Date("2026-10-10"), initialBwReading: 0, initialColorReading: 0, status: "active", qrToken: newQrToken() },
    });
    printerIds.push(p5.id);
    expect(p5.supplierOrderItemId).toBeNull();
    expect(p5.supplierAssetCode).toBeNull();

    // 抄表不受影响（MeterReading 与供应商侧无关联）
    const usages = computeUsages(0, 500, 0, 10);
    const reading = await prisma.meterReading.create({
      data: { printerId: p5.id, readingYear: 2026, readingMonth: 10, previousBwReading: 0, currentBwReading: 500, previousColorReading: 0, currentColorReading: 10, ...usages, photoUrl: "/api/files/meter-readings/photos/v1-s6.jpg" },
    });
    expect(reading.bwEquivalentUsage).toBe(600);

    // 结算：客户侧照常计算，供应商侧与毛利为 null（未配置不阻塞客户业务）
    const full = await prisma.printer.findUniqueOrThrow({ where: { id: p5.id }, include: { customerOrderItem: { include: { customerPackage: true } }, supplierOrderItem: { include: { supplierPackage: true } } } });
    const settlement = computeSettlementOptionalSupplier({
      year: 2026, month: 10, entryDate: full.entryDate, exitDate: full.exitDate,
      bwUsage: reading.bwUsage, colorUsage: reading.colorUsage, bwEquivalentUsage: reading.bwEquivalentUsage,
      customerPackage: full.customerOrderItem.customerPackage,
      supplierPackage: full.supplierOrderItem?.supplierPackage ?? null,
    });
    if (!settlement) throw new Error("结算不应为 null");
    expect(settlement.supplier).toBeNull();
    expect(settlement.operatingGrossProfit).toBeNull();
    expect(Number(settlement.customer.monthlyAmount.toString())).toBeGreaterThan(0);

    // 换机：新机保持无供应商关联，换机链完整
    await prisma.printer.update({ where: { id: p5.id }, data: { status: "replaced", exitDate: new Date("2026-10-20") } });
    const p6 = await prisma.printer.create({
      data: { printerCode: "V1-P006", supplierAssetCode: null, machineModelId: fx.modelId, customerOrderItemId: fx.cItemId, supplierOrderItemId: null, entryDate: new Date("2026-10-20"), initialBwReading: 500, initialColorReading: 10, status: "active", previousPrinterId: p5.id, qrToken: newQrToken() },
    });
    printerIds.push(p6.id);
    const oldOne = await prisma.printer.findUniqueOrThrow({ where: { id: p5.id }, include: { meterReadings: true, replacementPrinter: { select: { printerCode: true } } } });
    expect(oldOne.status).toBe("replaced");
    expect(oldOne.meterReadings).toHaveLength(1); // 历史抄表保留在旧机
    expect(oldOne.replacementPrinter?.printerCode).toBe("V1-P006");

    // 撤机：状态 removed，记录保留
    await prisma.printer.update({ where: { id: p6.id }, data: { status: "removed", exitDate: new Date("2026-10-25") } });
    expect((await prisma.printer.findUniqueOrThrow({ where: { id: p6.id } })).status).toBe("removed");
  });
  });

describe("TASK 18 兼容验证（押金 / 状态 / 聚合 / 可空关系）", () => {
  const it18OrderIds: string[] = [];
  const it18PrinterIds: string[] = [];

  afterAll(async () => {
    // 先于外层 afterAll 执行：删自建打印机与订单，避免外键阻塞外层夹具清理
    await prisma.printer.deleteMany({ where: { id: { in: it18PrinterIds } } });
    await prisma.customerOrderItem.deleteMany({ where: { customerOrderId: { in: it18OrderIds } } });
    await prisma.customerOrder.deleteMany({ where: { id: { in: it18OrderIds } } });
  });

  it("可空关系 + 押金：无 Location / 客户合同 / 供应商即可建单，押金 = Σ数量 × 2000，endDate 默认 +3 年 − 1 天", async () => {
    const startDate = new Date("2026-09-01T00:00:00.000Z");
    const order = await prisma.customerOrder.create({
      data: {
        orderNo: "IT18-CO-1", customerId: fx.customerId, orderDate: startDate, startDate,
        endDate: defaultEndDate(startDate), status: "confirmed", billingCycle: "monthly",
        installationAddress: "无需 Location 的安装地址", depositAmount: computeDepositAmount(2 + 3),
        items: { create: [{ customerPackageId: fx.cPackageId, quantity: 2 }, { customerPackageId: fx.cPackageId, quantity: 3 }] },
      },
    });
    it18OrderIds.push(order.id);
    expect(order.locationId).toBeNull();
    expect(order.customerContractId).toBeNull();
    expect(order.supplierId).toBeNull();
    expect(order.depositAmount?.toString()).toBe("10000"); // 5 × 2000
    expect(order.depositReceivedDate).toBeNull(); // 收款状态未知时保持 NULL
    expect(order.endDate?.toISOString().slice(0, 10)).toBe("2029-08-31");
    // 押金收款日期可后续登记
    await prisma.customerOrder.update({ where: { id: order.id }, data: { depositReceivedDate: new Date("2026-09-10T00:00:00.000Z") } });
    expect((await prisma.customerOrder.findUniqueOrThrow({ where: { id: order.id } })).depositReceivedDate?.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("状态：订单结束后 Printer 与 MeterReading 历史零改动", async () => {
    const order = await prisma.customerOrder.create({
      data: { orderNo: "IT18-CO-2", customerId: fx.customerId, orderDate: new Date("2026-09-01"), status: "confirmed", items: { create: [{ customerPackageId: fx.cPackageId, quantity: 1 }] } },
      include: { items: true },
    });
    it18OrderIds.push(order.id);
    const p = await prisma.printer.create({
      data: { printerCode: "IT18-P1", machineModelId: fx.modelId, customerOrderItemId: order.items[0].id, supplierOrderItemId: fx.sItemId, entryDate: new Date("2026-09-20"), initialBwReading: 0, initialColorReading: 0, status: "active", qrToken: newQrToken() },
    });
    it18PrinterIds.push(p.id);
    await prisma.meterReading.create({
      data: { printerId: p.id, readingYear: 2026, readingMonth: 9, previousBwReading: 0, currentBwReading: 100, previousColorReading: 0, currentColorReading: 0, bwUsage: 100, colorUsage: 0, bwEquivalentUsage: 100, photoUrl: "/api/files/meter-readings/photos/it18-s.jpg" },
    });
    // 结束订单（与 completeCustomerOrder 等价的数据层结果）
    await prisma.customerOrder.update({ where: { id: order.id }, data: { status: "completed" } });
    const after = await prisma.customerOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("completed");
    const printerAfter = await prisma.printer.findUniqueOrThrow({ where: { id: p.id }, include: { meterReadings: true } });
    expect(printerAfter.status).toBe("active"); // 打印机生命周期不被订单结束触碰
    expect(printerAfter.meterReadings).toHaveLength(1);
  });

  it("聚合（monthly）：逐 Printer 独立计算后求和 = 订单应收 / 应付 / 毛利", async () => {
    const order = await prisma.customerOrder.create({
      data: { orderNo: "IT18-CO-3", customerId: fx.customerId, orderDate: new Date("2026-09-01"), status: "confirmed", billingCycle: "monthly", items: { create: [{ customerPackageId: fx.cPackageId, quantity: 2 }] } },
      include: { items: true },
    });
    it18OrderIds.push(order.id);
    const results = [];
    for (const code of ["IT18-P2", "IT18-P3"]) {
      const p = await prisma.printer.create({
        data: { printerCode: code, machineModelId: fx.modelId, customerOrderItemId: order.items[0].id, supplierOrderItemId: fx.sItemId, entryDate: new Date("2026-09-20"), initialBwReading: 1000, initialColorReading: 50, status: "active", qrToken: newQrToken() },
      });
      it18PrinterIds.push(p.id);
      const reading = await prisma.meterReading.create({
        data: { printerId: p.id, readingYear: 2026, readingMonth: 9, previousBwReading: 1000, currentBwReading: 9000, previousColorReading: 50, currentColorReading: 350, bwUsage: 8000, colorUsage: 300, bwEquivalentUsage: 11000, photoUrl: `/api/files/meter-readings/photos/${code}.jpg` },
      });
      const result = computeSettlementOptionalSupplier({
        year: 2026, month: 9, entryDate: p.entryDate, exitDate: p.exitDate,
        bwUsage: reading.bwUsage, colorUsage: reading.colorUsage, bwEquivalentUsage: reading.bwEquivalentUsage,
        customerPackage: { monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03" },
        supplierPackage: { monthlyRent: "400", monthlyFreeBwEquivalent: "16000", overageRateBwEquivalent: "0.03" },
      });
      if (!result) throw new Error("结算不应为 null");
      results.push(result);
    }
    const summary = summarizeOrderSettlements(results);
    if (!summary) throw new Error("汇总不应为 null");
    expect(summary.printerCount).toBe(2);
    expect(summary.customerAmount.toString()).toBe("770"); // 385 × 2：免费额度按 Printer 独立，不共享
    expect(summary.supplierAmount?.toString()).toBe("601.34");
    expect(summary.operatingGrossProfit?.toString()).toBe("168.66");
  });

  it("聚合（quarterly）：自然季度聚合到订单；缺供应商侧的打印机不阻塞客户侧", async () => {
    const order = await prisma.customerOrder.create({
      data: { orderNo: "IT18-CO-4", customerId: fx.customerId, supplierId: fx.supplierId, orderDate: new Date("2026-08-20"), status: "confirmed", billingCycle: "quarterly", items: { create: [{ customerPackageId: fx.cPackageId, quantity: 2 }] } },
      include: { items: true },
    });
    it18OrderIds.push(order.id);
    const terms = { monthlyRent: "450", monthlyFreeBwEquivalent: "10000", overageRateBwEquivalent: "0.03" };
    const supplierTerms = { monthlyRent: "400", monthlyFreeBwEquivalent: "16000", overageRateBwEquivalent: "0.03" };
    // pa：关联供应商套餐，8/20 进场，Q3 有 8 月（3000）与 9 月（11000）两个月抄表
    const pa = await prisma.printer.create({
      data: { printerCode: "IT18-P4", machineModelId: fx.modelId, customerOrderItemId: order.items[0].id, supplierOrderItemId: fx.sItemId, entryDate: new Date("2026-08-20"), initialBwReading: 0, initialColorReading: 0, status: "active", qrToken: newQrToken() },
    });
    it18PrinterIds.push(pa.id);
    // pb：无供应商关联（TASK 15 新流程），Q3 仅 9 月（11000）
    const pb = await prisma.printer.create({
      data: { printerCode: "IT18-P5", machineModelId: fx.modelId, customerOrderItemId: order.items[0].id, supplierOrderItemId: null, entryDate: new Date("2026-08-20"), initialBwReading: 0, initialColorReading: 0, status: "active", qrToken: newQrToken() },
    });
    it18PrinterIds.push(pb.id);
    const monthlyOf = async (printerId: string, entryDate: Date, month: number, usage: number, withSupplier: boolean) => {
      const reading = await prisma.meterReading.create({
        data: { printerId, readingYear: 2026, readingMonth: month, previousBwReading: 0, currentBwReading: usage, previousColorReading: 0, currentColorReading: 0, bwUsage: usage, colorUsage: 0, bwEquivalentUsage: usage, photoUrl: `/api/files/meter-readings/photos/it18-${printerId}-${month}.jpg` },
      });
      const result = computeSettlementOptionalSupplier({
        year: 2026, month, entryDate, exitDate: null,
        bwUsage: reading.bwUsage, colorUsage: reading.colorUsage, bwEquivalentUsage: reading.bwEquivalentUsage,
        customerPackage: terms, supplierPackage: withSupplier ? supplierTerms : null,
      });
      if (!result) throw new Error("结算不应为 null");
      return result;
    };
    const paQuarter = aggregateQuarterlySettlement([await monthlyOf(pa.id, pa.entryDate, 8, 3000, true), await monthlyOf(pa.id, pa.entryDate, 9, 11000, true)]);
    const pbQuarter = aggregateQuarterlySettlement([await monthlyOf(pb.id, pb.entryDate, 9, 11000, false)]);
    if (!paQuarter || !pbQuarter) throw new Error("季度聚合不应为 null");
    expect(paQuarter.quarter).toBe(3);
    expect(paQuarter.monthCount).toBe(2);
    // pa 客户侧：8 月 450×12/31=174.19（按天折算）+ 9 月 480 = 654.19；供应商侧 154.84 + 400 = 554.84
    expect(paQuarter.customer.monthlyAmount.toString()).toBe("654.19");
    expect(paQuarter.supplier?.monthlyAmount.toString()).toBe("554.84");
    expect(pbQuarter.customer.monthlyAmount.toString()).toBe("480");
    expect(pbQuarter.supplier).toBeNull();
    const summary = summarizeOrderQuarterlySettlements([paQuarter, pbQuarter]);
    if (!summary) throw new Error("汇总不应为 null");
    expect(summary.year).toBe(2026);
    expect(summary.quarter).toBe(3);
    expect(summary.printerCount).toBe(2);
    expect(summary.customerAmount.toString()).toBe("1134.19"); // 654.19 + 480，客户侧不被阻塞
    expect(summary.supplierAmount).toBeNull(); // pb 缺供应商侧价格 → 应付与毛利不可汇总
    expect(summary.operatingGrossProfit).toBeNull();
  });
});
});
