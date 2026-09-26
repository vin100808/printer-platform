import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateCustomerOrder } from "@/actions/orders";
import { CustomerOrderEditForm, type ItemRowValue } from "@/components/order-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";

export default async function EditCustomerOrderPage({ params }: PageProps<"/orders/[id]/edit">) {
  await connection();
  const { id } = await params;
  const [order, suppliers, packages] = await Promise.all([
    prisma.customerOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { customerCode: true, customerName: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.supplier.findMany({ orderBy: { supplierCode: "asc" }, select: { id: true, supplierCode: true, supplierName: true } }),
    prisma.customerOrder.findUnique({ where: { id }, select: { customerId: true } }).then((found) =>
      found
        ? prisma.customerPackage.findMany({
            where: { OR: [{ customerId: null }, { customerId: found.customerId }] },
            orderBy: [{ packageCode: "asc" }, { version: "desc" }],
          })
        : [],
    ),
  ]);
  if (!order) notFound();
  const deployedRows = await prisma.printer.groupBy({
    by: ["customerOrderItemId"],
    where: { customerOrderItemId: { in: order.items.map((item) => item.id) } },
    _count: { _all: true },
  });
  const deployedByItem: Record<string, number> = Object.fromEntries(deployedRows.map((row) => [row.customerOrderItemId, row._count._all]));
  const initialRows: ItemRowValue[] = order.items.map((item) => ({
    id: item.id,
    deployed: deployedByItem[item.id] ?? 0,
    packageId: item.customerPackageId,
    quantity: String(item.quantity),
    remark: item.remark,
  }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="客户不可修改；已部署设备的明细行不能更换套餐或删除，调低数量需确认风险提示。" title={`编辑订单 · ${order.orderNo}`} />
    <CustomerOrderEditForm
      action={updateCustomerOrder.bind(null, id)}
      cancelHref={`/orders/${id}`}
      deployedByItem={deployedByItem}
      initialRows={initialRows}
      packages={packages.map((pkg) => ({ id: pkg.id, label: `${pkg.packageName} V${pkg.version}（¥${pkg.monthlyRent.toString()}/月）${pkg.status === "inactive" ? " · 已停用" : ""}` }))}
      value={{
        orderNo: order.orderNo,
        partyLabel: `${order.customer.customerCode} · ${order.customer.customerName}`,
        supplierId: order.supplierId ?? "",
        suppliers: suppliers.map((supplier) => ({ id: supplier.id, code: supplier.supplierCode, name: supplier.supplierName })),
        installationAddress: order.installationAddress ?? "",
        startDate: formatDateInput(order.startDate),
        endDate: formatDateInput(order.endDate),
        billingCycle: order.billingCycle,
        orderDate: formatDateInput(order.orderDate),
        status: order.status,
        attachmentUrl: order.orderAttachmentUrl,
        contractAttachmentUrl: order.contractAttachmentUrl,
        depositReceivedDate: formatDateInput(order.depositReceivedDate),
        remark: order.remark,
      }}
    />
  </div>;
}
