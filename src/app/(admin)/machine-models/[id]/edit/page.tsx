import { notFound } from "next/navigation";
import { connection } from "next/server";
import { deleteMachineModel, updateMachineModel } from "@/actions/catalog";
import { MachineModelForm } from "@/components/catalog-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function EditMachineModelPage({ params }: PageProps<"/machine-models/[id]/edit">) {
  await connection();
  const { id } = await params;
  const item = await prisma.machineModel.findUnique({ where: { id } });
  if (!item) notFound();
  return <div className="mx-auto max-w-5xl"><PageHeader description={`${item.brand} ${item.modelName}`} title="编辑机型" />
    <div className="mt-5"><form action={deleteMachineModel.bind(null, id)}><button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700" type="submit">删除机型</button></form></div>
    <MachineModelForm action={updateMachineModel.bind(null, id)} cancelHref="/machine-models" value={item} />
  </div>;
}
