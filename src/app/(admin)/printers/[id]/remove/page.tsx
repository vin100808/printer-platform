import { notFound } from "next/navigation";
import { connection } from "next/server";
import { removePrinter } from "@/actions/printers";
import { PageHeader } from "@/components/master-data-ui";
import { PrinterRemoveForm } from "@/components/printer-forms";
import { prisma } from "@/lib/prisma";

export default async function RemovePrinterPage({ params }: PageProps<"/printers/[id]/remove">) {
  await connection();
  const { id } = await params;
  const printer = await prisma.printer.findUnique({ where: { id }, select: { printerCode: true, entryDate: true } });
  if (!printer) notFound();
  return <div className="mx-auto max-w-3xl"><PageHeader description="撤机后打印机保留历史记录，不删除。" title={`撤机 · ${printer.printerCode}`} />
    <PrinterRemoveForm
      action={removePrinter.bind(null, id)}
      cancelHref={`/printers/${id}`}
      value={{ oldPrinterLabel: printer.printerCode, entryDate: printer.entryDate.toLocaleDateString("zh-CN") }}
    />
  </div>;
}
