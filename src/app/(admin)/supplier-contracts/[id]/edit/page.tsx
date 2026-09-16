import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateSupplierContract } from "@/actions/master-data";
import { ContractForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";
export default async function EditSupplierContractPage({ params }: PageProps<"/supplier-contracts/[id]/edit">) { await connection(); const { id } = await params; const [item, suppliers] = await Promise.all([prisma.supplierFrameworkContract.findUnique({ where: { id } }), prisma.supplier.findMany({ orderBy: { supplierCode: "asc" } })]); if (!item) notFound(); return <div className="mx-auto max-w-5xl"><PageHeader title={`编辑供应商合同 · ${item.contractName}`}/><ContractForm action={updateSupplierContract.bind(null, id)} cancelHref="/supplier-contracts" parties={suppliers.map((x) => ({ id: x.id, code: x.supplierCode, name: x.supplierName }))} partyKind="supplier" selectedIds={[item.supplierId]} value={{ ...item, effectiveDate: formatDateInput(item.effectiveDate), expiryDate: formatDateInput(item.expiryDate) }}/></div>; }
