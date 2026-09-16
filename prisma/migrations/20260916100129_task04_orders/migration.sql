-- CreateTable
CREATE TABLE "customer_orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "customer_contract_id" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "order_attachment_url" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_items" (
    "id" TEXT NOT NULL,
    "customer_order_id" TEXT NOT NULL,
    "customer_package_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "planned_entry_date" DATE,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "supplier_contract_id" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "order_attachment_url" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_order_items" (
    "id" TEXT NOT NULL,
    "supplier_order_id" TEXT NOT NULL,
    "supplier_package_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "planned_entry_date" DATE,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_orders_customer_id_idx" ON "customer_orders"("customer_id");

-- CreateIndex
CREATE INDEX "customer_orders_status_idx" ON "customer_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_orders_order_no_key" ON "customer_orders"("order_no");

-- CreateIndex
CREATE INDEX "customer_order_items_customer_order_id_idx" ON "customer_order_items"("customer_order_id");

-- CreateIndex
CREATE INDEX "customer_order_items_customer_package_id_idx" ON "customer_order_items"("customer_package_id");

-- CreateIndex
CREATE INDEX "supplier_orders_supplier_id_idx" ON "supplier_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_orders_status_idx" ON "supplier_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_orders_order_no_key" ON "supplier_orders"("order_no");

-- CreateIndex
CREATE INDEX "supplier_order_items_supplier_order_id_idx" ON "supplier_order_items"("supplier_order_id");

-- CreateIndex
CREATE INDEX "supplier_order_items_supplier_package_id_idx" ON "supplier_order_items"("supplier_package_id");

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_customer_contract_id_fkey" FOREIGN KEY ("customer_contract_id") REFERENCES "customer_framework_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_customer_order_id_fkey" FOREIGN KEY ("customer_order_id") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_customer_package_id_fkey" FOREIGN KEY ("customer_package_id") REFERENCES "customer_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_contract_id_fkey" FOREIGN KEY ("supplier_contract_id") REFERENCES "supplier_framework_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_supplier_order_id_fkey" FOREIGN KEY ("supplier_order_id") REFERENCES "supplier_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_supplier_package_id_fkey" FOREIGN KEY ("supplier_package_id") REFERENCES "supplier_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
