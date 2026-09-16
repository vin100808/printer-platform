-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_type" "CustomerType" NOT NULL,
    "taxpayer_identification_no" TEXT,
    "registered_address" TEXT,
    "bank_name" TEXT,
    "bank_account_name" TEXT,
    "bank_account_no" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "supplier_code" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "taxpayer_identification_no" TEXT,
    "registered_address" TEXT,
    "bank_name" TEXT,
    "bank_account_name" TEXT,
    "bank_account_no" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "service_area" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "location_code" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_framework_contracts" (
    "id" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "contract_name" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "attachment_url" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_framework_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_framework_contracts" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "contract_name" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "attachment_url" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_framework_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CustomerToCustomerFrameworkContract" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CustomerToCustomerFrameworkContract_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE INDEX "customers_customer_name_idx" ON "customers"("customer_name");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");

-- CreateIndex
CREATE INDEX "suppliers_supplier_name_idx" ON "suppliers"("supplier_name");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "locations_customer_id_status_idx" ON "locations"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "locations_customer_id_location_code_key" ON "locations"("customer_id", "location_code");

-- CreateIndex
CREATE INDEX "customer_framework_contracts_contract_no_idx" ON "customer_framework_contracts"("contract_no");

-- CreateIndex
CREATE INDEX "customer_framework_contracts_status_idx" ON "customer_framework_contracts"("status");

-- CreateIndex
CREATE INDEX "supplier_framework_contracts_supplier_id_idx" ON "supplier_framework_contracts"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_framework_contracts_contract_no_idx" ON "supplier_framework_contracts"("contract_no");

-- CreateIndex
CREATE INDEX "supplier_framework_contracts_status_idx" ON "supplier_framework_contracts"("status");

-- CreateIndex
CREATE INDEX "_CustomerToCustomerFrameworkContract_B_index" ON "_CustomerToCustomerFrameworkContract"("B");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_framework_contracts" ADD CONSTRAINT "supplier_framework_contracts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToCustomerFrameworkContract" ADD CONSTRAINT "_CustomerToCustomerFrameworkContract_A_fkey" FOREIGN KEY ("A") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerToCustomerFrameworkContract" ADD CONSTRAINT "_CustomerToCustomerFrameworkContract_B_fkey" FOREIGN KEY ("B") REFERENCES "customer_framework_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
