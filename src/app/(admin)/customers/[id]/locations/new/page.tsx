import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createLocation } from "@/actions/master-data";
import { LocationForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";
export default async function NewLocationPage({ params }: PageProps<"/customers/[id]/locations/new">) { await connection(); const { id } = await params; const customer = await prisma.customer.findUnique({ where: { id }, select: { customerName: true } }); if (!customer) notFound(); return <div className="mx-auto max-w-5xl"><PageHeader description={customer.customerName} title="新增 Location"/><LocationForm action={createLocation.bind(null, id)} cancelHref={`/customers/${id}`}/></div>; }
