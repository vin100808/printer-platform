import { notFound } from "next/navigation";
import { connection } from "next/server";
import { replacePrinter } from "@/actions/printers";
import { PageHeader } from "@/components/master-data-ui";
import { PrinterReplaceForm } from "@/components/printer-forms";
import { deviceTypeLabel, hasDeploymentCapacity } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

export default async function ReplacePrinterPage({ params }: PageProps<"/printers/[id]/replace">) {
  await connection();
  const { id } = await params;
  const [printer, machineModels, supplierItems] = await Promise.all([
    prisma.printer.findUnique({
      where: { id },
      include: {
        machineModel: { select: { id: true } },
        customerOrderItem: { include: { customerPackage: { select: { packageName: true, version: true } }, order: { select: { orderNo: true, customer: { select: { customerName: true } }, location: { select: { locationName: true } } } } } },
        supplierOrderItem: { select: { id: true } },
      },
    }),
    prisma.machineModel.findMany({ orderBy: [{ brand: "asc" }, { modelName: "asc" }] }),
    prisma.supplierOrderItem.findMany({
      where: { order: { status: { not: "cancelled" } } },
      include: {
        supplierPackage: { select: { packageName: true, version: true } },
        order: { select: { orderNo: true, supplier: { select: { supplierName: true } } } },
        printers: { where: { status: "active", id: { not: id } }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!printer) notFound();
  const supplierOptions = supplierItems
    .filter((item) => hasDeploymentCapacity(item.printers.length, item.quantity))
    .map((item) => ({
      id: item.id,
      label: `订单 ${item.order.orderNo} · ${item.order.supplier.supplierName} · ${item.supplierPackage.packageName} V${item.supplierPackage.version} · 已交付 ${item.printers.length}/${item.quantity}${printer.supplierOrderItem && item.id === printer.supplierOrderItem.id ? "（当前）" : ""}`,
    }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="仅适用于故障 / 损坏 / 技术原因替换，不是新增业务；客户订单明细沿用原机。" title={`换机 · ${printer.printerCode}`} />
    <PrinterReplaceForm
      action={replacePrinter.bind(null, id)}
      cancelHref={`/printers/${id}`}
      machineModels={machineModels.map((model) => ({ id: model.id, label: `${model.brand} ${model.modelName}（${deviceTypeLabel[model.deviceType]}）${model.status === "inactive" ? " · 已停用" : ""}` }))}
      supplierItems={supplierOptions}
      value={{
        oldPrinterLabel: printer.printerCode,
        customerItemLabel: `订单 ${printer.customerOrderItem.order.orderNo} · ${printer.customerOrderItem.order.customer.customerName} · ${printer.customerOrderItem.order.location?.locationName ?? "—"} · ${printer.customerOrderItem.customerPackage.packageName} V${printer.customerOrderItem.customerPackage.version}`,
        machineModelId: printer.machineModel.id,
        supplierOrderItemId: printer.supplierOrderItem?.id ?? "",
        entryDate: printer.entryDate.toLocaleDateString("zh-CN"),
      }}
    />
  </div>;
}
