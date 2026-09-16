"use client";

import { useState } from "react";
import type { FormState } from "@/actions/master-data";
import { CodeField, Field, FormShell, area, input } from "@/components/master-data-forms";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type CustomerOrderParty = {
  id: string;
  code: string;
  name: string;
  locations: { id: string; label: string }[];
  contracts: { id: string; label: string }[];
};

export type SupplierOrderParty = {
  id: string;
  code: string;
  name: string;
  contracts: { id: string; label: string }[];
};

export type CustomerPackageOption = { id: string; label: string; customerId: string | null };
export type SupplierPackageOption = { id: string; label: string; supplierId: string };

const statusOptions: { value: string; label: string }[] = [
  { value: "draft", label: "草稿" },
  { value: "confirmed", label: "已确认" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

function OrderStatusSelect({ defaultValue = "draft" }: { defaultValue?: string }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">订单状态 *</span><select className={input} defaultValue={defaultValue} name="status">{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function AttachmentField({ currentUrl }: { currentUrl?: string | null }) {
  return <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">订单附件（PDF、Word、JPG、PNG，最大 10MB）</span><input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className={input} name="attachment" type="file" />{currentUrl ? <a className="mt-2 inline-block text-sm font-medium text-blue-700" href={currentUrl} target="_blank">打开当前附件</a> : null}</label>;
}

export type ItemRowValue = { packageId: string; quantity: string; plannedEntryDate: string; remark: string | null };

type Row = { key: number; value?: ItemRowValue };

function ItemRows({ packages, emptyHint, initialRows }: { packages: { id: string; label: string }[]; emptyHint: string; initialRows?: ItemRowValue[] }) {
  const [rows, setRows] = useState<Row[]>(() => (initialRows?.length ? initialRows.map((value, key) => ({ key, value })) : [{ key: 0 }]));
  const [nextKey, setNextKey] = useState(initialRows?.length ?? 1);
  const addRow = () => {
    setRows((current) => [...current, { key: nextKey }]);
    setNextKey((key) => key + 1);
  };
  const removeRow = (key: number) => setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  return <div className="col-span-full">
    <div className="mb-2 flex items-center justify-between"><span className="text-sm font-medium text-slate-700">订单明细 *</span><button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={addRow} type="button">+ 添加明细</button></div>
    {rows.map((row) => <div className="mb-3 grid items-end gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[2fr_1fr_1fr_2fr_auto]" key={row.key}>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">套餐 *</span><select className={input} defaultValue={row.value?.packageId ?? ""} name="itemPackageId" required><option value="">请选择</option>{packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.label}</option>)}</select></label>
      <Field defaultValue={row.value?.quantity ?? ""} label="数量" name="itemQuantity" required step="1" type="number" />
      <Field defaultValue={row.value?.plannedEntryDate ?? ""} label="计划进场日期" name="itemPlannedEntryDate" required type="date" />
      <Field defaultValue={row.value?.remark ?? ""} label="备注" name="itemRemark" />
      <button className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 disabled:text-slate-300" disabled={rows.length <= 1} onClick={() => removeRow(row.key)} type="button">删除</button>
    </div>)}
    {!packages.length ? <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">{emptyHint}</p> : null}
  </div>;
}

export function CustomerOrderForm({ action, parties, packages, cancelHref }: { action: Action; parties: CustomerOrderParty[]; packages: CustomerPackageOption[]; cancelHref: string }) {
  const [customerId, setCustomerId] = useState("");
  const party = parties.find((entry) => entry.id === customerId);
  const availablePackages = packages.filter((pkg) => !pkg.customerId || pkg.customerId === customerId);
  return <FormShell action={action} cancelHref={cancelHref}>
    <CodeField label="订单编号" placeholder="保存后自动生成（如 2026091601）" /><label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">客户 *</span><select className={input} defaultValue="" name="customerId" onChange={(event) => setCustomerId(event.target.value)} required><option value="">请选择</option>{parties.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} · {entry.name}</option>)}</select></label>
    <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">部署地点 *</span><select className={input} defaultValue="" key={`loc-${customerId}`} name="locationId" required><option value="">{party ? (party.locations.length ? "请选择" : "该客户暂无地点") : "请先选择客户"}</option>{(party?.locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</select></label>
    <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">客户框架合同 *</span><select className={input} defaultValue="" key={`ct-${customerId}`} name="customerContractId" required><option value="">{party ? (party.contracts.length ? "请选择" : "该客户暂无合同") : "请先选择客户"}</option>{(party?.contracts ?? []).map((contract) => <option key={contract.id} value={contract.id}>{contract.label}</option>)}</select></label>
    <Field label="下单日期" name="orderDate" required type="date" /><OrderStatusSelect />
    <ItemRows emptyHint="暂无可选套餐，请先到「客户套餐」新增。" packages={availablePackages.map((pkg) => ({ id: pkg.id, label: pkg.label }))} />
    <AttachmentField />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} name="remark" /></label>
  </FormShell>;
}

export function SupplierOrderForm({ action, parties, packages, cancelHref }: { action: Action; parties: SupplierOrderParty[]; packages: SupplierPackageOption[]; cancelHref: string }) {
  const [supplierId, setSupplierId] = useState("");
  const party = parties.find((entry) => entry.id === supplierId);
  const availablePackages = packages.filter((pkg) => pkg.supplierId === supplierId);
  return <FormShell action={action} cancelHref={cancelHref}>
    <CodeField label="订单编号" placeholder="保存后自动生成（如 2026091601）" /><label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">供应商 *</span><select className={input} defaultValue="" name="supplierId" onChange={(event) => setSupplierId(event.target.value)} required><option value="">请选择</option>{parties.map((entry) => <option key={entry.id} value={entry.id}>{entry.code} · {entry.name}</option>)}</select></label>
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">供应商框架合同 *</span><select className={input} defaultValue="" key={`ct-${supplierId}`} name="supplierContractId" required><option value="">{party ? (party.contracts.length ? "请选择" : "该供应商暂无合同") : "请先选择供应商"}</option>{(party?.contracts ?? []).map((contract) => <option key={contract.id} value={contract.id}>{contract.label}</option>)}</select></label>
    <Field label="下单日期" name="orderDate" required type="date" /><OrderStatusSelect />
    <ItemRows emptyHint="暂无可选套餐，请先到「供应商套餐」新增。" packages={availablePackages.map((pkg) => ({ id: pkg.id, label: pkg.label }))} />
    <AttachmentField />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} name="remark" /></label>
  </FormShell>;
}

type EditValue = { orderNo: string; partyLabel: string; orderDate: string; status: string; attachmentUrl?: string | null; remark: string | null };

export function CustomerOrderEditForm({ action, value, packages, initialRows, cancelHref }: { action: Action; value: EditValue; packages: { id: string; label: string }[]; initialRows: ItemRowValue[]; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <CodeField label="订单编号" value={value.orderNo} /><CodeField label="客户" value={value.partyLabel} />
    <Field defaultValue={value.orderDate} label="下单日期" name="orderDate" required type="date" /><OrderStatusSelect defaultValue={value.status} />
    <ItemRows emptyHint="暂无可选套餐，请先到「客户套餐」新增。" initialRows={initialRows} packages={packages} />
    <AttachmentField currentUrl={value.attachmentUrl} />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value.remark ?? ""} name="remark" /></label>
  </FormShell>;
}

export function SupplierOrderEditForm({ action, value, packages, initialRows, cancelHref }: { action: Action; value: EditValue; packages: { id: string; label: string }[]; initialRows: ItemRowValue[]; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <CodeField label="订单编号" value={value.orderNo} /><CodeField label="供应商" value={value.partyLabel} />
    <Field defaultValue={value.orderDate} label="下单日期" name="orderDate" required type="date" /><OrderStatusSelect defaultValue={value.status} />
    <ItemRows emptyHint="暂无可选套餐，请先到「供应商套餐」新增。" initialRows={initialRows} packages={packages} />
    <AttachmentField currentUrl={value.attachmentUrl} />
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value.remark ?? ""} name="remark" /></label>
  </FormShell>;
}
