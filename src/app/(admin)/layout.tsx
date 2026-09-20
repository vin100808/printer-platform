import Link from "next/link";
import { logout } from "@/actions/auth";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-800 bg-slate-950 px-5 py-6 text-white lg:block">
        <Link className="flex items-center gap-3" href="/dashboard">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold">P</span>
          <span>
            <span className="block font-semibold">打印机租赁</span>
            <span className="text-xs text-slate-400">运营平台 V1</span>
          </span>
        </Link>
        <nav className="mt-10 space-y-1">
          {[{ href: "/dashboard", label: "工作台" }, { href: "/customers", label: "客户管理" }, { href: "/suppliers", label: "供应商管理" }, { href: "/customer-contracts", label: "客户合同" }, { href: "/supplier-contracts", label: "供应商合同" }, { href: "/machine-models", label: "机型管理" }, { href: "/customer-packages", label: "客户套餐" }, { href: "/supplier-packages", label: "供应商套餐" }, { href: "/orders", label: "订单" }, { href: "/supplier-orders", label: "供应商订单" }, { href: "/printers", label: "打印机台账" }, { href: "/meter-readings", label: "抄表管理" }].map((item) => (
            <Link className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white" href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        <p className="absolute bottom-6 left-5 right-5 rounded-xl border border-slate-800 px-4 py-3 text-xs leading-5 text-slate-400">
          TASK 13 已完成
          <br />
          Order 核心业务流与 UI
        </p>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <Link className="font-semibold text-slate-950 lg:hidden" href="/dashboard">
            打印机租赁运营平台
          </Link>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-slate-900">{admin.name}</p>
            <p className="text-xs text-slate-500">{admin.email}</p>
          </div>
          <form action={logout}>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" type="submit">
              退出登录
            </button>
          </form>
        </header>
        <main className="px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
