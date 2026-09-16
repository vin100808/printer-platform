import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentAdmin } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentAdmin()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_38%),linear-gradient(135deg,#f8fafc,#eef2ff)] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-8 shadow-2xl shadow-slate-300/40 backdrop-blur">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white">
          P
        </div>
        <p className="mt-7 text-sm font-semibold tracking-wide text-blue-700">PRINTER OPS</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">打印机租赁运营平台</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">使用管理员账号登录内部运营后台。</p>
        <LoginForm />
      </section>
    </main>
  );
}
