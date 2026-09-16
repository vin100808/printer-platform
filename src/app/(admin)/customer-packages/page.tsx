import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, StatusBadge, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function CustomerPackagesPage() {
  await connection();
  const packages = await prisma.customerPackage.findMany({
    include: { customer: { select: { customerCode: true, customerName: true } }, _count: { select: { machineModels: true } } },
    orderBy: [{ packageCode: "asc" }, { version: "desc" }],
  });
  return <div className="mx-auto max-w-7xl"><PageHeader actionHref="/customer-packages/new" actionLabel="新增客户套餐" description="卖给客户的套餐；不指定客户即为标准套餐。价格变更必须新建版本，历史版本价格不可修改。" title="客户套餐" />
    {!packages.length ? <div className="mt-6"><EmptyState>暂无客户套餐，请先新增套餐。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>套餐</th><th className={thClass}>版本</th><th className={thClass}>归属</th><th className={thClass}>月租</th><th className={thClass}>免费额度</th><th className={thClass}>超印单价</th><th className={thClass}>生效日期</th><th className={thClass}>机型</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{packages.map((item) => <tr key={item.id}><td className={tdClass}><p className="font-semibold text-slate-950">{item.packageName}</p><p className="text-xs text-slate-400">{item.packageCode}</p></td><td className={tdClass}>V{item.version}</td><td className={tdClass}>{item.customer ? `${item.customer.customerName}` : "标准套餐"}</td><td className={tdClass}>¥{item.monthlyRent.toString()}</td><td className={tdClass}>{item.monthlyFreeBwEquivalent.toString()}</td><td className={tdClass}>{item.overageRateBwEquivalent.toString()}</td><td className={tdClass}>{item.effectiveFrom.toLocaleDateString("zh-CN")}</td><td className={tdClass}>{item._count.machineModels}</td><td className={tdClass}><StatusBadge status={item.status} /></td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/customer-packages/${item.id}`}>查看</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
