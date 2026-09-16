import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateCustomerContract } from "@/actions/master-data";
import { ContractForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";
export default async function EditCustomerContractPage({ params }: PageProps<"/customer-contracts/[id]/edit">) { await connection(); const { id } = await params; const [item, customers] = await Promise.all([prisma.customerFrameworkContract.findUnique({ where: { id }, include: { customers: { select: { id: true } } } }), prisma.customer.findMany({ orderBy: { customerCode: "asc" } })]); if (!item) notFound(); return <div className="mx-auto max-w-5xl"><PageHeader title={`编辑客户合同 · ${item.contractName}`}/><ContractForm action={updateCustomerContract.bind(null, id)} cancelHref="/customer-contracts" parties={customers.map((x) => ({ id: x.id, code: x.customerCode, name: x.customerName }))} partyKind="customer" selectedIds={item.customers.map((x) => x.id)} value={{ ...item, effectiveDate: formatDateInput(item.effectiveDate), expiryDate: formatDateInput(item.expiryDate) }}/></div>; }
