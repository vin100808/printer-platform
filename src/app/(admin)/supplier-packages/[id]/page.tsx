import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DetailItem, EmptyState, PageHeader, StatusBadge, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function SupplierPackageDetailPage({ params }: PageProps<"/supplier-packages/[id]">) {
  await connection();
  const { id } = await params;
  const item = await prisma.supplierPackage.findUnique({
    where: { id },
    include: {
      supplier: { select: { supplierCode: true, supplierName: true } },
      machineModels: { orderBy: [{ brand: "asc" }, { modelName: "asc" }] },
    },
  });
  if (!item) notFound();
  const versions = await prisma.supplierPackage.findMany({
    where: { packageCode: item.packageCode },
    orderBy: { version: "desc" },
    include: { supplier: { select: { supplierName: true } } },
  });
  return <div className="mx-auto max-w-7xl"><PageHeader description={`${item.packageCode} · V${item.version} · 历史供应商套餐，只读展示`} title={item.packageName} />
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><DetailItem label="套餐编码" value={item.packageCode} /><DetailItem label="版本" value={`V${item.version}`} /><DetailItem label="供应商" value={`${item.supplier.supplierName}（${item.supplier.supplierCode}）`} /><DetailItem label="生效日期" value={item.effectiveFrom.toLocaleDateString("zh-CN")} /><DetailItem label="状态" value={<StatusBadge status={item.status} />} /><DetailItem label="创建时间" value={item.createdAt.toLocaleString("zh-CN")} /><DetailItem label="备注" value={item.remark} /></div></section>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">价格</h2><div className="mt-4 grid gap-6 sm:grid-cols-3"><DetailItem label="月租（元）" value={`¥${item.monthlyRent.toString()}`} /><DetailItem label="每月免费 BW Equivalent 额度" value={item.monthlyFreeBwEquivalent.toString()} /><DetailItem label="超印单价（元 / BW Equivalent）" value={item.overageRateBwEquivalent.toString()} /></div><p className="mt-4 text-xs text-slate-400">历史价格只读存档；供应商侧定价现由订单与打印机关联关系承载。</p></section>
    <section className="mt-8"><h2 className="text-xl font-bold">适配机型</h2>{!item.machineModels.length ? <div className="mt-4"><EmptyState>未关联机型。</EmptyState></div> : <div className="mt-4 flex flex-wrap gap-2">{item.machineModels.map((model) => <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700" key={model.id}>{model.brand} {model.modelName} · {model.deviceType === "color" ? "彩色" : "黑白"}</span>)}</div>}</section>
    <section className="mt-8"><h2 className="text-xl font-bold">版本历史</h2>{!versions.length ? null : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>版本</th><th className={thClass}>月租</th><th className={thClass}>免费额度</th><th className={thClass}>超印单价</th><th className={thClass}>生效日期</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{versions.map((version) => <tr key={version.id} className={version.id === id ? "bg-blue-50/50" : undefined}><td className={tdClass}>V{version.version}{version.id === id ? "（当前）" : ""}</td><td className={tdClass}>¥{version.monthlyRent.toString()}</td><td className={tdClass}>{version.monthlyFreeBwEquivalent.toString()}</td><td className={tdClass}>{version.overageRateBwEquivalent.toString()}</td><td className={tdClass}>{version.effectiveFrom.toLocaleDateString("zh-CN")}</td><td className={tdClass}><StatusBadge status={version.status} /></td><td className={tdClass}>{version.id === id ? <span className="text-sm text-slate-400">当前版本</span> : <Link className="font-semibold text-blue-700" href={`/supplier-packages/${version.id}`}>查看</Link>}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
