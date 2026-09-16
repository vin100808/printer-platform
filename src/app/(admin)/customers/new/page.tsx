import { createCustomer } from "@/actions/master-data";
import { CustomerForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";

export default function NewCustomerPage() { return <div className="mx-auto max-w-5xl"><PageHeader description="注册地址与实际部署 Location 相互独立。" title="新增客户" /><CustomerForm action={createCustomer} cancelHref="/customers" /></div>; }
