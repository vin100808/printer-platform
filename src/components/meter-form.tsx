"use client";

import { useActionState } from "react";
import type { FormState } from "@/actions/master-data";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const input = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export function MeterSubmitForm({ action, isColor, previousBw, previousColor }: { action: Action; isColor: boolean; previousBw: number; previousColor: number }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">上期黑白读数</p><p className="mt-1 font-semibold text-slate-900">{previousBw}</p></div>
        {isColor ? <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">上期彩色读数</p><p className="mt-1 font-semibold text-slate-900">{previousColor}</p></div> : null}
      </div>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">当前黑白读数 *</span><input className={input} inputMode="numeric" name="currentBwReading" required type="number" min="0" step="1" /></label>
      {isColor ? <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">当前彩色读数 *</span><input className={input} inputMode="numeric" name="currentColorReading" required type="number" min="0" step="1" /></label> : <input name="currentColorReading" type="hidden" value="" />}
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">抄表照片 *</span><input accept="image/jpeg,image/png" className={input} name="photo" required type="file" capture="environment" /><span className="mt-1 block text-xs text-slate-400">请拍摄机器面板读数照片，仅支持 JPG / PNG，最大 10MB。</span></label>
      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "提交中…" : "提交抄表"}</button>
    </form>
  );
}

export type MeterReadingCreateValue = {
  printerLabel: string;
  defaultYear: number;
  defaultMonth: number;
};

export function MeterReadingCreateForm({ action, value, isColor, cancelHref }: { action: Action; value: MeterReadingCreateValue; isColor: boolean; cancelHref: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <div className="block text-sm font-medium text-slate-700 md:col-span-2"><span className="mb-2 block">打印机</span><div className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">{value.printerLabel}</div></div>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">抄表年份 *</span><input className={input} defaultValue={value.defaultYear} inputMode="numeric" name="readingYear" required type="number" min="2000" max="2100" step="1" /></label>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">抄表月份 *</span><input className={input} defaultValue={value.defaultMonth} inputMode="numeric" name="readingMonth" required type="number" min="1" max="12" step="1" /></label>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">黑白累计读数 *</span><input className={input} inputMode="numeric" name="currentBwReading" required type="number" min="0" step="1" /></label>
      {isColor ? <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">彩色累计读数 *</span><input className={input} inputMode="numeric" name="currentColorReading" required type="number" min="0" step="1" /></label> : <input name="currentColorReading" type="hidden" value="" />}
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">抄表照片（可选）</span><input accept="image/jpeg,image/png" className={input} name="photo" type="file" /><span className="mt-1 block text-xs text-slate-400">后台补录照片不强制；如上传仅支持 JPG / PNG，最大 10MB。</span></label>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">备注（可选）</span><input className={input} maxLength={500} name="adminNote" placeholder="如：客户电话报数补录" /></label>
      <div className="col-span-full mt-2 flex items-center justify-between border-t border-slate-200 pt-5">
        <div>{state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}</div>
        <div className="flex gap-3"><a className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" href={cancelHref}>取消</a><button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "保存中…" : "保存抄表"}</button></div>
      </div>
    </form>
  );
}

export type MeterReadingEditValue = {
  periodLabel: string;
  printerLabel: string;
  previousBw: number;
  previousColor: number;
  currentBw: string;
  currentColor: string;
  statusLabel: string;
  adminNote: string | null;
  photoUrl: string | null;
};

export function MeterReadingEditForm({ action, value, isColor, cancelHref }: { action: Action; value: MeterReadingEditValue; isColor: boolean; cancelHref: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <div className="block text-sm font-medium text-slate-700"><span className="mb-2 block">业务月份</span><div className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">{value.periodLabel}</div></div>
      <div className="block text-sm font-medium text-slate-700"><span className="mb-2 block">打印机</span><div className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">{value.printerLabel}</div></div>
      <div className="block text-sm font-medium text-slate-700"><span className="mb-2 block">上期黑白读数</span><div className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">{value.previousBw}</div></div>
      {isColor ? <div className="block text-sm font-medium text-slate-700"><span className="mb-2 block">上期彩色读数</span><div className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">{value.previousColor}</div></div> : null}
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">当前黑白读数 *</span><input className={input} defaultValue={value.currentBw} inputMode="numeric" name="currentBwReading" required type="number" min="0" step="1" /></label>
      {isColor ? <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">当前彩色读数 *</span><input className={input} defaultValue={value.currentColor} inputMode="numeric" name="currentColorReading" required type="number" min="0" step="1" /></label> : <input name="currentColorReading" type="hidden" value="" />}
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">更换照片（可选）</span><input accept="image/jpeg,image/png" className={input} name="photo" type="file" /><span className="mt-1 block text-xs text-slate-400">当前照片：{value.photoUrl ? <a className="text-blue-700" href={value.photoUrl} target="_blank">查看</a> : "无"}；上传新照片将替换原照片。</span></label>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-2 block">调整说明 *（将记录 {value.statusLabel} 状态与操作人）</span><textarea className={`${input} min-h-24 resize-y`} defaultValue={value.adminNote ?? ""} name="adminNote" required /></label>
      <div className="col-span-full mt-2 flex items-center justify-between border-t border-slate-200 pt-5">
        <div>{state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}</div>
        <div className="flex gap-3"><a className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700" href={cancelHref}>取消</a><button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "保存中…" : "保存调整"}</button></div>
      </div>
    </form>
  );
}
