import { createSupplier } from "@/actions/master-data";
import { SupplierForm } from "@/components/master-data-forms";
import { PageHeader } from "@/components/master-data-ui";
export default function NewSupplierPage() { return <div className="mx-auto max-w-5xl"><PageHeader title="新增供应商"/><SupplierForm action={createSupplier} cancelHref="/suppliers"/></div>; }
