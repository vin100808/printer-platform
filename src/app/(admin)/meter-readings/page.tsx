import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { currentPeriod, meterStatusLabel } from "@/lib/meter";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function monthRange(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0)) };
}

function printerInclude() {
  return {
    machineModel: { select: { brand: true, modelName: true } },
    customerOrderItem: { include: { order: { include: { customer: { select: { customerName: true } }, location: { select: { locationName: true } } } } } },
  };
}

export default async function MeterReadingsPage() {
  await connection();
  const period = currentPeriod(new Date());
  const { start, end } = monthRange(period.year, period.month);
  const periodFilter = { readingYear: period.year, readingMonth: period.month };
  const dueWhere: Prisma.PrinterWhereInput = { entryDate: { lte: end }, OR: [{ exitDate: null }, { exitDate: { gte: start } }] };

  const [unsubmitted, submitted, history] = await Promise.all([
    prisma.printer.findMany({
      where: { ...dueWhere, meterReadings: { none: periodFilter } },
      include: printerInclude(),
      orderBy: { entryDate: "asc" },
    }),
    prisma.meterReading.findMany({
      where: periodFilter,
      include: { printer: { include: printerInclude() } },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.meterReading.findMany({
      include: { printer: { include: printerInclude() } },
      orderBy: [{ readingYear: "desc" }, { readingMonth: "desc" }, { submittedAt: "desc" }],
      take: 100,
    }),
  ]);
  const dueTotal = unsubmitted.length + submitted.length;
  const periodLabel = `${period.year} 年 ${period.month} 月`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader description={`当前业务月份：${periodLabel}；客户于次月 1-3 日扫码提交。`} title="抄表管理" />
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">本期应抄</p><p className="mt-2 text-3xl font-bold text-slate-950">{dueTotal}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">本期已抄</p><p className="mt-2 text-3xl font-bold text-emerald-700">{submitted.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">本期未抄</p><p className={`mt-2 text-3xl font-bold ${unsubmitted.length ? "text-red-700" : "text-slate-950"}`}>{unsubmitted.length}</p></div>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold">本期未抄（{unsubmitted.length}）</h2>
        {!unsubmitted.length ? <div className="mt-4"><EmptyState>本期全部机器已完成抄表。</EmptyState></div> : (
          <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>打印机</th><th className={thClass}>客户 / 地点</th><th className={thClass}>机型</th><th className={thClass}>进场日期</th><th className={thClass}></th></tr></thead><tbody>
            {unsubmitted.map((printer) => <tr key={printer.id}><td className={tdClass}><b>{printer.printerCode}</b></td><td className={tdClass}>{printer.customerOrderItem.order.customer.customerName}<br /><span className="text-xs text-slate-400">{printer.customerOrderItem.order.location?.locationName ?? "—"}</span></td><td className={tdClass}>{printer.machineModel.brand} {printer.machineModel.modelName}</td><td className={tdClass}>{printer.entryDate.toLocaleDateString("zh-CN")}</td><td className={tdClass}><div className="flex gap-3"><Link className="font-semibold text-blue-700" href={`/printers/${printer.id}`}>查看</Link><a className="font-semibold text-blue-700" href={`/meter/${printer.qrToken}`} target="_blank">抄表页</a></div></td></tr>)}
          </tbody></table></div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">本期已抄（{submitted.length}）</h2>
        {!submitted.length ? <div className="mt-4"><EmptyState>本期暂无已提交抄表。</EmptyState></div> : (
          <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>打印机</th><th className={thClass}>客户</th><th className={thClass}>黑白用量</th><th className={thClass}>彩色用量</th><th className={thClass}>BW Equivalent</th><th className={thClass}>状态</th><th className={thClass}>提交时间</th><th className={thClass}></th></tr></thead><tbody>
            {submitted.map((reading) => <tr key={reading.id}><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/printers/${reading.printerId}`}>{reading.printer.printerCode}</Link></td><td className={tdClass}>{reading.printer.customerOrderItem.order.customer.customerName}</td><td className={tdClass}>{reading.bwUsage}</td><td className={tdClass}>{reading.colorUsage}</td><td className={tdClass}>{reading.bwEquivalentUsage}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reading.status === "adjusted" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{meterStatusLabel(reading.status)}</span></td><td className={tdClass}>{reading.submittedAt.toLocaleString("zh-CN")}</td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/meter-readings/${reading.id}/edit`}>调整</Link></td></tr>)}
          </tbody></table></div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">历史记录（最近 {history.length} 条）</h2>
        {!history.length ? <div className="mt-4"><EmptyState>暂无抄表历史。</EmptyState></div> : (
          <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>业务月份</th><th className={thClass}>打印机</th><th className={thClass}>客户</th><th className={thClass}>BW Equivalent</th><th className={thClass}>状态</th><th className={thClass}>提交时间</th></tr></thead><tbody>
            {history.map((reading) => <tr key={reading.id}><td className={tdClass}><b>{reading.readingYear}-{String(reading.readingMonth).padStart(2, "0")}</b></td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/printers/${reading.printerId}`}>{reading.printer.printerCode}</Link></td><td className={tdClass}>{reading.printer.customerOrderItem.order.customer.customerName}</td><td className={tdClass}>{reading.bwEquivalentUsage}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reading.status === "adjusted" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{meterStatusLabel(reading.status)}</span></td><td className={tdClass}>{reading.submittedAt.toLocaleString("zh-CN")}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
