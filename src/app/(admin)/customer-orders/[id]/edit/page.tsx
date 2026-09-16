import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateCustomerOrder } from "@/actions/orders";
import { CustomerOrderEditForm, type ItemRowValue } from "@/components/order-forms";
import { PageHeader } from "@/components/master-data-ui";
import { formatDateInput } from "@/lib/master-data";
import { prisma } from "@/lib/prisma";

export default async function EditCustomerOrderPage({ params }: PageProps<"/customer-orders/[id]/edit">) {
  await connection();
  const { id } = await params;
  const [order, packages] = await Promise.all([
    prisma.customerOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { customerCode: true, customerName: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
    }),
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
  const initialRows: ItemRowValue[] = order.items.map((item) => ({
    packageId: item.customerPackageId,
    quantity: String(item.quantity),
    plannedEntryDate: formatDateInput(item.plannedEntryDate),
    remark: item.remark,
  }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="订单编号与客户不可修改；明细修改后整体替换保存。" title={`编辑客户订单 · ${order.orderNo}`} />
    <CustomerOrderEditForm
      action={updateCustomerOrder.bind(null, id)}
      cancelHref={`/customer-orders/${id}`}
      initialRows={initialRows}
      packages={packages.map((pkg) => ({ id: pkg.id, label: `${pkg.packageName} V${pkg.version}（¥${pkg.monthlyRent.toString()}/月）${pkg.status === "inactive" ? " · 已停用" : ""}` }))}
      value={{
        orderNo: order.orderNo,
        partyLabel: `${order.customer.customerCode} · ${order.customer.customerName}`,
        orderDate: formatDateInput(order.orderDate),
        status: order.status,
        attachmentUrl: order.orderAttachmentUrl,
        remark: order.remark,
      }}
    />
  </div>;
}
