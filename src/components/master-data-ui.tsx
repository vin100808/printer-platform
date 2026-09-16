import Link from "next/link";

export function PageHeader({ title, description, actionHref, actionLabel }: { title: string; description?: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1>{description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}</div>
      {actionHref && actionLabel ? <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800" href={actionHref}>{actionLabel}</Link> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{status === "active" ? "启用" : "停用"}</span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">{children}</div>;
}

export function DetailItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 min-h-6 text-sm text-slate-800">{value || "—"}</dd></div>;
}

export const tableClass = "mt-5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left text-sm shadow-sm";
export const thClass = "border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-600";
export const tdClass = "border-b border-slate-100 px-4 py-3 text-slate-700";
