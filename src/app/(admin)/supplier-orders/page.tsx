import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { orderStatusLabel } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export default async function SupplierOrdersPage() {
  await connection();
  const orders = await prisma.supplierOrder.findMany({
    include: {
      supplier: { select: { supplierName: true } },
      items: { include: { supplierPackage: { select: { packageName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <div className="mx-auto max-w-7xl"><PageHeader description="历史供应商采购订单只读存档；新流程中打印机进场不再依赖供应商订单。" title="供应商订单（历史存档）" />
    {!orders.length ? <div className="mt-6"><EmptyState>暂无供应商订单，请先新增订单。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>订单编号</th><th className={thClass}>供应商</th><th className={thClass}>下单日期</th><th className={thClass}>明细</th><th className={thClass}>附件</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td className={tdClass}><b>{order.orderNo}</b></td><td className={tdClass}>{order.supplier.supplierName}</td><td className={tdClass}>{order.orderDate.toLocaleDateString("zh-CN")}</td><td className={tdClass}>{order.items.map((item) => `${item.supplierPackage.packageName} × ${item.quantity}`).join("；")}</td><td className={tdClass}>{order.orderAttachmentUrl ? <a className="text-blue-700" href={order.orderAttachmentUrl} target="_blank">打开</a> : "—"}</td><td className={tdClass}><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === "cancelled" ? "bg-red-50 text-red-700" : order.status === "draft" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{orderStatusLabel[order.status]}</span></td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/supplier-orders/${order.id}`}>查看</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
