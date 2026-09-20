import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { orderStatusLabel } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export default async function CustomerOrdersPage() {
  await connection();
  const orders = await prisma.customerOrder.findMany({
    include: {
      customer: { select: { customerName: true } },
      supplier: { select: { supplierName: true } },
      location: { select: { locationName: true } },
      items: { include: { customerPackage: { select: { packageName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <div className="mx-auto max-w-7xl"><PageHeader actionHref="/orders/new" actionLabel="新增订单" description="一个订单 = 一次完整租赁交易：一个客户、一个安装地址、一个供应商，可含多个套餐明细。" title="订单" />
    {!orders.length ? <div className="mt-6"><EmptyState>暂无订单，请先新增订单。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>订单编号</th><th className={thClass}>客户 / 安装地址</th><th className={thClass}>供应商</th><th className={thClass}>下单日期</th><th className={thClass}>明细</th><th className={thClass}>附件</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className={tdClass}><b>{order.orderNo}</b></td><td className={tdClass}>{order.customer.customerName}<br /><span className="text-xs text-slate-400">{order.installationAddress ?? order.location?.locationName ?? "—"}</span></td><td className={tdClass}>{order.supplier?.supplierName ?? "—"}</td><td className={tdClass}>{order.orderDate.toLocaleDateString("zh-CN")}</td><td className={tdClass}>{order.items.map((item) => `${item.customerPackage.packageName} × ${item.quantity}`).join("；")}</td><td className={tdClass}>{order.orderAttachmentUrl ? <a className="text-blue-700" href={order.orderAttachmentUrl} target="_blank">打开</a> : "—"}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === "cancelled" ? "bg-red-50 text-red-700" : order.status === "draft" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{orderStatusLabel[order.status]}</span></td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/orders/${order.id}`}>查看</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
