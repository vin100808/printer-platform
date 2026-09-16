import { connection } from "next/server";
import { createCustomerContract } from "@/actions/master-data";
import { ContractForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";
export default async function NewCustomerContractPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) { await connection(); const { customerId } = await searchParams; const customers = await prisma.customer.findMany({ orderBy: { customerCode: "asc" } }); return <div className="mx-auto max-w-5xl"><PageHeader description="合同可以同时关联多个客户。" title="新增客户框架合同"/><ContractForm action={createCustomerContract} cancelHref="/customer-contracts" parties={customers.map((x) => ({ id: x.id, code: x.customerCode, name: x.customerName }))} partyKind="customer" selectedIds={customerId ? [customerId] : []}/></div>; }
