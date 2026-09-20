import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updatePrinter } from "@/actions/printers";
import { PageHeader } from "@/components/master-data-ui";
import { PrinterEditForm } from "@/components/printer-forms";
import { deviceTypeLabel, printerStatusLabel } from "@/lib/printers";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";

export default async function EditPrinterPage({ params }: PageProps<"/printers/[id]/edit">) {
  await connection();
  const { id } = await params;
  const [printer, machineModels] = await Promise.all([
    prisma.printer.findUnique({
      where: { id },
      include: {
        machineModel: { select: { id: true } },
        customerOrderItem: { include: { customerPackage: { select: { packageName: true, version: true } }, order: { select: { orderNo: true, customer: { select: { customerName: true } }, location: { select: { locationName: true } } } } } },
        supplierOrderItem: { include: { supplierPackage: { select: { packageName: true, version: true } }, order: { select: { orderNo: true, supplier: { select: { supplierName: true } } } } } },
      },
    }),
    prisma.machineModel.findMany({ orderBy: [{ brand: "asc" }, { modelName: "asc" }] }),
  ]);
  if (!printer) notFound();
  return <div className="mx-auto max-w-5xl"><PageHeader description="订单明细关系不可修改；其余设备信息可修正。" title={`编辑打印机 · ${printer.printerCode}`} />
    <PrinterEditForm
      action={updatePrinter.bind(null, id)}
      cancelHref={`/printers/${id}`}
      machineModels={machineModels.map((model) => ({ id: model.id, label: `${model.brand} ${model.modelName}（${deviceTypeLabel[model.deviceType]}）${model.status === "inactive" ? " · 已停用" : ""}` }))}
      value={{
        printerCode: printer.printerCode,
        supplierAssetCode: printer.supplierAssetCode,
        customerItemLabel: `订单 ${printer.customerOrderItem.order.orderNo} · ${printer.customerOrderItem.order.customer.customerName} · ${printer.customerOrderItem.order.location?.locationName ?? "—"} · ${printer.customerOrderItem.customerPackage.packageName} V${printer.customerOrderItem.customerPackage.version}`,
        supplierItemLabel: printer.supplierOrderItem ? `订单 ${printer.supplierOrderItem.order.orderNo} · ${printer.supplierOrderItem.order.supplier.supplierName} · ${printer.supplierOrderItem.supplierPackage.packageName} V${printer.supplierOrderItem.supplierPackage.version}` : "未关联供应商订单",
        machineModelId: printer.machineModel.id,
        entryDate: formatDateInput(printer.entryDate),
        initialBwReading: String(printer.initialBwReading),
        initialColorReading: String(printer.initialColorReading),
        statusLabel: printerStatusLabel[printer.status],
        remark: printer.remark,
      }}
    />
  </div>;
}
