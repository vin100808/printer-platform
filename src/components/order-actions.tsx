"use client";

import { useState } from "react";

// 结束订单：提交「订单结束 / 统一退场日期」（默认今天，可修改）。
// 确认后在同一事务中把订单置为已结束，并将所有运行中的打印机按该日期统一撤机；
// 已换机 / 已撤机的历史打印机、抄表、附件与历史结算数据全部保留。
export function CompleteOrderButton({ action, activeCount }: { action: (formData: FormData) => Promise<void>; activeCount: number }) {
  const [today] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  return (
    <form
      action={action}
      className="flex items-center gap-2"
      onSubmit={(event) => {
        const message = activeCount > 0
          ? `该订单仍有 ${activeCount} 台运行中的打印机。\n结束订单将把订单置为「已结束」，并以所选日期将这些打印机统一撤机（状态改为已撤机）。\n抄表、附件与历史结算数据保留。确认继续？`
          : "确认以所选日期结束该订单？";
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        结束/统一退场日期
        <input className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100" defaultValue={today} name="exitDate" required type="date" />
      </label>
      <button className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800" type="submit">结束订单</button>
    </form>
  );
}
