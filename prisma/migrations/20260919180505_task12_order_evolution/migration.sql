-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'quarterly');

-- DropIndex
DROP INDEX "printers_printer_code_key";

-- AlterTable
ALTER TABLE "customer_orders" ADD COLUMN     "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "contract_attachment_url" TEXT,
ADD COLUMN     "deposit_amount" DECIMAL(10,2),
ADD COLUMN     "deposit_received_date" DATE,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "installation_address" TEXT,
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "supplier_id" TEXT,
ALTER COLUMN "location_id" DROP NOT NULL,
ALTER COLUMN "customer_contract_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "printers" ALTER COLUMN "supplier_order_item_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "customer_orders_supplier_id_idx" ON "customer_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "printers_printer_code_idx" ON "printers"("printer_code");

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TASK 12 数据回填（历史 CustomerOrder → 新 Order 字段）
-- 1) 安装地址：取 Location 的真实地址字段（非 locationName）；地址缺失则保持 NULL，不编造
UPDATE "customer_orders" co
SET "installation_address" = l."address"
FROM "locations" l
WHERE l."id" = co."location_id" AND co."installation_address" IS NULL;

-- 2) startDate：无可靠历史来源，回退为下单日期
UPDATE "customer_orders" SET "start_date" = "order_date" WHERE "start_date" IS NULL;

-- 3) endDate：基于回填后的 startDate 按默认规则 +3 年 - 1 天
UPDATE "customer_orders" SET "end_date" = ("start_date" + INTERVAL '3 years' - INTERVAL '1 day')::date WHERE "end_date" IS NULL;

-- 4) 押金：Σ OrderItem.quantity × 2000（历史收款状态未知，deposit_received_date 保持 NULL）
UPDATE "customer_orders" co
SET "deposit_amount" = COALESCE((
  SELECT SUM(coi."quantity") FROM "customer_order_items" coi WHERE coi."customer_order_id" = co."id"
), 0) * 2000
WHERE co."deposit_amount" IS NULL;

-- 5) supplierId：仅当历史订单下打印机反推出「恰好 1 个」供应商时回填；0 个或多个保持 NULL，历史事实继续由旧关系承载
WITH "order_suppliers" AS (
  SELECT coi."customer_order_id" AS "order_id", so."supplier_id", COUNT(*) AS "cnt"
  FROM "customer_order_items" coi
  JOIN "printers" p ON p."customer_order_item_id" = coi."id"
  JOIN "supplier_order_items" soi ON soi."id" = p."supplier_order_item_id"
  JOIN "supplier_orders" so ON so."id" = soi."supplier_order_id"
  GROUP BY coi."customer_order_id", so."supplier_id"
),
"singles" AS (
  SELECT "order_id", MIN("supplier_id") AS "supplier_id", COUNT(*) AS "distinct_count"
  FROM "order_suppliers"
  GROUP BY "order_id"
)
UPDATE "customer_orders" co
SET "supplier_id" = s."supplier_id"
FROM "singles" s
WHERE co."id" = s."order_id" AND s."distinct_count" = 1;
