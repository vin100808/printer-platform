import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { completeCustomerOrder, deleteCustomerOrder } from "@/actions/orders";
import { CompleteOrderButton } from "@/components/order-actions";
import { DetailItem, EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { billingCycleLabel, deploymentStatus, orderStatusLabel } from "@/lib/orders";
import { hasDeploymentCapacity, printerStatusLabel } from "@/lib/printers";
import { aggregateQuarterlySettlement, computeSettlementOptionalSupplier, summarizeOrderQuarterlySettlements, summarizeOrderSettlements } from "@/lib/settlement";
import { prisma } from "@/lib/prisma";

const orderStatusClass: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  confirmed: "bg-emerald-50 text-emerald-700",
  completed: "bg-blue-50 text-blue-700",
  cancelled: "bg-red-50 text-red-700",
};

const printerStatusClass: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-slate-100 text-slate-600",
  replaced: "bg-amber-50 text-amber-700",
  removed: "bg-red-50 text-red-700",
};

export default async function CustomerOrderDetailPage({ params, searchParams }: PageProps<"/orders/[id]">) {
  await connection();
  const { id } = await params;
  const { error, completed } = await searchParams;
  const order = await prisma.customerOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { customerCode: true, customerName: true } },
      supplier: { select: { supplierCode: true, supplierName: true } },
      location: { select: { locationName: true, address: true } },
      customerContract: { select: { contractNo: true, contractName: true } },
      items: { include: { customerPackage: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  const itemIds = order.items.map((item) => item.id);
  const [deployedRows, printers] = await Promise.all([
    prisma.printer.groupBy({
      by: ["customerOrderItemId"],
      where: { customerOrderItemId: { in: itemIds }, status: "active" },
      _count: { _all: true },
    }),
    prisma.printer.findMany({
      where: { customerOrderItemId: { in: itemIds } },
      include: {
        machineModel: { select: { brand: true, modelName: true } },
        customerOrderItem: { select: { customerPackage: true } },
        supplierOrderItem: { select: { supplierPackage: true } },
        meterReadings: { orderBy: [{ readingYear: "desc" }, { readingMonth: "desc" }], take: 3 },
      },
      orderBy: [{ entryDate: "asc" }, { printerCode: "asc" }],
    }),
  ]);
  const deployedByItem = new Map(deployedRows.map((row) => [row.customerOrderItemId, row._count._all]));
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalDeployed = order.items.reduce((sum, item) => sum + (deployedByItem.get(item.id) ?? 0), 0);
  const activePrinters = printers.filter((printer) => printer.status === "active");

  // MeterReading 摘要：全订单最近一个业务月份，及该月已抄台数。
  const latestReading = printers.reduce<{ year: number; month: number } | null>((acc, printer) => {
    const reading = printer.meterReadings[0];
    if (!reading) return acc;
    if (!acc || reading.readingYear > acc.year || (reading.readingYear === acc.year && reading.readingMonth > acc.month)) {
      return { year: reading.readingYear, month: reading.readingMonth };
    }
    return acc;
  }, null);
  const readingsInLatestMonth = latestReading
    ? printers.filter((printer) => {
        const reading = printer.meterReadings[0];
        return reading && reading.readingYear === latestReading.year && reading.readingMonth === latestReading.month;
      }).length
    : 0;

  // 结算：先逐 Printer 逐月计算（免费额度按 Printer 独立折算，不共享），再按结算方式汇总到订单。
  // monthly：各打印机最近抄表月份直接汇总；quarterly：各打印机先按自然季度（Q1-Q4）聚合，再汇总最近季度。
  const settlementsByPrinter = printers.map((printer) =>
    printer.meterReadings
      .map((reading) =>
        computeSettlementOptionalSupplier({
          year: reading.readingYear,
          month: reading.readingMonth,
          entryDate: printer.entryDate,
          exitDate: printer.exitDate,
          bwUsage: reading.bwUsage,
          colorUsage: reading.colorUsage,
          bwEquivalentUsage: reading.bwEquivalentUsage,
          customerPackage: printer.customerOrderItem.customerPackage,
          supplierPackage: printer.supplierOrderItem?.supplierPackage ?? null,
        }),
      )
      .filter((result) => result !== null),
  );
  const isQuarterly = order.billingCycle === "quarterly";
  const settlementSummary = isQuarterly
    ? summarizeOrderQuarterlySettlements(settlementsByPrinter.map((results) => aggregateQuarterlySettlement(results)).filter((result) => result !== null))
    : summarizeOrderSettlements(settlementsByPrinter.map((results) => results[0]).filter((result) => result !== undefined));
  const canComplete = order.status === "draft" || order.status === "confirmed";

  return <div className="mx-auto max-w-7xl"><PageHeader description={`下单日期 ${order.orderDate.toLocaleDateString("zh-CN")}`} title={`订单 · ${order.orderNo}`} />
    {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {completed ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">订单已结束。打印机台账、抄表与历史结算数据均保持不变。</p> : null}
    <div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href={`/orders/${id}/edit`}>编辑</Link>{canComplete ? <CompleteOrderButton action={completeCustomerOrder.bind(null, id)} activeCount={activePrinters.length} /> : null}<form action={deleteCustomerOrder.bind(null, id)}><button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">删除订单</button></form></div>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><DetailItem label="订单编号" value={order.orderNo} /><DetailItem label="客户" value={`${order.customer.customerName}（${order.customer.customerCode}）`} /><DetailItem label="供应商" value={order.supplier ? `${order.supplier.supplierName}（${order.supplier.supplierCode}）` : "—"} /><DetailItem label="安装地址" value={order.installationAddress ?? (order.location ? `${order.location.locationName}（${order.location.address}）` : "—")} /><DetailItem label="开始日期" value={order.startDate?.toLocaleDateString("zh-CN") ?? "—"} /><DetailItem label="结束日期" value={order.endDate?.toLocaleDateString("zh-CN") ?? "—"} /><DetailItem label="结算方式" value={billingCycleLabel[order.billingCycle]} /><DetailItem label="押金应收" value={order.depositAmount ? <>{`¥${order.depositAmount.toString()}`}<br /><span className="text-xs text-slate-400">{order.depositReceivedDate ? `已收（${order.depositReceivedDate.toLocaleDateString("zh-CN")}）` : "未收"}</span></> : "—"} /><DetailItem label="客户框架合同" value={order.customerContract ? `${order.customerContract.contractName}（${order.customerContract.contractNo}）` : "—"} /><DetailItem label="下单日期" value={order.orderDate.toLocaleDateString("zh-CN")} /><DetailItem label="状态" value={<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusClass[order.status] ?? "bg-slate-100 text-slate-600"}`}>{orderStatusLabel[order.status]}</span>} /><DetailItem label="合同文件" value={order.contractAttachmentUrl ? <a className="text-blue-700" href={order.contractAttachmentUrl} target="_blank">打开合同文件</a> : "—"} /><DetailItem label="订单附件" value={order.orderAttachmentUrl ? <a className="text-blue-700" href={order.orderAttachmentUrl} target="_blank">打开附件</a> : "—"} /><DetailItem label="备注" value={order.remark} /></div></section>
    <section className="mt-8"><div className="flex items-end justify-between"><h2 className="text-xl font-bold">订单明细</h2><p className="text-sm text-slate-500">合计 {totalQuantity} 台 · 已部署 {totalDeployed} 台</p></div>{!order.items.length ? <div className="mt-4"><EmptyState>暂无明细。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>套餐</th><th className={thClass}>订单数量</th><th className={thClass}>已部署</th><th className={thClass}>部署状态</th><th className={thClass}>计划进场日期</th><th className={thClass}>备注</th><th className={thClass}></th></tr></thead><tbody>{order.items.map((item) => {
      const deployed = deployedByItem.get(item.id) ?? 0;
      const status = deploymentStatus(deployed, item.quantity);
      return <tr key={item.id}><td className={tdClass}><b>{item.customerPackage.packageName}</b><br /><span className="text-xs text-slate-400">{item.customerPackage.packageCode} · V{item.customerPackage.version}</span></td><td className={tdClass}>{item.quantity}</td><td className={tdClass}>{deployed} / {item.quantity}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "已部署" ? "bg-emerald-50 text-emerald-700" : status === "部分部署" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{status}</span></td><td className={tdClass}>{item.plannedEntryDate?.toLocaleDateString("zh-CN") ?? "—"}</td><td className={tdClass}>{item.remark || "—"}</td><td className={tdClass}>{hasDeploymentCapacity(deployed, item.quantity) && order.status !== "cancelled" ? <Link className="font-semibold text-blue-700" href={`/printers/new?customerOrderItemId=${item.id}`}>部署打印机</Link> : "—"}</td></tr>;
    })}</tbody></table></div>}</section>
    <section className="mt-8"><h2 className="text-xl font-bold">已进场打印机</h2>{!printers.length ? <div className="mt-4"><EmptyState>暂无打印机台账记录，可从上方明细行「部署打印机」进场。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>打印机编码</th><th className={thClass}>机型</th><th className={thClass}>状态</th><th className={thClass}>进场日期</th><th className={thClass}>退场日期</th><th className={thClass}>最近抄表</th><th className={thClass}></th></tr></thead><tbody>{printers.map((printer) => {
      const reading = printer.meterReadings[0];
      return <tr key={printer.id}><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/printers/${printer.id}`}>{printer.printerCode}</Link><br /><span className="text-xs text-slate-400">资产编码 {printer.supplierAssetCode ?? "—"}</span></td><td className={tdClass}>{`${printer.machineModel.brand} ${printer.machineModel.modelName}`}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${printerStatusClass[printer.status] ?? "bg-slate-100 text-slate-600"}`}>{printerStatusLabel[printer.status]}</span></td><td className={tdClass}>{printer.entryDate.toLocaleDateString("zh-CN")}</td><td className={tdClass}>{printer.exitDate?.toLocaleDateString("zh-CN") ?? "—"}</td><td className={tdClass}>{reading ? <>{`${reading.readingYear}-${String(reading.readingMonth).padStart(2, "0")}`}<br /><span className="text-xs text-slate-400">BW Equivalent {reading.bwEquivalentUsage}</span></> : "—"}</td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/printers/${printer.id}`}>详情</Link></td></tr>;
    })}</tbody></table></div>}</section>
    <section className="mt-8"><h2 className="text-xl font-bold">抄表摘要</h2>{latestReading ? <dl className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">最近业务月份</dt><dd className="mt-1 font-semibold text-slate-900">{latestReading.year}-{String(latestReading.month).padStart(2, "0")}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">该月已抄</dt><dd className="mt-1 font-semibold text-slate-900">{readingsInLatestMonth} / {printers.length} 台</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">运行中</dt><dd className="mt-1 font-semibold text-slate-900">{activePrinters.length} 台</dd></div></dl> : <div className="mt-4"><EmptyState>暂无抄表记录。</EmptyState></div>}</section>
    {settlementSummary ? <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">结算摘要 · {"quarter" in settlementSummary ? `${settlementSummary.year} 年 Q${settlementSummary.quarter}` : `${settlementSummary.year} 年 ${settlementSummary.month} 月`}</h2><p className="mt-1 text-xs text-slate-400">{billingCycleLabel[order.billingCycle]}：逐 Printer 计算后汇总（参与汇总 {settlementSummary.printerCount} 台，实时计算不存库）{"quarter" in settlementSummary ? "；季度中途进场/退场按天折算" : ""}。</p><dl className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-3"><dt className="text-xs text-emerald-600">客户应收</dt><dd className="mt-1 font-semibold text-emerald-900">¥{settlementSummary.customerAmount.toString()}</dd></div><div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs text-slate-600">供应商应付</dt><dd className="mt-1 font-semibold text-slate-900">{settlementSummary.supplierAmount ? `¥${settlementSummary.supplierAmount.toString()}` : "未配置"}</dd></div>{settlementSummary.operatingGrossProfit ? <div className={`rounded-xl p-3 ${settlementSummary.operatingGrossProfit.gte(0) ? "bg-blue-50" : "bg-red-50"}`}><dt className={`text-xs ${settlementSummary.operatingGrossProfit.gte(0) ? "text-blue-600" : "text-red-600"}`}>运营毛利</dt><dd className={`mt-1 font-semibold ${settlementSummary.operatingGrossProfit.gte(0) ? "text-blue-900" : "text-red-900"}`}>¥{settlementSummary.operatingGrossProfit.toString()}</dd></div> : <div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs text-slate-600">运营毛利</dt><dd className="mt-1 font-semibold text-slate-900">暂不可计算</dd></div>}</dl></section> : null}
  </div>;
}
