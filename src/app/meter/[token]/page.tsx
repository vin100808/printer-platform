import { connection } from "next/server";
import { submitMeterReading } from "@/actions/meter";
import { MeterSubmitForm } from "@/components/meter-form";
import { deviceTypeLabel, printerStatusLabel } from "@/lib/printers";
import { meterWindow } from "@/lib/meter";
import { prisma } from "@/lib/prisma";

function Card({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10"><div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div></main>;
}

function Message({ title, hint }: { title: string; hint?: string }) {
  return <Card><h1 className="text-xl font-bold text-slate-950">{title}</h1>{hint ? <p className="mt-3 text-sm leading-6 text-slate-500">{hint}</p> : null}</Card>;
}

export default async function MeterPage({ params, searchParams }: PageProps<"/meter/[token]">) {
  await connection();
  const { token } = await params;
  const { submitted } = await searchParams;
  const printer = await prisma.printer.findUnique({
    where: { qrToken: token },
    include: {
      machineModel: { select: { brand: true, modelName: true, deviceType: true } },
      customerOrderItem: { include: { order: { include: { customer: { select: { customerName: true } }, location: { select: { locationName: true, address: true } } } } } },
      meterReadings: { orderBy: [{ readingYear: "desc" }, { readingMonth: "desc" }], take: 1 },
    },
  });
  if (!printer) return <Message hint="请检查二维码是否完整，或联系租赁服务商。" title="二维码无效或设备不存在" />;

  const order = printer.customerOrderItem.order;
  const deviceInfo = (
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">客户</dt><dd className="mt-1 font-medium text-slate-900">{order.customer.customerName}</dd></div>
      <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">部署地点</dt><dd className="mt-1 font-medium text-slate-900">{order.location.locationName}</dd></div>
      <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">机型</dt><dd className="mt-1 font-medium text-slate-900">{printer.machineModel.brand} {printer.machineModel.modelName}</dd></div>
      <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">设备类型</dt><dd className="mt-1 font-medium text-slate-900">{deviceTypeLabel[printer.machineModel.deviceType]}</dd></div>
    </dl>
  );

  if (printer.status !== "active") {
    return <Card><p className="text-xs font-medium uppercase tracking-wide text-slate-400">打印机 {printer.printerCode}</p><h1 className="mt-2 text-xl font-bold text-slate-950">该设备当前已停止使用</h1><p className="mt-2 text-sm text-slate-500">状态：{printerStatusLabel[printer.status]}{printer.exitDate ? `，退场日期 ${printer.exitDate.toLocaleDateString("zh-CN")}` : ""}。如有疑问请联系租赁服务商。</p>{deviceInfo}</Card>;
  }

  const window = meterWindow(new Date());
  const periodLabel = `${window.year} 年 ${window.month} 月`;
  if (window.phase === "before") return <Message hint={`${periodLabel}抄表将于 ${window.month === 12 ? window.year + 1 : window.year} 年 ${window.month === 12 ? 1 : window.month + 1} 月 1-3 日开放，请届时再扫码提交。`} title="本期抄表尚未开放" />;
  if (window.phase === "closed") return <Message hint={`${periodLabel}抄表已于本月 3 日 23:59 截止。如需补录，请联系租赁服务商。`} title="本期抄表已关闭" />;

  const existing = printer.meterReadings[0];
  if (existing && existing.readingYear === window.year && existing.readingMonth === window.month) {
    return <Card>{submitted ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">提交成功，感谢您的配合。</p> : null}<h1 className="text-xl font-bold text-slate-950">本期抄表已提交</h1><p className="mt-2 text-sm text-slate-500">{periodLabel}抄表已于 {existing.submittedAt.toLocaleString("zh-CN")} 提交，如需修改请联系管理员。</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">黑白读数</dt><dd className="mt-1 font-semibold text-slate-900">{existing.previousBwReading} → {existing.currentBwReading}</dd></div>{printer.machineModel.deviceType === "color" ? <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">彩色读数</dt><dd className="mt-1 font-semibold text-slate-900">{existing.previousColorReading} → {existing.currentColorReading}</dd></div> : null}</dl>{deviceInfo}</Card>;
  }

  const previous = existing ?? { currentBwReading: printer.initialBwReading, currentColorReading: printer.initialColorReading };
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{periodLabel}抄表</p>
        <h1 className="mt-1 text-xl font-bold text-slate-950">打印机 {printer.printerCode}</h1>
        {deviceInfo}
        <MeterSubmitForm action={submitMeterReading.bind(null, token)} isColor={printer.machineModel.deviceType === "color"} previousBw={previous.currentBwReading} previousColor={previous.currentColorReading} />
        <p className="mt-4 text-center text-xs text-slate-400">开放时间为每月 1-3 日，本次提交 {periodLabel} 用量。</p>
      </div>
    </main>
  );
}
