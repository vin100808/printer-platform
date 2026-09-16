"use client";

import type { FormState } from "@/actions/master-data";
import { CodeField, Field, FormShell, SelectStatus, area, input } from "@/components/master-data-forms";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

type MachineModelValue = { brand: string; modelName: string; deviceType: "black_white" | "color"; status: "active" | "inactive"; remark: string | null };

export type PackageValue = {
  packageCode: string;
  packageName: string;
  monthlyRent: string;
  monthlyFreeBwEquivalent: string;
  overageRateBwEquivalent: string;
  effectiveFrom: string;
  status: "active" | "inactive";
  remark: string | null;
};

export type PartyOption = { id: string; code: string; name: string };
export type MachineModelOption = { id: string; label: string };

export type PackageMode = "create" | "edit" | "new-version";

export function MachineModelForm({ action, value, cancelHref }: { action: Action; value?: MachineModelValue; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <Field defaultValue={value?.brand} label="品牌" name="brand" required /><Field defaultValue={value?.modelName} label="型号名称" name="modelName" required />
    <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">机器类型 *</span><select className={input} defaultValue={value?.deviceType ?? "black_white"} name="deviceType"><option value="black_white">黑白（仅黑白读数）</option><option value="color">彩色（黑白 + 彩色读数）</option></select></label><SelectStatus value={value?.status} />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value?.remark ?? ""} name="remark" /></label>
  </FormShell>;
}

export function PackageForm({
  action,
  kind,
  mode,
  parties,
  machineModels,
  value,
  selectedModelIds = [],
  selectedPartyId = "",
  versionLabel,
  cancelHref,
}: {
  action: Action;
  kind: "customer" | "supplier";
  mode: PackageMode;
  parties: PartyOption[];
  machineModels: MachineModelOption[];
  value?: PackageValue;
  selectedModelIds?: string[];
  selectedPartyId?: string;
  versionLabel: string;
  cancelHref: string;
}) {
  const isCustomer = kind === "customer";
  const pricesEditable = mode !== "edit";

  const codeField = mode === "create"
    ? <Field label="套餐编码" name="packageCode" placeholder="例如 CP-STD-A" required />
    : <CodeField label="套餐编码" value={value?.packageCode} />;
  const versionField = <CodeField label="版本" value={versionLabel} />;

  const partyField = mode === "create" ? (
    isCustomer ? (
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">归属客户</span><select className={input} defaultValue={selectedPartyId} name="customerId"><option value="">标准套餐（不指定客户）</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.code} · {party.name}</option>)}</select><span className="mt-1 block text-xs text-slate-400">指定客户后即为该客户的专属套餐</span></label>
    ) : (
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">供应商 *</span><select className={input} defaultValue={selectedPartyId} name="supplierId" required><option value="">请选择</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.code} · {party.name}</option>)}</select></label>
    )
  ) : (
    <CodeField label={isCustomer ? "归属客户" : "供应商"} value={parties.find((party) => party.id === selectedPartyId) ? `${parties.find((party) => party.id === selectedPartyId)?.code} · ${parties.find((party) => party.id === selectedPartyId)?.name}` : "标准套餐"} />
  );

  const priceFields = pricesEditable ? (<>
    <Field defaultValue={value?.monthlyRent} label="月租（元）" name="monthlyRent" required step="0.01" type="number" />
    <Field defaultValue={value?.monthlyFreeBwEquivalent} label="每月免费 BW Equivalent 额度" name="monthlyFreeBwEquivalent" required step="0.01" type="number" />
    <Field defaultValue={value?.overageRateBwEquivalent} label="超印单价（元 / BW Equivalent）" name="overageRateBwEquivalent" required step="0.0001" type="number" />
  </>) : (<>
    <CodeField label="月租（元）" value={value?.monthlyRent} />
    <CodeField label="每月免费 BW Equivalent 额度" value={value?.monthlyFreeBwEquivalent} />
    <CodeField label="超印单价（元 / BW Equivalent）" value={value?.overageRateBwEquivalent} />
    <p className="col-span-full -mt-2 text-xs text-slate-400">价格创建后不可修改；重新议价请使用「新建版本」。</p>
  </>);

  return <FormShell action={action} cancelHref={cancelHref}>
    {codeField}{versionField}
    <Field defaultValue={value?.packageName} label="套餐名称" name="packageName" required />{partyField}
    {priceFields}
    <Field defaultValue={value?.effectiveFrom} label="生效日期" name="effectiveFrom" required type="date" /><SelectStatus value={value?.status} />
    <fieldset className="col-span-full"><legend className="mb-2 text-sm font-medium text-slate-700">适配机型（可多选）</legend>{machineModels.length ? <div className="grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">{machineModels.map((model) => <label className="flex items-center gap-2 text-sm" key={model.id}><input defaultChecked={selectedModelIds.includes(model.id)} name="machineIds" type="checkbox" value={model.id} />{model.label}</label>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">暂无机型，请先到「机型管理」新增。</p>}</fieldset>
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value?.remark ?? ""} name="remark" /></label>
  </FormShell>;
}
