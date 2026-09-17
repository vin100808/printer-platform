import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, StatusBadge, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const { error } = await searchParams;
  const customers = await prisma.customer.findMany({ include: { _count: { select: { locations: true, customerFrameworkContracts: true } } }, orderBy: { createdAt: "desc" } });
  return <div className="mx-auto max-w-7xl"><PageHeader actionHref="/customers/new" actionLabel="新增客户" description="维护客户公司、银行、联系人、部署地点与框架合同。" title="客户管理" />
    {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {!customers.length ? <div className="mt-6"><EmptyState>暂无客户，请先新增客户。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>客户</th><th className={thClass}>类型</th><th className={thClass}>联系人</th><th className={thClass}>地点</th><th className={thClass}>合同</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{customers.map((item) => <tr key={item.id}><td className={tdClass}><p className="font-semibold text-slate-950">{item.customerName}</p><p className="text-xs text-slate-400">{item.customerCode}</p></td><td className={tdClass}>{item.customerType === "internal" ? "内部" : "外部"}</td><td className={tdClass}>{item.contactName || "—"}<br/><span className="text-xs text-slate-400">{item.contactPhone}</span></td><td className={tdClass}>{item._count.locations}</td><td className={tdClass}>{item._count.customerFrameworkContracts}</td><td className={tdClass}><StatusBadge status={item.status} /></td><td className={tdClass}><div className="flex gap-3"><Link className="font-semibold text-blue-700" href={`/customers/${item.id}`}>查看</Link><Link className="font-semibold text-blue-700" href={`/customers/${item.id}/locations/new`}>新增地点</Link></div></td></tr>)}</tbody></table></div>}
  </div>;
}
