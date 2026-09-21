import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deletePrinter } from "@/actions/printers";
import { DetailItem, EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { meterStatusLabel } from "@/lib/meter";
import { deviceTypeLabel, printerStatusLabel } from "@/lib/printers";
import { aggregateQuarterlySettlement, computeSettlementOptionalSupplier } from "@/lib/settlement";
import { prisma } from "@/lib/prisma";

const statusClass: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-slate-100 text-slate-600",
  replaced: "bg-amber-50 text-amber-700",
  removed: "bg-red-50 text-red-700",
};

export default async function PrinterDetailPage({ params, searchParams }: PageProps<"/printers/[id]">) {
  await connection();
  const { id } = await params;
  const { error } = await searchParams;
  const printer = await prisma.printer.findUnique({
    where: { id },
    include: {
      machineModel: true,
      customerOrderItem: { include: { customerPackage: true, order: { include: { customer: true, location: true, customerContract: true } } } },
      supplierOrderItem: { include: { supplierPackage: true, order: { include: { supplier: true, supplierContract: true } } } },
      previousPrinter: { select: { id: true, printerCode: true } },
      replacementPrinter: { select: { id: true, printerCode: true } },
      meterReadings: { orderBy: [{ readingYear: "desc" }, { readingMonth: "desc" }] },
    },
  });
  if (!printer) notFound();
  const customerOrder = printer.customerOrderItem.order;
  const supplierOrder = printer.supplierOrderItem?.order ?? null;
  const latestReading = printer.meterReadings[0];
  const settlement = latestReading
    ? computeSettlementOptionalSupplier({
        year: latestReading.readingYear,
        month: latestReading.readingMonth,
        entryDate: printer.entryDate,
        exitDate: printer.exitDate,
        bwUsage: latestReading.bwUsage,
        colorUsage: latestReading.colorUsage,
        bwEquivalentUsage: latestReading.bwEquivalentUsage,
        customerPackage: printer.customerOrderItem.customerPackage,
        supplierPackage: printer.supplierOrderItem?.supplierPackage ?? null,
      })
    : null;
  // 按自然季度结算的订单：在最近一个季度上聚合该机各月结算（月度逻辑不变，免费额度仍按本机独立折算）。
  const quarterlySettlement =
    customerOrder.billingCycle === "quarterly"
      ? aggregateQuarterlySettlement(
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
        )
      : null;
  return <div className="mx-auto max-w-7xl"><PageHeader description={`资产编码 ${printer.supplierAssetCode ?? "—"}`} title={`打印机 · ${printer.printerCode}`} />
    {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href={`/printers/${id}/edit`}>编辑</Link>{printer.status === "active" ? <><Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" href={`/printers/${id}/replace`}>换机</Link><Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" href={`/printers/${id}/remove`}>撤机</Link></> : null}<form action={deletePrinter.bind(null, id)}><button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">删除</button></form></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">客户侧</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><DetailItem label="客户" value={`${customerOrder.customer.customerName}（${customerOrder.customer.customerCode}）`} /><DetailItem label="部署地点" value={customerOrder.location ? `${customerOrder.location.locationName}（${customerOrder.location.address}）` : "—"} /><DetailItem label="客户框架合同" value={customerOrder.customerContract ? `${customerOrder.customerContract.contractName}（${customerOrder.customerContract.contractNo}）` : "—"} /><DetailItem label="客户订单" value={<Link className="font-semibold text-blue-700" href={`/orders/${customerOrder.id}`}>{customerOrder.orderNo}</Link>} /><DetailItem label="客户订单附件" value={customerOrder.orderAttachmentUrl ? <a className="text-blue-700" href={customerOrder.orderAttachmentUrl} target="_blank">打开附件</a> : "—"} /><DetailItem label="客户套餐" value={`${printer.customerOrderItem.customerPackage.packageName} V${printer.customerOrderItem.customerPackage.version}（¥${printer.customerOrderItem.customerPackage.monthlyRent.toString()}/月）`} /></dl></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">供应商侧</h2>{printer.supplierOrderItem && supplierOrder ? <dl className="mt-4 grid gap-5 sm:grid-cols-2"><DetailItem label="供应商" value={`${supplierOrder.supplier.supplierName}（${supplierOrder.supplier.supplierCode}）`} /><DetailItem label="供应商框架合同" value={`${supplierOrder.supplierContract.contractName}（${supplierOrder.supplierContract.contractNo}）`} /><DetailItem label="供应商订单" value={<Link className="font-semibold text-blue-700" href={`/supplier-orders/${supplierOrder.id}`}>{supplierOrder.orderNo}</Link>} /><DetailItem label="供应商订单附件" value={supplierOrder.orderAttachmentUrl ? <a className="text-blue-700" href={supplierOrder.orderAttachmentUrl} target="_blank">打开附件</a> : "—"} /><DetailItem label="供应商套餐" value={`${printer.supplierOrderItem.supplierPackage.packageName} V${printer.supplierOrderItem.supplierPackage.version}（¥${printer.supplierOrderItem.supplierPackage.monthlyRent.toString()}/月）`} /></dl> : <p className="mt-4 text-sm text-slate-500">未配置：该设备未关联供应商订单，供应商侧结算暂不可计算。</p>}</section>
    </div>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">设备</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><DetailItem label="打印机编码" value={printer.printerCode} /><DetailItem label="供应商资产编码" value={printer.supplierAssetCode} /><DetailItem label="机型" value={`${printer.machineModel.brand} ${printer.machineModel.modelName}`} /><DetailItem label="设备类型" value={deviceTypeLabel[printer.machineModel.deviceType]} /><DetailItem label="进场日期" value={printer.entryDate.toLocaleDateString("zh-CN")} /><DetailItem label="退场日期" value={printer.exitDate?.toLocaleDateString("zh-CN")} /><DetailItem label="状态" value={<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[printer.status] ?? "bg-slate-100 text-slate-600"}`}>{printerStatusLabel[printer.status]}</span>} /><DetailItem label="黑白初始读数" value={printer.initialBwReading} /><DetailItem label="彩色初始读数" value={printer.initialColorReading} /><DetailItem label="上一台机器" value={printer.previousPrinter ? <Link className="font-semibold text-blue-700" href={`/printers/${printer.previousPrinter.id}`}>{printer.previousPrinter.printerCode}</Link> : "—"} /><DetailItem label="后续替换机器" value={printer.replacementPrinter ? <Link className="font-semibold text-blue-700" href={`/printers/${printer.replacementPrinter.id}`}>{printer.replacementPrinter.printerCode}</Link> : "—"} /><DetailItem label="备注" value={printer.remark} /></dl></section>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">二维码与抄表</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><DetailItem label="二维码 Token" value={<code className="rounded-lg bg-slate-100 px-2 py-1 text-xs">{printer.qrToken}</code>} /><DetailItem label="客户抄表入口" value={<a className="text-blue-700" href={`/meter/${printer.qrToken}`} target="_blank">/meter/{printer.qrToken}</a>} /></dl><h3 className="mt-6 text-sm font-bold text-slate-700">抄表历史</h3>{!printer.meterReadings.length ? <div className="mt-3"><EmptyState>暂无抄表记录。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>业务月份</th><th className={thClass}>黑白读数</th>{printer.machineModel.deviceType === "color" ? <th className={thClass}>彩色读数</th> : null}<th className={thClass}>BW Equivalent</th><th className={thClass}>照片</th><th className={thClass}>状态</th><th className={thClass}>提交时间</th><th className={thClass}></th></tr></thead><tbody>{printer.meterReadings.map((reading) => <tr key={reading.id}><td className={tdClass}><b>{reading.readingYear}-{String(reading.readingMonth).padStart(2, "0")}</b>{reading.adminNote ? <><br /><span className="text-xs text-slate-400">{reading.adminNote}{reading.updatedBy ? `（${reading.updatedBy}）` : ""}</span></> : null}</td><td className={tdClass}>{reading.previousBwReading} → {reading.currentBwReading}<br /><span className="text-xs text-slate-400">用量 {reading.bwUsage}</span></td>{printer.machineModel.deviceType === "color" ? <td className={tdClass}>{reading.previousColorReading} → {reading.currentColorReading}<br /><span className="text-xs text-slate-400">用量 {reading.colorUsage}</span></td> : null}<td className={tdClass}>{reading.bwEquivalentUsage}</td><td className={tdClass}><a className="text-blue-700" href={reading.photoUrl} target="_blank">查看</a></td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reading.status === "adjusted" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{meterStatusLabel(reading.status)}</span></td><td className={tdClass}>{reading.submittedAt.toLocaleString("zh-CN")}</td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/meter-readings/${reading.id}/edit`}>调整</Link></td></tr>)}</tbody></table></div>}</section>
    {quarterlySettlement ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">季度结算 · {quarterlySettlement.year} 年 Q{quarterlySettlement.quarter}</h2><p className="mt-1 text-xs text-slate-400">按自然季度聚合本机 {quarterlySettlement.monthCount} 个月度结算；季度中途进场/退场按天折算；BW Equivalent 合计 {quarterlySettlement.bwEquivalentUsage.toString()}。</p><div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>项目</th><th className={thClass}>客户侧</th><th className={thClass}>供应商侧</th></tr></thead><tbody><tr><td className={tdClass}>实际月租</td><td className={tdClass}>¥{quarterlySettlement.customer.actualMonthlyRent.toString()}</td><td className={tdClass}>¥{quarterlySettlement.supplier?.actualMonthlyRent.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}>实际免费额度</td><td className={tdClass}>{quarterlySettlement.customer.actualFreeQuota.toString()}</td><td className={tdClass}>{quarterlySettlement.supplier?.actualFreeQuota.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}>超印量</td><td className={tdClass}>{quarterlySettlement.customer.overageUsage.toString()}</td><td className={tdClass}>{quarterlySettlement.supplier?.overageUsage.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}>超印费</td><td className={tdClass}>¥{quarterlySettlement.customer.overageFee.toString()}</td><td className={tdClass}>¥{quarterlySettlement.supplier?.overageFee.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}><b>季度金额</b></td><td className={tdClass}><b>¥{quarterlySettlement.customer.monthlyAmount.toString()}</b></td><td className={tdClass}><b>¥{quarterlySettlement.supplier?.monthlyAmount.toString() ?? "未配置"}</b></td></tr></tbody></table></div><dl className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-3"><dt className="text-xs text-emerald-600">客户应收</dt><dd className="mt-1 font-semibold text-emerald-900">¥{quarterlySettlement.customer.monthlyAmount.toString()}</dd></div><div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs text-slate-600">供应商应付</dt><dd className="mt-1 font-semibold text-slate-900">{quarterlySettlement.supplier ? `¥${quarterlySettlement.supplier.monthlyAmount.toString()}` : "未配置"}</dd></div>{quarterlySettlement.operatingGrossProfit ? <div className={`rounded-xl p-3 ${quarterlySettlement.operatingGrossProfit.gte(0) ? "bg-blue-50" : "bg-red-50"}`}><dt className={`text-xs ${quarterlySettlement.operatingGrossProfit.gte(0) ? "text-blue-600" : "text-red-600"}`}>运营毛利</dt><dd className={`mt-1 font-semibold ${quarterlySettlement.operatingGrossProfit.gte(0) ? "text-blue-900" : "text-red-900"}`}>¥{quarterlySettlement.operatingGrossProfit.toString()}</dd></div> : <div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs text-slate-600">运营毛利</dt><dd className="mt-1 font-semibold text-slate-900">暂不可计算</dd></div>}</dl></section> : null}
    {settlement ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">月度结算 · {settlement.year} 年 {settlement.month} 月</h2><p className="mt-1 text-xs text-slate-400">按在场 {settlement.activeDays} / {settlement.daysInMonth} 天折算；BW Equivalent = 黑白用量 + 彩色用量 × 10。</p><dl className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">黑白用量</dt><dd className="mt-1 font-semibold text-slate-900">{settlement.bwUsage.toString()}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">彩色用量</dt><dd className="mt-1 font-semibold text-slate-900">{settlement.colorUsage.toString()}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">BW Equivalent</dt><dd className="mt-1 font-semibold text-slate-900">{settlement.bwEquivalentUsage.toString()}</dd></div></dl><div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>项目</th><th className={thClass}>客户侧</th><th className={thClass}>供应商侧</th></tr></thead><tbody><tr><td className={tdClass}>实际月租</td><td className={tdClass}>¥{settlement.customer.actualMonthlyRent.toString()}</td><td className={tdClass}>¥{settlement.supplier?.actualMonthlyRent.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}>实际免费额度</td><td className={tdClass}>{settlement.customer.actualFreeQuota.toString()}</td><td className={tdClass}>{settlement.supplier?.actualFreeQuota.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}>超印量</td><td className={tdClass}>{settlement.customer.overageUsage.toString()}</td><td className={tdClass}>{settlement.supplier?.overageUsage.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}>超印费</td><td className={tdClass}>¥{settlement.customer.overageFee.toString()}</td><td className={tdClass}>¥{settlement.supplier?.overageFee.toString() ?? "未配置"}</td></tr><tr><td className={tdClass}><b>当月金额</b></td><td className={tdClass}><b>¥{settlement.customer.monthlyAmount.toString()}</b></td><td className={tdClass}><b>¥{settlement.supplier?.monthlyAmount.toString() ?? "未配置"}</b></td></tr></tbody></table></div><dl className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-3"><dt className="text-xs text-emerald-600">客户应收</dt><dd className="mt-1 font-semibold text-emerald-900">¥{settlement.customer.monthlyAmount.toString()}</dd></div><div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs text-slate-600">供应商应付</dt><dd className="mt-1 font-semibold text-slate-900">{settlement.supplier ? `¥${settlement.supplier.monthlyAmount.toString()}` : "未配置"}</dd></div>{settlement.operatingGrossProfit ? <div className={`rounded-xl p-3 ${settlement.operatingGrossProfit.gte(0) ? "bg-blue-50" : "bg-red-50"}`}><dt className={`text-xs ${settlement.operatingGrossProfit.gte(0) ? "text-blue-600" : "text-red-600"}`}>运营毛利</dt><dd className={`mt-1 font-semibold ${settlement.operatingGrossProfit.gte(0) ? "text-blue-900" : "text-red-900"}`}>¥{settlement.operatingGrossProfit.toString()}</dd></div> : <div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs text-slate-600">运营毛利</dt><dd className="mt-1 font-semibold text-slate-900">暂不可计算</dd></div>}</dl></section> : null}
  </div>;
}
