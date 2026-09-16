import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createCustomerPackage } from "@/actions/catalog";
import { PackageForm, type PackageValue } from "@/components/catalog-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerPackagePage({ searchParams }: { searchParams: Promise<{ versionOf?: string }> }) {
  await connection();
  const { versionOf } = await searchParams;
  const [source, customers, machineModels] = await Promise.all([
    versionOf
      ? prisma.customerPackage.findUnique({ where: { id: versionOf }, include: { machineModels: { select: { id: true } } } })
      : null,
    prisma.customer.findMany({ orderBy: { customerCode: "asc" } }),
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
    description={source ? "价格继承自源版本，可修改；保存后生成新版本，源版本保留且价格不变。" : "不指定客户即为标准套餐；同一编码下版本号自动递增。"}
    title={source ? `新建版本 · ${source.packageName}（V${source.version + 1}）` : "新增客户套餐"}
  /><PackageForm
    action={createCustomerPackage.bind(null, source?.id ?? null)}
    cancelHref={source ? `/customer-packages/${source.id}` : "/customer-packages"}
    kind="customer"
    machineModels={machineModels.map((model) => ({ id: model.id, label: `${model.brand} ${model.modelName}（${model.deviceType === "color" ? "彩色" : "黑白"}${model.status === "inactive" ? " · 已停用" : ""}）` }))}
    mode={source ? "new-version" : "create"}
    parties={customers.map((customer) => ({ id: customer.id, code: customer.customerCode, name: customer.customerName }))}
    selectedModelIds={source?.machineModels.map((model) => model.id) ?? []}
    selectedPartyId={source?.customerId ?? ""}
    value={value}
    versionLabel={source ? `V${source.version + 1}` : "V1"}
  /></div>;
}
