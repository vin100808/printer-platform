import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteCustomerPackage } from "@/actions/catalog";
import { DetailItem, EmptyState, PageHeader, StatusBadge, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function CustomerPackageDetailPage({ params }: PageProps<"/customer-packages/[id]">) {
  await connection();
  const { id } = await params;
  const item = await prisma.customerPackage.findUnique({
    where: { id },
    include: {
      customer: { select: { customerCode: true, customerName: true } },
      machineModels: { orderBy: [{ brand: "asc" }, { modelName: "asc" }] },
    },
  });
  if (!item) notFound();
  const versions = await prisma.customerPackage.findMany({
    where: { packageCode: item.packageCode },
    orderBy: { version: "desc" },
    include: { customer: { select: { customerName: true } } },
  });
  return <div className="mx-auto max-w-7xl"><PageHeader description={`${item.packageCode} · V${item.version}`} title={item.packageName} />
    <div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href={`/customer-packages/${id}/edit`}>编辑</Link><Link className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" href={`/customer-packages/new?versionOf=${id}`}>新建版本</Link><form action={deleteCustomerPackage.bind(null, id)}><button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">删除套餐</button></form></div>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"><DetailItem label="套餐编码" value={item.packageCode} /><DetailItem label="版本" value={`V${item.version}`} /><DetailItem label="归属" value={item.customer ? `${item.customer.customerName}（${item.customer.customerCode}）` : "标准套餐"} /><DetailItem label="生效日期" value={item.effectiveFrom.toLocaleDateString("zh-CN")} /><DetailItem label="状态" value={<StatusBadge status={item.status} />} /><DetailItem label="创建时间" value={item.createdAt.toLocaleString("zh-CN")} /><DetailItem label="备注" value={item.remark} /></div></section>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">价格</h2><div className="mt-4 grid gap-6 sm:grid-cols-3"><DetailItem label="月租（元）" value={`¥${item.monthlyRent.toString()}`} /><DetailItem label="每月免费 BW Equivalent 额度" value={item.monthlyFreeBwEquivalent.toString()} /><DetailItem label="超印单价（元 / BW Equivalent）" value={item.overageRateBwEquivalent.toString()} /></div><p className="mt-4 text-xs text-slate-400">价格创建后不可修改；重新议价请使用「新建版本」。</p></section>
    <section className="mt-8"><h2 className="text-xl font-bold">适配机型</h2>{!item.machineModels.length ? <div className="mt-4"><EmptyState>未关联机型。</EmptyState></div> : <div className="mt-4 flex flex-wrap gap-2">{item.machineModels.map((model) => <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700" key={model.id}>{model.brand} {model.modelName} · {model.deviceType === "color" ? "彩色" : "黑白"}</span>)}</div>}</section>
    <section className="mt-8"><h2 className="text-xl font-bold">版本历史</h2>{!versions.length ? null : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>版本</th><th className={thClass}>月租</th><th className={thClass}>免费额度</th><th className={thClass}>超印单价</th><th className={thClass}>生效日期</th><th className={thClass}>状态</th><th className={thClass}></th></tr></thead><tbody>{versions.map((version) => <tr key={version.id} className={version.id === id ? "bg-blue-50/50" : undefined}><td className={tdClass}>V{version.version}{version.id === id ? "（当前）" : ""}</td><td className={tdClass}>¥{version.monthlyRent.toString()}</td><td className={tdClass}>{version.monthlyFreeBwEquivalent.toString()}</td><td className={tdClass}>{version.overageRateBwEquivalent.toString()}</td><td className={tdClass}>{version.effectiveFrom.toLocaleDateString("zh-CN")}</td><td className={tdClass}><StatusBadge status={version.status} /></td><td className={tdClass}>{version.id === id ? <span className="text-sm text-slate-400">当前版本</span> : <Link className="font-semibold text-blue-700" href={`/customer-packages/${version.id}`}>查看</Link>}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
