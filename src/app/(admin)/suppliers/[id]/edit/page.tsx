import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateSupplier } from "@/actions/master-data";
import { SupplierForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";
export default async function EditSupplierPage({ params }: PageProps<"/suppliers/[id]/edit">) { await connection(); const { id } = await params; const item = await prisma.supplier.findUnique({ where: { id } }); if (!item) notFound(); return <div className="mx-auto max-w-5xl"><PageHeader title={`编辑供应商 · ${item.supplierName}`}/><SupplierForm action={updateSupplier.bind(null, id)} cancelHref={`/suppliers/${id}`} value={item}/></div>; }
