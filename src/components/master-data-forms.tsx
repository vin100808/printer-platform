"use client";

import { useActionState } from "react";
import type { FormState } from "@/actions/master-data";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;
type Base = { status: "active" | "inactive"; remark: string | null };
type CustomerValue = Base & { customerCode: string; customerName: string; customerType: "internal" | "external"; taxpayerIdentificationNo: string | null; registeredAddress: string | null; bankName: string | null; bankAccountName: string | null; bankAccountNo: string | null; contactName: string | null; contactPhone: string | null };
type SupplierValue = Base & { supplierCode: string; supplierName: string; taxpayerIdentificationNo: string | null; registeredAddress: string | null; bankName: string | null; bankAccountName: string | null; bankAccountNo: string | null; contactName: string | null; contactPhone: string | null; serviceArea: string | null };
type LocationValue = Base & { locationCode: string; locationName: string; address: string; contactName: string | null; contactPhone: string | null };
type ContractValue = Base & { contractNo: string; contractName: string; effectiveDate: string; expiryDate: string; attachmentUrl?: string | null };

const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const area = `${input} min-h-24 resize-y`;

function Field({ label, name, defaultValue, required, type = "text", placeholder }: { label: string; name: string; defaultValue?: string | null; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">{label}{required ? " *" : ""}</span><input className={input} defaultValue={defaultValue ?? ""} name={name} placeholder={placeholder} required={required} type={type} /></label>;
}

function SelectStatus({ value = "active" }: { value?: "active" | "inactive" }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">状态 *</span><select className={input} defaultValue={value} name="status"><option value="active">启用</option><option value="inactive">停用</option></select></label>;
}

function Footer({ state, cancelHref, pending }: { state: FormState; cancelHref: string; pending: boolean }) {
  return <div className="col-span-full mt-2 flex items-center justify-between border-t border-slate-200 pt-5"><div>{state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}</div><div className="flex gap-3"><a className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" href={cancelHref}>取消</a><button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "保存中…" : "保存"}</button></div></div>;
}

function FormShell({ action, cancelHref, children }: { action: Action; cancelHref: string; children: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">{children}<Footer cancelHref={cancelHref} pending={pending} state={state} /></form>;
}

export function CustomerForm({ action, value, cancelHref }: { action: Action; value?: CustomerValue; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <Field defaultValue={value?.customerCode} label="客户编码" name="customerCode" required /><Field defaultValue={value?.customerName} label="客户名称" name="customerName" required />
    <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">客户类型 *</span><select className={input} defaultValue={value?.customerType ?? "external"} name="customerType"><option value="external">外部客户</option><option value="internal">内部客户</option></select></label><SelectStatus value={value?.status} />
    <Field defaultValue={value?.taxpayerIdentificationNo} label="纳税人识别号" name="taxpayerIdentificationNo" /><Field defaultValue={value?.registeredAddress} label="公司注册地址" name="registeredAddress" />
    <Field defaultValue={value?.bankName} label="开户银行" name="bankName" /><Field defaultValue={value?.bankAccountName} label="银行账户名称" name="bankAccountName" /><Field defaultValue={value?.bankAccountNo} label="银行账号" name="bankAccountNo" />
    <Field defaultValue={value?.contactName} label="联系人" name="contactName" /><Field defaultValue={value?.contactPhone} label="联系电话" name="contactPhone" />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value?.remark ?? ""} name="remark" /></label>
  </FormShell>;
}

export function SupplierForm({ action, value, cancelHref }: { action: Action; value?: SupplierValue; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <Field defaultValue={value?.supplierCode} label="供应商编码" name="supplierCode" required /><Field defaultValue={value?.supplierName} label="供应商名称" name="supplierName" required /><SelectStatus value={value?.status} />
    <Field defaultValue={value?.serviceArea} label="服务区域" name="serviceArea" /><Field defaultValue={value?.taxpayerIdentificationNo} label="纳税人识别号" name="taxpayerIdentificationNo" /><Field defaultValue={value?.registeredAddress} label="注册地址" name="registeredAddress" />
    <Field defaultValue={value?.bankName} label="开户银行" name="bankName" /><Field defaultValue={value?.bankAccountName} label="银行账户名称" name="bankAccountName" /><Field defaultValue={value?.bankAccountNo} label="银行账号" name="bankAccountNo" />
    <Field defaultValue={value?.contactName} label="联系人" name="contactName" /><Field defaultValue={value?.contactPhone} label="联系电话" name="contactPhone" />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value?.remark ?? ""} name="remark" /></label>
  </FormShell>;
}

export function LocationForm({ action, value, cancelHref }: { action: Action; value?: LocationValue; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <Field defaultValue={value?.locationCode} label="地点编码" name="locationCode" required /><Field defaultValue={value?.locationName} label="地点名称" name="locationName" required />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">实际部署地址 *</span><textarea className={area} defaultValue={value?.address ?? ""} name="address" required /></label>
    <Field defaultValue={value?.contactName} label="联系人" name="contactName" /><Field defaultValue={value?.contactPhone} label="联系电话" name="contactPhone" /><SelectStatus value={value?.status} />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value?.remark ?? ""} name="remark" /></label>
  </FormShell>;
}

export function ContractForm({ action, value, cancelHref, partyKind, parties, selectedIds = [] }: { action: Action; value?: ContractValue; cancelHref: string; partyKind: "customer" | "supplier"; parties: { id: string; code: string; name: string }[]; selectedIds?: string[] }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <Field defaultValue={value?.contractNo} label="合同编号" name="contractNo" required /><Field defaultValue={value?.contractName} label="合同名称" name="contractName" required />
    <Field defaultValue={value?.effectiveDate} label="生效日期" name="effectiveDate" required type="date" /><Field defaultValue={value?.expiryDate} label="到期日期" name="expiryDate" type="date" /><SelectStatus value={value?.status} />
    {partyKind === "supplier" ? <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">供应商 *</span><select className={input} defaultValue={selectedIds[0] ?? ""} name="supplierId" required><option value="">请选择</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label> : <fieldset className="col-span-full"><legend className="mb-2 text-sm font-medium text-slate-700">关联客户（可多选） *</legend><div className="grid gap-2 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">{parties.map((p) => <label className="flex items-center gap-2 text-sm" key={p.id}><input defaultChecked={selectedIds.includes(p.id)} name="customerIds" type="checkbox" value={p.id} />{p.code} · {p.name}</label>)}</div></fieldset>}
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">合同附件（PDF、Word、JPG、PNG，最大 10MB）</span><input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className={input} name="attachment" type="file" />{value?.attachmentUrl ? <a className="mt-2 inline-block text-sm font-medium text-blue-700" href={value.attachmentUrl} target="_blank">打开当前附件</a> : null}</label>
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value?.remark ?? ""} name="remark" /></label>
  </FormShell>;
}
