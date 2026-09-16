import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  await connection();
  await prisma.$queryRaw`SELECT 1`;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold text-blue-700">工作台</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">基础主数据已就绪</h1>
      <p className="mt-3 max-w-2xl text-slate-600">客户、供应商、部署地点和框架合同已经可以在后台维护。</p>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <StatusCard title="应用服务" value="运行正常" detail="Next.js + TypeScript" tone="green" />
        <StatusCard title="数据库" value="连接正常" detail="PostgreSQL + Prisma" tone="blue" />
        <StatusCard title="当前阶段" value="TASK 02" detail="基础主数据" tone="slate" />
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">已启用模块</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          {["客户与 Location 管理", "供应商管理", "客户框架合同", "供应商框架合同"].map((item) => (
            <div className="rounded-xl bg-slate-50 px-4 py-3" key={item}>✓ {item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusCard({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: "green" | "blue" | "slate" }) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${colors[tone]}`}>{value}</p>
      <p className="mt-3 text-sm font-medium text-slate-800">{detail}</p>
    </article>
  );
}
