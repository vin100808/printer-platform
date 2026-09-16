import { createMachineModel } from "@/actions/catalog";
import { MachineModelForm } from "@/components/catalog-forms";
import { PageHeader } from "@/components/master-data-ui";

export default function NewMachineModelPage() {
  return <div className="mx-auto max-w-5xl"><PageHeader description="同一品牌下型号名称不可重复。" title="新增机型" /><MachineModelForm action={createMachineModel} cancelHref="/machine-models" /></div>;
}
