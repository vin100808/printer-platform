import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createMeterReading } from "@/actions/meter";
import { PageHeader } from "@/components/master-data-ui";
import { MeterReadingCreateForm } from "@/components/meter-form";
import { currentPeriod } from "@/lib/meter";
import { printerStatusLabel } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

export default async function NewMeterReadingPage({ params }: PageProps<"/printers/[id]/meter-readings/new">) {
  await connection();
  const { id } = await params;
  const printer = await prisma.printer.findUnique({
    where: { id },
    select: { printerCode: true, status: true, entryDate: true, exitDate: true, machineModel: { select: { deviceType: true } } },
  });
  if (!printer) notFound();
  const period = currentPeriod(new Date());
  const isColor = printer.machineModel.deviceType === "color";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        description={`后台手动录入不受客户扫码每月 1-3 日窗口限制，可补录历史月份；月份须在打印机在役期间内（进场 ${printer.entryDate.toLocaleDateString("zh-CN")}${printer.exitDate ? `，退场 ${printer.exitDate.toLocaleDateString("zh-CN")}` : ""}，当前状态：${printerStatusLabel[printer.status]}）；照片可选；读数不得低于上一期、不得高于下一期。`}
        title={`新增抄表 · ${printer.printerCode}`}
      />
      <MeterReadingCreateForm
        action={createMeterReading.bind(null, id)}
        cancelHref={`/printers/${id}`}
        isColor={isColor}
        value={{ printerLabel: printer.printerCode, defaultYear: period.year, defaultMonth: period.month }}
      />
    </div>
  );
}
