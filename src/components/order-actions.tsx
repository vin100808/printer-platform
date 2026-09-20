"use client";

// 结束订单按钮：仍有运行中打印机时先弹风险提示，管理员确认后继续提交。
// 结束订单只改变订单状态，不动任何打印机 / 抄表 / 附件 / 历史结算数据。
export function CompleteOrderButton({ action, activeCount }: { action: () => Promise<void>; activeCount: number }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (activeCount > 0 && !window.confirm(`风险提示：该订单仍有 ${activeCount} 台运行中的打印机。\n结束订单只会把订单状态改为「已结束」，不会自动撤机，也不会删除或修改打印机、抄表、附件与历史结算数据。\n确认继续结束订单？`)) {
          event.preventDefault();
        }
      }}
    >
      <button className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800" type="submit">结束订单</button>
    </form>
  );
}
