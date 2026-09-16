import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateSupplierPackage } from "@/actions/catalog";
import { PackageForm } from "@/components/catalog-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";

export default async function EditSupplierPackagePage({ params }: PageProps<"/supplier-packages/[id]/edit">) {
  await connection();
  const { id } = await params;
  const [item, suppliers, machineModels] = await Promise.all([
    prisma.supplierPackage.findUnique({ where: { id }, include: { machineModels: { select: { id: true } } } }),
    prisma.supplier.findMany({ orderBy: { supplierCode: "asc" } }),
    prisma.machineModel.findMany({ orderBy: [{ brand: "asc" }, { modelName: "asc" }] }),
  ]);
  if (!item) notFound();
  return <div className="mx-auto max-w-5xl"><PageHeader description="价格与供应商不可修改；如需调整价格请返回详情页使用「新建版本」。" title={`编辑供应商套餐 · ${item.packageName}（V${item.version}）`} />
    <PackageForm
      action={updateSupplierPackage.bind(null, id)}
      cancelHref={`/supplier-packages/${id}`}
      kind="supplier"
      machineModels={machineModels.map((model) => ({ id: model.id, label: `${model.brand} ${model.modelName}（${model.deviceType === "color" ? "彩色" : "黑白"}${model.status === "inactive" ? " · 已停用" : ""}）` }))}
      mode="edit"
      parties={suppliers.map((supplier) => ({ id: supplier.id, code: supplier.supplierCode, name: supplier.supplierName }))}
      selectedModelIds={item.machineModels.map((model) => model.id)}
      selectedPartyId={item.supplierId}
      value={{
        packageCode: item.packageCode,
        packageName: item.packageName,
        monthlyRent: item.monthlyRent.toString(),
        monthlyFreeBwEquivalent: item.monthlyFreeBwEquivalent.toString(),
        overageRateBwEquivalent: item.overageRateBwEquivalent.toString(),
        effectiveFrom: formatDateInput(item.effectiveFrom),
        status: item.status,
        remark: item.remark,
      }}
      versionLabel={`V${item.version}`}
    />
  </div>;
}
