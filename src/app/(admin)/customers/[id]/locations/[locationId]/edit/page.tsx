import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateLocation } from "@/actions/master-data";
import { LocationForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";
export default async function EditLocationPage({ params }: PageProps<"/customers/[id]/locations/[locationId]/edit">) { await connection(); const { id, locationId } = await params; const item = await prisma.location.findFirst({ where: { id: locationId, customerId: id }, include: { customer: { select: { customerName: true } } } }); if (!item) notFound(); return <div className="mx-auto max-w-5xl"><PageHeader description={item.customer.customerName} title={`编辑 Location · ${item.locationName}`}/><LocationForm action={updateLocation.bind(null, id, locationId)} cancelHref={`/customers/${id}`} value={item}/></div>; }
