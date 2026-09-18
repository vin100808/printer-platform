-- CreateTable
CREATE TABLE "meter_readings" (
    "id" TEXT NOT NULL,
    "printer_id" TEXT NOT NULL,
    "reading_year" INTEGER NOT NULL,
    "reading_month" INTEGER NOT NULL,
    "previous_bw_reading" INTEGER NOT NULL,
    "current_bw_reading" INTEGER NOT NULL,
    "previous_color_reading" INTEGER NOT NULL,
    "current_color_reading" INTEGER NOT NULL,
    "bw_usage" INTEGER NOT NULL,
    "color_usage" INTEGER NOT NULL,
    "bw_equivalent_usage" INTEGER NOT NULL,
    "photo_url" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "admin_note" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meter_readings_printer_id_idx" ON "meter_readings"("printer_id");

-- CreateIndex
CREATE INDEX "meter_readings_reading_year_reading_month_idx" ON "meter_readings"("reading_year", "reading_month");

-- CreateIndex
CREATE UNIQUE INDEX "meter_readings_printer_id_reading_year_reading_month_key" ON "meter_readings"("printer_id", "reading_year", "reading_month");

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
