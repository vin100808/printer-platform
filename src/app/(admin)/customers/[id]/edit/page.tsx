import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateCustomer } from "@/actions/master-data";
import { CustomerForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) { await connection(); const { id } = await params; const item = await prisma.customer.findUnique({ where: { id } }); if (!item) notFound(); return <div className="mx-auto max-w-5xl"><PageHeader title={`编辑客户 · ${item.customerName}`} /><CustomerForm action={updateCustomer.bind(null, id)} cancelHref={`/customers/${id}`} value={item} /></div>; }
