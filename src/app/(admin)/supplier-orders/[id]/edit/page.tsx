import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateSupplierOrder } from "@/actions/orders";
import { SupplierOrderEditForm, type ItemRowValue } from "@/components/order-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";

export default async function EditSupplierOrderPage({ params }: PageProps<"/supplier-orders/[id]/edit">) {
  await connection();
  const { id } = await params;
  const [order, packages] = await Promise.all([
    prisma.supplierOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { supplierCode: true, supplierName: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.supplierOrder.findUnique({ where: { id }, select: { supplierId: true } }).then((found) =>
      found
        ? prisma.supplierPackage.findMany({ where: { supplierId: found.supplierId }, orderBy: [{ packageCode: "asc" }, { version: "desc" }] })
        : [],
    ),
  ]);
  if (!order) notFound();
  const initialRows: ItemRowValue[] = order.items.map((item) => ({
    packageId: item.supplierPackageId,
    quantity: String(item.quantity),
    plannedEntryDate: formatDateInput(item.plannedEntryDate),
    remark: item.remark,
  }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="订单编号与供应商不可修改；明细修改后整体替换保存。" title={`编辑供应商订单 · ${order.orderNo}`} />
    <SupplierOrderEditForm
      action={updateSupplierOrder.bind(null, id)}
      cancelHref={`/supplier-orders/${id}`}
      initialRows={initialRows}
      packages={packages.map((pkg) => ({ id: pkg.id, label: `${pkg.packageName} V${pkg.version}（¥${pkg.monthlyRent.toString()}/月）${pkg.status === "inactive" ? " · 已停用" : ""}` }))}
      value={{
        orderNo: order.orderNo,
        partyLabel: `${order.supplier.supplierCode} · ${order.supplier.supplierName}`,
        orderDate: formatDateInput(order.orderDate),
        status: order.status,
        attachmentUrl: order.orderAttachmentUrl,
        remark: order.remark,
      }}
    />
  </div>;
}
