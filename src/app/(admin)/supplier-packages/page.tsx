import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, StatusBadge, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function SupplierPackagesPage() {
  await connection();
  const packages = await prisma.supplierPackage.findMany({
    include: { supplier: { select: { supplierCode: true, supplierName: true } }, _count: { select: { machineModels: true } } },
    orderBy: [{ packageCode: "asc" }, { version: "desc" }],
  });
  return <div className="mx-auto max-w-7xl"><PageHeader description="历史供应商采购套餐只读存档；历史版本价格保留可查。" title="供应商套餐（历史存档）" />
    {!packages.length ? <div className="mt-6"><EmptyState>暂无供应商套餐，请先新增套餐。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>套餐</th><th className={thClass}>版本</th><th className={thClass}>供应商</th><th className={thClass}>月租</th><th className={thClass}>免费额度</th><th className={thClass}>超印单价</th><th className={thClass}>生效日期</th><th className={thClass}>机型</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{packages.map((item) => <tr key={item.id}><td className={tdClass}><p className="font-semibold text-slate-950">{item.packageName}</p><p className="text-xs text-slate-400">{item.packageCode}</p></td><td className={tdClass}>V{item.version}</td><td className={tdClass}>{item.supplier.supplierName}</td><td className={tdClass}>¥{item.monthlyRent.toString()}</td><td className={tdClass}>{item.monthlyFreeBwEquivalent.toString()}</td><td className={tdClass}>{item.overageRateBwEquivalent.toString()}</td><td className={tdClass}>{item.effectiveFrom.toLocaleDateString("zh-CN")}</td><td className={tdClass}>{item._count.machineModels}</td><td className={tdClass}><StatusBadge status={item.status} /></td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/supplier-packages/${item.id}`}>查看</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
