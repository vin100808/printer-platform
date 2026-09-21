import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { deviceTypeLabel, printerStatusLabel } from "@/lib/printers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const statusClass: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-slate-100 text-slate-600",
  replaced: "bg-amber-50 text-amber-700",
  removed: "bg-red-50 text-red-700",
};

const selectClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default async function PrintersPage({ searchParams }: { searchParams: Promise<{ customerId?: string; locationId?: string; supplierId?: string; machineModelId?: string; status?: string }> }) {
  await connection();
  const { customerId, locationId, supplierId, machineModelId, status } = await searchParams;

  const orderWhere: Prisma.CustomerOrderWhereInput = {};
  if (customerId) orderWhere.customerId = customerId;
  if (locationId) orderWhere.locationId = locationId;
  const where: Prisma.PrinterWhereInput = {
    ...(machineModelId ? { machineModelId } : {}),
    ...(status ? { status: status as Prisma.EnumPrinterStatusFilter["equals"] } : {}),
    ...(Object.keys(orderWhere).length ? { customerOrderItem: { order: orderWhere } } : {}),
    ...(supplierId ? { supplierOrderItem: { order: { supplierId } } } : {}),
  };

  const [printers, customers, locations, suppliers, machineModels] = await Promise.all([
    prisma.printer.findMany({
      where,
      include: {
        machineModel: { select: { brand: true, modelName: true, deviceType: true } },
        customerOrderItem: { select: { order: { select: { orderNo: true, customer: { select: { customerName: true } }, location: { select: { locationName: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({ orderBy: { customerCode: "asc" }, select: { id: true, customerCode: true, customerName: true } }),
    prisma.location.findMany({ orderBy: { locationCode: "asc" }, select: { id: true, locationName: true, customer: { select: { customerName: true } } } }),
    prisma.supplier.findMany({ orderBy: { supplierCode: "asc" }, select: { id: true, supplierCode: true, supplierName: true } }),
    prisma.machineModel.findMany({ orderBy: [{ brand: "asc" }, { modelName: "asc" }], select: { id: true, brand: true, modelName: true } }),
  ]);

  const hasFilter = Boolean(customerId || locationId || supplierId || machineModelId || status);
  return <div className="mx-auto max-w-7xl"><PageHeader actionHref="/printers/new" actionLabel="新增打印机" description="打印机核心台账：一台打印机同时连接客户订单明细与供应商订单明细。" title="打印机台账" />
    <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
      <select className={selectClass} defaultValue={customerId ?? ""} name="customerId"><option value="">全部客户</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.customerCode} · {c.customerName}</option>)}</select>
      <select className={selectClass} defaultValue={locationId ?? ""} name="locationId"><option value="">全部地点</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.locationName}（{l.customer.customerName}）</option>)}</select>
      <select className={selectClass} defaultValue={supplierId ?? ""} name="supplierId"><option value="">全部供应商</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplierCode} · {s.supplierName}</option>)}</select>
      <select className={selectClass} defaultValue={machineModelId ?? ""} name="machineModelId"><option value="">全部机型</option>{machineModels.map((m) => <option key={m.id} value={m.id}>{m.brand} {m.modelName}</option>)}</select>
      <select className={selectClass} defaultValue={status ?? ""} name="status"><option value="">全部状态</option>{Object.entries(printerStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <div className="flex gap-2"><button className="flex-1 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">筛选</button>{hasFilter ? <Link className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" href="/printers">重置</Link> : null}</div>
    </form>
    {!printers.length ? <div className="mt-6"><EmptyState>没有符合条件的打印机。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>打印机编码</th><th className={thClass}>机型</th><th className={thClass}>客户 / 地点</th><th className={thClass}>进场日期</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{printers.map((printer) => <tr key={printer.id}><td className={tdClass}><b>{printer.printerCode}</b><br /><span className="text-xs text-slate-400">资产 {printer.supplierAssetCode ?? "—"}</span></td><td className={tdClass}>{printer.machineModel.brand} {printer.machineModel.modelName}<br /><span className="text-xs text-slate-400">{deviceTypeLabel[printer.machineModel.deviceType]}</span></td><td className={tdClass}>{printer.customerOrderItem.order.customer.customerName}<br /><span className="text-xs text-slate-400">{printer.customerOrderItem.order.location?.locationName ?? "—"} · 订单 {printer.customerOrderItem.order.orderNo}</span></td><td className={tdClass}>{printer.entryDate.toLocaleDateString("zh-CN")}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[printer.status] ?? "bg-slate-100 text-slate-600"}`}>{printerStatusLabel[printer.status]}</span></td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/printers/${printer.id}`}>查看</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
