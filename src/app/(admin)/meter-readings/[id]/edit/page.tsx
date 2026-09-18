import { notFound } from "next/navigation";
import { connection } from "next/server";
import { updateMeterReading } from "@/actions/meter";
import { PageHeader } from "@/components/master-data-ui";
import { MeterReadingEditForm } from "@/components/meter-form";
import { meterStatusLabel } from "@/lib/meter";
import { printerStatusLabel } from "@/lib/printers";
import { prisma } from "@/lib/prisma";

export default async function EditMeterReadingPage({ params }: PageProps<"/meter-readings/[id]/edit">) {
  await connection();
  const { id } = await params;
  const reading = await prisma.meterReading.findUnique({
    where: { id },
    include: { printer: { select: { printerCode: true, status: true, machineModel: { select: { deviceType: true } } } } },
  });
  if (!reading) notFound();
  const isColor = reading.printer.machineModel.deviceType === "color";
  return <div className="mx-auto max-w-3xl"><PageHeader description={`调整后状态将变为「已调整」，记录操作人；打印机当前状态：${printerStatusLabel[reading.printer.status]}。`} title={`调整抄表 · ${reading.printer.printerCode} ${reading.readingYear}-${String(reading.readingMonth).padStart(2, "0")}`} />
    <MeterReadingEditForm
      action={updateMeterReading.bind(null, id)}
      cancelHref={`/printers/${reading.printerId}`}
      isColor={isColor}
      value={{
        periodLabel: `${reading.readingYear} 年 ${reading.readingMonth} 月`,
        printerLabel: reading.printer.printerCode,
        previousBw: reading.previousBwReading,
        previousColor: reading.previousColorReading,
        currentBw: String(reading.currentBwReading),
        currentColor: String(reading.currentColorReading),
        statusLabel: meterStatusLabel(reading.status),
        adminNote: reading.adminNote,
      }}
    />
  </div>;
}
