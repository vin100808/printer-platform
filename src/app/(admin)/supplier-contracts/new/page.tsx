import { connection } from "next/server";
import { createSupplierContract } from "@/actions/master-data";
import { ContractForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";
export default async function NewSupplierContractPage({ searchParams }: { searchParams: Promise<{ supplierId?: string }> }) { await connection(); const { supplierId } = await searchParams; const suppliers = await prisma.supplier.findMany({ orderBy: { supplierCode: "asc" } }); return <div className="mx-auto max-w-5xl"><PageHeader title="新增供应商框架合同"/><ContractForm action={createSupplierContract} cancelHref="/supplier-contracts" parties={suppliers.map((x) => ({ id: x.id, code: x.supplierCode, name: x.supplierName }))} partyKind="supplier" selectedIds={supplierId ? [supplierId] : []}/></div>; }
