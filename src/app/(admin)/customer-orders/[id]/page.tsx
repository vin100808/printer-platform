import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteCustomerOrder } from "@/actions/orders";
import { DetailItem, EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { deploymentStatus, orderStatusLabel } from "@/lib/orders";
import { hasDeploymentCapacity } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

export default async function CustomerOrderDetailPage({ params, searchParams }: PageProps<"/customer-orders/[id]">) {
  await connection();
  const { id } = await params;
  const { error } = await searchParams;
  const order = await prisma.customerOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { customerCode: true, customerName: true } },
      location: { select: { locationName: true, address: true } },
      customerContract: { select: { contractNo: true, contractName: true } },
      items: { include: { customerPackage: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  const deployedRows = await prisma.printer.groupBy({
    by: ["customerOrderItemId"],
    where: { customerOrderItemId: { in: order.items.map((item) => item.id) }, status: "active" },
    _count: { _all: true },
  });
  const deployedByItem = new Map(deployedRows.map((row) => [row.customerOrderItemId, row._count._all]));
  return <div className="mx-auto max-w-7xl"><PageHeader description={`下单日期 ${order.orderDate.toLocaleDateString("zh-CN")}`} title={`客户订单 · ${order.orderNo}`} />
    {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href={`/customer-orders/${id}/edit`}>编辑</Link><form action={deleteCustomerOrder.bind(null, id)}><button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">删除订单</button></form></div>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><DetailItem label="订单编号" value={order.orderNo} /><DetailItem label="客户" value={`${order.customer.customerName}（${order.customer.customerCode}）`} /><DetailItem label="部署地点" value={order.location ? `${order.location.locationName}（${order.location.address}）` : "—"} /><DetailItem label="客户框架合同" value={order.customerContract ? `${order.customerContract.contractName}（${order.customerContract.contractNo}）` : "—"} /><DetailItem label="下单日期" value={order.orderDate.toLocaleDateString("zh-CN")} /><DetailItem label="状态" value={<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === "cancelled" ? "bg-red-50 text-red-700" : order.status === "draft" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{orderStatusLabel[order.status]}</span>} /><DetailItem label="订单附件" value={order.orderAttachmentUrl ? <a className="text-blue-700" href={order.orderAttachmentUrl} target="_blank">打开附件</a> : "—"} /><DetailItem label="备注" value={order.remark} /></div></section>
    <section className="mt-8"><h2 className="text-xl font-bold">订单明细</h2>{!order.items.length ? <div className="mt-4"><EmptyState>暂无明细。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>套餐</th><th className={thClass}>订单数量</th><th className={thClass}>已部署</th><th className={thClass}>部署状态</th><th className={thClass}>计划进场日期</th><th className={thClass}>备注</th><th className={thClass}></th></tr></thead><tbody>{order.items.map((item) => {
      const deployed = deployedByItem.get(item.id) ?? 0;
      const status = deploymentStatus(deployed, item.quantity);
      return <tr key={item.id}><td className={tdClass}><b>{item.customerPackage.packageName}</b><br /><span className="text-xs text-slate-400">{item.customerPackage.packageCode} · V{item.customerPackage.version}</span></td><td className={tdClass}>{item.quantity}</td><td className={tdClass}>{deployed} / {item.quantity}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "已部署" ? "bg-emerald-50 text-emerald-700" : status === "部分部署" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{status}</span></td><td className={tdClass}>{item.plannedEntryDate?.toLocaleDateString("zh-CN") ?? "—"}</td><td className={tdClass}>{item.remark || "—"}</td><td className={tdClass}>{hasDeploymentCapacity(deployed, item.quantity) && order.status !== "cancelled" ? <Link className="font-semibold text-blue-700" href={`/printers/new?customerOrderItemId=${item.id}`}>部署打印机</Link> : "—"}</td></tr>;
    })}</tbody></table></div>}</section>
  </div>;
}
