import { connection } from "next/server";
import { createCustomerOrder } from "@/actions/orders";
import { CustomerOrderForm, type CustomerOrderParty, type CustomerPackageOption } from "@/components/order-forms";
import { PageHeader } from "@/components/master-data-ui";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerOrderPage() {
  await connection();
  const [customers, packages] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { customerCode: "asc" },
      include: {
        locations: { orderBy: { locationCode: "asc" }, select: { id: true, locationName: true, address: true, status: true } },
        customerFrameworkContracts: { orderBy: { effectiveDate: "desc" }, select: { id: true, contractNo: true, contractName: true, status: true } },
      },
    }),
    prisma.customerPackage.findMany({ orderBy: [{ packageCode: "asc" }, { version: "desc" }] }),
  ]);
  const parties: CustomerOrderParty[] = customers.map((customer) => ({
    id: customer.id,
    code: customer.customerCode,
    name: customer.customerName,
    locations: customer.locations.map((location) => ({ id: location.id, label: `${location.locationName}（${location.address}）${location.status === "inactive" ? " · 已停用" : ""}` })),
    contracts: customer.customerFrameworkContracts.map((contract) => ({ id: contract.id, label: `${contract.contractName}（${contract.contractNo}）${contract.status === "inactive" ? " · 已停用" : ""}` })),
  }));
  const packageOptions: CustomerPackageOption[] = packages.map((pkg) => ({
    id: pkg.id,
    customerId: pkg.customerId,
    label: `${pkg.packageName} V${pkg.version}（¥${pkg.monthlyRent.toString()}/月）${pkg.status === "inactive" ? " · 已停用" : ""}`,
  }));
  return <div className="mx-auto max-w-5xl"><PageHeader description="一个订单只属于一个部署地点；数量代表购买的服务台数，未来对应 Printer。" title="新增客户订单" /><CustomerOrderForm action={createCustomerOrder} cancelHref="/customer-orders" parties={parties} packages={packageOptions} /></div>;
}
