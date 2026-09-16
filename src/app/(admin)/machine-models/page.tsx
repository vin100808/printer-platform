import Link from "next/link";
import { connection } from "next/server";
import { EmptyState, PageHeader, StatusBadge, tableClass, tdClass, thClass } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function MachineModelsPage() {
  await connection();
  const models = await prisma.machineModel.findMany({
    include: { _count: { select: { customerPackages: true, supplierPackages: true } } },
    orderBy: [{ brand: "asc" }, { modelName: "asc" }],
  });
  return <div className="mx-auto max-w-7xl"><PageHeader actionHref="/machine-models/new" actionLabel="新增机型" description="维护可租赁的机器型号；黑白机仅抄黑白读数，彩色机需同时抄黑白与彩色读数。" title="机型管理" />
    {!models.length ? <div className="mt-6"><EmptyState>暂无机型，请先新增机型。</EmptyState></div> : <div className="overflow-x-auto"><table className={tableClass}><thead><tr><th className={thClass}>机型</th><th className={thClass}>类型</th><th className={thClass}>适配套餐</th><th className={thClass}>状态</th><th className={thClass}>备注</th><th className={thClass}></th></tr></thead><tbody>{models.map((model) => <tr key={model.id}><td className={tdClass}><p className="font-semibold text-slate-950">{model.brand} {model.modelName}</p></td><td className={tdClass}>{model.deviceType === "color" ? "彩色" : "黑白"}</td><td className={tdClass}>客户 {model._count.customerPackages} · 供应商 {model._count.supplierPackages}</td><td className={tdClass}><StatusBadge status={model.status} /></td><td className={tdClass}>{model.remark || "—"}</td><td className={tdClass}><Link className="font-semibold text-blue-700" href={`/machine-models/${model.id}/edit`}>编辑</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
