import { connection } from "next/server";
import { createCustomerOrder } from "@/actions/orders";
import { CustomerOrderForm, type CustomerOrderParty, type CustomerPackageOption } from "@/components/order-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerOrderPage() {
  await connection();
  const [customers, suppliers, packages] = await Promise.all([
    prisma.customer.findMany({ orderBy: { customerCode: "asc" }, select: { id: true, customerCode: true, customerName: true } }),
    prisma.supplier.findMany({ orderBy: { supplierCode: "asc" }, select: { id: true, supplierCode: true, supplierName: true } }),
    prisma.customerPackage.findMany({ orderBy: [{ packageCode: "asc" }, { version: "desc" }] }),
  ]);
  const parties: CustomerOrderParty[] = customers.map((customer) => ({
    id: customer.id,
    code: customer.customerCode,
    name: customer.customerName,
  }));
  const supplierOptions = suppliers.map((supplier) => ({
    id: supplier.id,
    code: supplier.supplierCode,
    name: supplier.supplierName,
  }));
  const packageOptions: CustomerPackageOption[] = packages.map((pkg) => ({
    id: pkg.id,
    customerId: pkg.customerId,
    label: `${pkg.packageName} V${pkg.version}（¥${pkg.monthlyRent.toString()}/月）${pkg.status === "inactive" ? " · 已停用" : ""}`,
  }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="一个订单 = 一次完整租赁交易：一个客户、一个安装地址、一个供应商，可含多个套餐明细；后续新增设备请新建订单。" title="新增订单" /><CustomerOrderForm action={createCustomerOrder} cancelHref="/orders" packages={packageOptions} parties={parties} suppliers={supplierOptions} /></div>;
}
