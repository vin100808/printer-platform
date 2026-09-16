import { connection } from "next/server";
import { createSupplierOrder } from "@/actions/orders";
import { SupplierOrderForm, type SupplierOrderParty, type SupplierPackageOption } from "@/components/order-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function NewSupplierOrderPage() {
  await connection();
  const [suppliers, packages] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { supplierCode: "asc" },
      include: { contracts: { orderBy: { effectiveDate: "desc" }, select: { id: true, contractNo: true, contractName: true, status: true } } },
    }),
    prisma.supplierPackage.findMany({ orderBy: [{ packageCode: "asc" }, { version: "desc" }] }),
  ]);
  const parties: SupplierOrderParty[] = suppliers.map((supplier) => ({
    id: supplier.id,
    code: supplier.supplierCode,
    name: supplier.supplierName,
    contracts: supplier.contracts.map((contract) => ({ id: contract.id, label: `${contract.contractName}（${contract.contractNo}）${contract.status === "inactive" ? " · 已停用" : ""}` })),
  }));
  const packageOptions: SupplierPackageOption[] = packages.map((pkg) => ({
    id: pkg.id,
    supplierId: pkg.supplierId,
    label: `${pkg.packageName} V${pkg.version}（¥${pkg.monthlyRent.toString()}/月）${pkg.status === "inactive" ? " · 已停用" : ""}`,
  }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="向供应商采购设备的订单；数量代表采购台数，未来对应 Printer。" title="新增供应商订单" /><SupplierOrderForm action={createSupplierOrder} cancelHref="/supplier-orders" parties={parties} packages={packageOptions} /></div>;
}
