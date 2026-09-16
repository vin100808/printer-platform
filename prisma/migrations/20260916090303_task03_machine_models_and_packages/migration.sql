-- CreateTable
CREATE TABLE "machine_models" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_packages" (
    "id" TEXT NOT NULL,
    "package_code" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "monthly_rent" DECIMAL(10,2) NOT NULL,
    "monthly_free_bw_equivalent" DECIMAL(12,2) NOT NULL,
    "overage_rate_bw_equivalent" DECIMAL(10,4) NOT NULL,
    "customer_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" DATE NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_packages" (
    "id" TEXT NOT NULL,
    "package_code" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "monthly_rent" DECIMAL(10,2) NOT NULL,
    "monthly_free_bw_equivalent" DECIMAL(12,2) NOT NULL,
    "overage_rate_bw_equivalent" DECIMAL(10,4) NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" DATE NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MachineModelToSupplierPackage" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MachineModelToSupplierPackage_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CustomerPackageToMachineModel" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CustomerPackageToMachineModel_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "machine_models_status_idx" ON "machine_models"("status");

-- CreateIndex
CREATE UNIQUE INDEX "machine_models_brand_model_name_key" ON "machine_models"("brand", "model_name");

-- CreateIndex
CREATE INDEX "customer_packages_customer_id_idx" ON "customer_packages"("customer_id");

-- CreateIndex
CREATE INDEX "customer_packages_status_idx" ON "customer_packages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customer_packages_package_code_version_key" ON "customer_packages"("package_code", "version");

-- CreateIndex
CREATE INDEX "supplier_packages_supplier_id_idx" ON "supplier_packages"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_packages_status_idx" ON "supplier_packages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_packages_package_code_version_key" ON "supplier_packages"("package_code", "version");

-- CreateIndex
CREATE INDEX "_MachineModelToSupplierPackage_B_index" ON "_MachineModelToSupplierPackage"("B");

-- CreateIndex
CREATE INDEX "_CustomerPackageToMachineModel_B_index" ON "_CustomerPackageToMachineModel"("B");

-- AddForeignKey
ALTER TABLE "customer_packages" ADD CONSTRAINT "customer_packages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_packages" ADD CONSTRAINT "supplier_packages_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MachineModelToSupplierPackage" ADD CONSTRAINT "_MachineModelToSupplierPackage_A_fkey" FOREIGN KEY ("A") REFERENCES "machine_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MachineModelToSupplierPackage" ADD CONSTRAINT "_MachineModelToSupplierPackage_B_fkey" FOREIGN KEY ("B") REFERENCES "supplier_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerPackageToMachineModel" ADD CONSTRAINT "_CustomerPackageToMachineModel_A_fkey" FOREIGN KEY ("A") REFERENCES "customer_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerPackageToMachineModel" ADD CONSTRAINT "_CustomerPackageToMachineModel_B_fkey" FOREIGN KEY ("B") REFERENCES "machine_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
