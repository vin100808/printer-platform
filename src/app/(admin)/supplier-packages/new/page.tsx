import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createSupplierPackage } from "@/actions/catalog";
import { PackageForm, type PackageValue } from "@/components/catalog-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";

export default async function NewSupplierPackagePage({ searchParams }: { searchParams: Promise<{ versionOf?: string }> }) {
  await connection();
  const { versionOf } = await searchParams;
  const [source, suppliers, machineModels] = await Promise.all([
    versionOf
      ? prisma.supplierPackage.findUnique({ where: { id: versionOf }, include: { machineModels: { select: { id: true } } } })
      : null,
    prisma.supplier.findMany({ orderBy: { supplierCode: "asc" } }),
    prisma.machineModel.findMany({ orderBy: [{ brand: "asc" }, { modelName: "asc" }] }),
  ]);
  if (versionOf && !source) notFound();

  const value: PackageValue = source
    ? {
        packageCode: source.packageCode,
        packageName: source.packageName,
        monthlyRent: source.monthlyRent.toString(),
        monthlyFreeBwEquivalent: source.monthlyFreeBwEquivalent.toString(),
        overageRateBwEquivalent: source.overageRateBwEquivalent.toString(),
        effectiveFrom: formatDateInput(new Date()),
        status: "active",
        remark: source.remark,
      }
    : {
        packageCode: "",
        packageName: "",
        monthlyRent: "",
        monthlyFreeBwEquivalent: "",
        overageRateBwEquivalent: "",
        effectiveFrom: formatDateInput(new Date()),
        status: "active",
        remark: null,
      };

  return <div className="mx-auto max-w-5xl"><PageHeader
    description={source ? "价格继承自源版本，可修改；保存后生成新版本，源版本保留且价格不变。" : "必须指定供应商；同一编码下版本号自动递增。"}
    title={source ? `新建版本 · ${source.packageName}（V${source.version + 1}）` : "新增供应商套餐"}
  /><PackageForm
    action={createSupplierPackage.bind(null, source?.id ?? null)}
    cancelHref={source ? `/supplier-packages/${source.id}` : "/supplier-packages"}
    kind="supplier"
    machineModels={machineModels.map((model) => ({ id: model.id, label: `${model.brand} ${model.modelName}（${model.deviceType === "color" ? "彩色" : "黑白"}${model.status === "inactive" ? " · 已停用" : ""}）` }))}
    mode={source ? "new-version" : "create"}
    parties={suppliers.map((supplier) => ({ id: supplier.id, code: supplier.supplierCode, name: supplier.supplierName }))}
    selectedModelIds={source?.machineModels.map((model) => model.id) ?? []}
    selectedPartyId={source?.supplierId ?? ""}
    value={value}
    versionLabel={source ? `V${source.version + 1}` : "V1"}
  /></div>;
}
