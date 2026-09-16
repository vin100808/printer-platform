import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteSupplierOrder } from "@/actions/orders";
import { DetailItem, EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { deploymentStatus, orderStatusLabel } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export default async function SupplierOrderDetailPage({ params }: PageProps<"/supplier-orders/[id]">) {
  await connection();
  const { id } = await params;
  const order = await prisma.supplierOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { supplierCode: true, supplierName: true } },
      supplierContract: { select: { contractNo: true, contractName: true } },
      items: { include: { supplierPackage: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  return <div className="mx-auto max-w-7xl"><PageHeader description={`下单日期 ${order.orderDate.toLocaleDateString("zh-CN")}`} title={`供应商订单 · ${order.orderNo}`} />
    <div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href={`/supplier-orders/${id}/edit`}>编辑</Link><form action={deleteSupplierOrder.bind(null, id)}><button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">删除订单</button></form></div>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><DetailItem label="订单编号" value={order.orderNo} /><DetailItem label="供应商" value={`${order.supplier.supplierName}（${order.supplier.supplierCode}）`} /><DetailItem label="供应商框架合同" value={`${order.supplierContract.contractName}（${order.supplierContract.contractNo}）`} /><DetailItem label="下单日期" value={order.orderDate.toLocaleDateString("zh-CN")} /><DetailItem label="状态" value={<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === "cancelled" ? "bg-red-50 text-red-700" : order.status === "draft" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{orderStatusLabel[order.status]}</span>} /><DetailItem label="订单附件" value={order.orderAttachmentUrl ? <a className="text-blue-700" href={order.orderAttachmentUrl} target="_blank">打开附件</a> : "—"} /><DetailItem label="备注" value={order.remark} /></div></section>
    <section className="mt-8"><h2 className="text-xl font-bold">订单明细</h2>{!order.items.length ? <div className="mt-4"><EmptyState>暂无明细。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>套餐</th><th className={thClass}>订单数量</th><th className={thClass}>已部署</th><th className={thClass}>部署状态</th><th className={thClass}>计划进场日期</th><th className={thClass}>备注</th></tr></thead><tbody>{order.items.map((item) => {
      const deployed = 0; // TASK 05 接入 Printer 后动态计算
      const status = deploymentStatus(deployed, item.quantity);
      return <tr key={item.id}><td className={tdClass}><b>{item.supplierPackage.packageName}</b><br /><span className="text-xs text-slate-400">{item.supplierPackage.packageCode} · V{item.supplierPackage.version}</span></td><td className={tdClass}>{item.quantity}</td><td className={tdClass}>{deployed} / {item.quantity}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "已部署" ? "bg-emerald-50 text-emerald-700" : status === "部分部署" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{status}</span></td><td className={tdClass}>{item.plannedEntryDate?.toLocaleDateString("zh-CN") ?? "—"}</td><td className={tdClass}>{item.remark || "—"}</td></tr>;
    })}</tbody></table></div>}<p className="mt-3 text-xs text-slate-400">部署进度将在 TASK 05 接入 Printer 台账后自动统计；当前显示为 0 / 数量。</p></section>
  </div>;
}
