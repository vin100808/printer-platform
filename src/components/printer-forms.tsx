"use client";

import type { FormState } from "@/actions/master-data";
import { CodeField, Field, FormShell, area, input } from "@/components/master-data-forms";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type PrinterSelectOption = { id: string; label: string };

function SelectField({ label, name, options, defaultValue, emptyHint }: { label: string; name: string; options: PrinterSelectOption[]; defaultValue?: string; emptyHint: string }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">{label} *</span><select className={input} defaultValue={defaultValue ?? ""} name={name} required><option value="">{options.length ? "请选择" : emptyHint}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>{!options.length ? <span className="mt-1 block text-xs text-slate-400">{emptyHint}</span> : null}</label>;
}

export function PrinterForm({ action, machineModels, customerItems, supplierItems, initialCustomerItemId, initialSupplierItemId, cancelHref }: { action: Action; machineModels: PrinterSelectOption[]; customerItems: PrinterSelectOption[]; supplierItems: PrinterSelectOption[]; initialCustomerItemId?: string; initialSupplierItemId?: string; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <Field label="打印机编码" name="printerCode" placeholder="唯一即可，如 P-001" required />
    <Field label="供应商资产编码" name="supplierAssetCode" required />
    <SelectField emptyHint="暂无可用机型，请先到「机型管理」新增。" label="机型" name="machineModelId" options={machineModels} />
    <SelectField defaultValue={initialCustomerItemId} emptyHint="暂无可部署的客户订单明细（可能已部署满或订单已取消）。" label="客户订单明细" name="customerOrderItemId" options={customerItems} />
    <SelectField defaultValue={initialSupplierItemId} emptyHint="暂无可用的供应商订单明细（可能已交付满或订单已取消）。" label="供应商订单明细" name="supplierOrderItemId" options={supplierItems} />
    <Field label="进场日期" name="entryDate" required type="date" />
    <Field defaultValue="0" label="黑白初始读数" name="initialBwReading" required step="1" type="number" />
    <Field defaultValue="0" label="彩色初始读数" name="initialColorReading" required step="1" type="number" />
    <p className="col-span-full rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">客户、地点、合同与套餐等信息通过订单明细自动追溯，无需重复选择；创建后状态为「运行中」，二维码 token 自动生成。</p>
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} name="remark" /></label>
  </FormShell>;
}

export type PrinterEditValue = {
  printerCode: string;
  supplierAssetCode: string;
  customerItemLabel: string;
  supplierItemLabel: string;
  machineModelId: string;
  entryDate: string;
  initialBwReading: string;
  initialColorReading: string;
  statusLabel: string;
  remark: string | null;
};

export function PrinterEditForm({ action, value, machineModels, cancelHref }: { action: Action; value: PrinterEditValue; machineModels: PrinterSelectOption[]; cancelHref: string }) {
  return <FormShell action={action} cancelHref={cancelHref}>
    <Field defaultValue={value.printerCode} label="打印机编码" name="printerCode" required />
    <Field defaultValue={value.supplierAssetCode} label="供应商资产编码" name="supplierAssetCode" required />
    <CodeField label="客户订单明细" value={value.customerItemLabel} /><CodeField label="供应商订单明细" value={value.supplierItemLabel} />
    <SelectField defaultValue={value.machineModelId} emptyHint="暂无可用机型。" label="机型" name="machineModelId" options={machineModels} />
    <Field defaultValue={value.entryDate} label="进场日期" name="entryDate" required type="date" />
    <Field defaultValue={value.initialBwReading} label="黑白初始读数" name="initialBwReading" required step="1" type="number" />
    <Field defaultValue={value.initialColorReading} label="彩色初始读数" name="initialColorReading" required step="1" type="number" />
    <CodeField label="状态" value={value.statusLabel} />
    <p className="col-span-full rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">订单明细关系定义打印机身份，不可修改；换机、撤机等生命周期操作由 TASK 06 提供。</p>
    <label className="col-span-full block text-sm font-medium text-slate-700"><span className="mb-2 block">备注</span><textarea className={area} defaultValue={value.remark ?? ""} name="remark" /></label>
  </FormShell>;
}
