import Link from "next/link";
import { connection } from "next/server";
import { currentPeriod } from "@/lib/meter";
import { prisma } from "@/lib/prisma";

function monthRange(year: number, month: number) {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0)) };
}

function StatCard({ title, value, hint, href }: { title: string; value: number; hint: string; href?: string }) {
  const body = (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </article>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  await connection();
  const period = currentPeriod(new Date());
  const { start, end } = monthRange(period.year, period.month);
  const [activePrinters, duePrinters, submitted, customers, suppliers] = await Promise.all([
    prisma.printer.count({ where: { status: "active" } }),
    prisma.printer.count({
      where: { entryDate: { lte: end }, OR: [{ exitDate: null }, { exitDate: { gte: start } }] },
    }),
    prisma.meterReading.count({ where: { readingYear: period.year, readingMonth: period.month } }),
    prisma.customer.count({ where: { status: "active" } }),
    prisma.supplier.count({ where: { status: "active" } }),
  ]);
  const unsubmitted = Math.max(duePrinters - submitted, 0);
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold text-blue-700">工作台</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">运营总览</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        本期业务月份：<b>{period.year} 年 {period.month} 月</b>（每月 1-3 日开放客户扫码提交上一自然月读数）。
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard hint="状态为运行中的打印机" title="使用中机器" value={activePrinters} href="/printers?status=active" />
        <StatCard hint={`${period.year}-${String(period.month).padStart(2, "0")} 应提交抄表的在场机器`} title="本期应抄" value={duePrinters} href="/meter-readings" />
        <StatCard hint="本期已提交的抄表数" title="本期已抄" value={submitted} href="/meter-readings" />
        <StatCard hint="本期尚未提交，需催收" title="本期未抄" value={unsubmitted} href="/meter-readings" />
        <StatCard hint="启用状态的客户" title="当前客户数" value={customers} href="/customers" />
        <StatCard hint="启用状态的供应商" title="当前供应商数" value={suppliers} href="/suppliers" />
      </div>
    </div>
  );
}
