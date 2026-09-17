import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { deviceTypeLabel, printerStatusLabel } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

const statusClass: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-slate-100 text-slate-600",
  replaced: "bg-amber-50 text-amber-700",
  removed: "bg-red-50 text-red-700",
};

export default async function PrintersPage() {
  await connection();
  const printers = await prisma.printer.findMany({
    include: {
      machineModel: { select: { brand: true, modelName: true, deviceType: true } },
      customerOrderItem: { select: { order: { select: { orderNo: true, customer: { select: { customerName: true } }, location: { select: { locationName: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <div className="mx-auto max-w-7xl"><PageHeader actionHref="/printers/new" actionLabel="新增打印机" description="打印机核心台账：一台打印机同时连接客户订单明细与供应商订单明细。" title="打印机台账" />
    {!printers.length ? <div className="mt-6"><EmptyState>暂无打印机，请先从订单明细部署第一台打印机。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>打印机编码</th><th className={thClass}>机型</th><th className={thClass}>客户 / 地点</th><th className={thClass}>进场日期</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{printers.map((printer) => <tr key={printer.id}><td className={tdClass}><b>{printer.printerCode}</b><br /><span className="text-xs text-slate-400">资产 {printer.supplierAssetCode}</span></td><td className={tdClass}>{printer.machineModel.brand} {printer.machineModel.modelName}<br /><span className="text-xs text-slate-400">{deviceTypeLabel[printer.machineModel.deviceType]}</span></td><td className={tdClass}>{printer.customerOrderItem.order.customer.customerName}<br /><span className="text-xs text-slate-400">{printer.customerOrderItem.order.location.locationName} · 订单 {printer.customerOrderItem.order.orderNo}</span></td><td className={tdClass}>{printer.entryDate.toLocaleDateString("zh-CN")}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[printer.status] ?? "bg-slate-100 text-slate-600"}`}>{printerStatusLabel[printer.status]}</span></td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/printers/${printer.id}`}>查看</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
