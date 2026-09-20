import { connection } from "next/server";
import { createPrinter } from "@/actions/printers";
import { PageHeader } from "@/components/master-data-ui";
import { PrinterForm, type PrinterSelectOption } from "@/components/printer-forms";
import { deviceTypeLabel, hasDeploymentCapacity } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

export default async function NewPrinterPage({ searchParams }: { searchParams: Promise<{ customerOrderItemId?: string; supplierOrderItemId?: string }> }) {
  await connection();
  const { customerOrderItemId, supplierOrderItemId } = await searchParams;
  const [customerItems, supplierItems, machineModels] = await Promise.all([
    prisma.customerOrderItem.findMany({
      where: { order: { status: { not: "cancelled" } } },
      include: {
        customerPackage: { select: { packageName: true, version: true } },
        order: { select: { orderNo: true, customer: { select: { customerName: true } }, location: { select: { locationName: true } } } },
        printers: { where: { status: "active" }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.supplierOrderItem.findMany({
      where: { order: { status: { not: "cancelled" } } },
      include: {
        supplierPackage: { select: { packageName: true, version: true } },
        order: { select: { orderNo: true, supplier: { select: { supplierName: true } } } },
        printers: { where: { status: "active" }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.machineModel.findMany({ orderBy: [{ brand: "asc" }, { modelName: "asc" }] }),
  ]);
  const customerOptions: PrinterSelectOption[] = customerItems
    .filter((item) => hasDeploymentCapacity(item.printers.length, item.quantity))
    .map((item) => ({
      id: item.id,
      label: `订单 ${item.order.orderNo} · ${item.order.customer.customerName} · ${item.order.location?.locationName ?? "—"} · ${item.customerPackage.packageName} V${item.customerPackage.version} · 已部署 ${item.printers.length}/${item.quantity}`,
    }));
  const supplierOptions: PrinterSelectOption[] = supplierItems
    .filter((item) => hasDeploymentCapacity(item.printers.length, item.quantity))
    .map((item) => ({
      id: item.id,
      label: `订单 ${item.order.orderNo} · ${item.order.supplier.supplierName} · ${item.supplierPackage.packageName} V${item.supplierPackage.version} · 已交付 ${item.printers.length}/${item.quantity}`,
    }));
  const modelOptions: PrinterSelectOption[] = machineModels.map((model) => ({
    id: model.id,
    label: `${model.brand} ${model.modelName}（${deviceTypeLabel[model.deviceType]}）${model.status === "inactive" ? " · 已停用" : ""}`,
  }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="创建时必须选择客户订单明细、供应商订单明细与机型；客户、地点、合同、套餐通过订单明细自动追溯。" title="新增打印机" />
    <PrinterForm
      action={createPrinter}
      cancelHref="/printers"
      customerItems={customerOptions}
      initialCustomerItemId={customerOrderItemId}
      initialSupplierItemId={supplierOrderItemId}
      machineModels={modelOptions}
      supplierItems={supplierOptions}
    />
  </div>;
}
