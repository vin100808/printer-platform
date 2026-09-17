-- CreateTable
CREATE TABLE "printers" (
    "id" TEXT NOT NULL,
    "printer_code" TEXT NOT NULL,
    "supplier_asset_code" TEXT NOT NULL,
    "machine_model_id" TEXT NOT NULL,
    "customer_order_item_id" TEXT NOT NULL,
    "supplier_order_item_id" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "exit_date" DATE,
    "initial_bw_reading" INTEGER NOT NULL,
    "initial_color_reading" INTEGER NOT NULL,
    "status" "PrinterStatus" NOT NULL DEFAULT 'draft',
    "previous_printer_id" TEXT,
    "qr_token" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "printers_printer_code_key" ON "printers"("printer_code");

-- CreateIndex
CREATE UNIQUE INDEX "printers_previous_printer_id_key" ON "printers"("previous_printer_id");

-- CreateIndex
CREATE UNIQUE INDEX "printers_qr_token_key" ON "printers"("qr_token");

-- CreateIndex
CREATE INDEX "printers_machine_model_id_idx" ON "printers"("machine_model_id");

-- CreateIndex
CREATE INDEX "printers_customer_order_item_id_idx" ON "printers"("customer_order_item_id");

-- CreateIndex
CREATE INDEX "printers_supplier_order_item_id_idx" ON "printers"("supplier_order_item_id");

-- CreateIndex
CREATE INDEX "printers_status_idx" ON "printers"("status");

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_machine_model_id_fkey" FOREIGN KEY ("machine_model_id") REFERENCES "machine_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_customer_order_item_id_fkey" FOREIGN KEY ("customer_order_item_id") REFERENCES "customer_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_supplier_order_item_id_fkey" FOREIGN KEY ("supplier_order_item_id") REFERENCES "supplier_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_previous_printer_id_fkey" FOREIGN KEY ("previous_printer_id") REFERENCES "printers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
