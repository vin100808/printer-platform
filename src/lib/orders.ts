import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().max(500).nullable(),
);

const requiredId = (label: string) => z.string().trim().min(1, `请选择${label}`);

const dateInput = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value ? value : undefined),
    z.coerce.date({ error: `请选择${label}` }),
  );

export const orderStatusSchema = z.enum(["draft", "confirmed", "completed", "cancelled"]);

// 订单编号不由人工填写：新增时由服务端按「当天日期 + 当日序号」自动生成，客户订单与供应商订单共用同一序列。
// 新核心 Order：一个订单 = 一次完整租赁交易（客户 + 安装地址 + 供应商，多个套餐明细）。
export const customerOrderSchema = z
  .object({
    customerId: requiredId("客户"),
    supplierId: requiredId("供应商"),
    installationAddress: z.string().trim().min(1, "请填写安装地址").max(300, "安装地址不能超过 300 字"),
    startDate: dateInput("开始日期"),
    endDate: z.preprocess(
      (value) => (typeof value === "string" && value ? value : undefined),
      z.coerce.date().optional(),
    ),
    billingCycle: z.enum(["monthly", "quarterly"], { error: "请选择结算方式" }),
    orderDate: dateInput("下单日期"),
    status: orderStatusSchema,
    remark: optionalText,
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, { error: "结束日期不能早于开始日期", path: ["endDate"] });

// 编辑时客户不可修改，其余表头字段管理员可改。
export const orderUpdateSchema = customerOrderSchema.omit({ customerId: true });

export const supplierOrderSchema = z.object({
  supplierId: requiredId("供应商"),
  supplierContractId: requiredId("供应商框架合同"),
  orderDate: dateInput("下单日期"),
  status: orderStatusSchema,
  remark: optionalText,
});

/**
 * 依据已有订单编号计算下一个当日订单编号：YYYYMMDD + 两位序号（01 起）。
 * 只统计与当天匹配的编号，取最大序号 + 1；已删除订单的编号不复用。
 */
export function nextOrderNo(date: Date, existingNos: string[]): string {
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const pattern = new RegExp(`^${day}(\\d+)$`);
  let max = 0;
  for (const no of existingNos) {
    const match = pattern.exec(no);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `${day}${String(max + 1).padStart(2, "0")}`;
}

const orderItemRowSchema = z.object({
  itemId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().optional(),
  ),
  packageId: requiredId("套餐"),
  quantity: z.coerce
    .number({ error: "数量必须是数字" })
    .int("数量必须是整数")
    .min(1, "数量至少为 1")
    .max(999, "数量不能超过 999"),
  plannedEntryDate: z.preprocess(
    (value) => (typeof value === "string" && value ? value : undefined),
    z.coerce.date({ error: "请选择计划进场日期" }),
  ),
  remark: optionalText,
});

export type OrderItemInput = z.infer<typeof orderItemRowSchema>;

/**
 * 解析订单明细行：表单中同名字段按 DOM 顺序取值（getAll），逐行校验。
 * 空行（未选套餐且数量为空）自动跳过；完全无有效行时报错。
 */
export function parseOrderItems(formData: FormData): { ok: true; items: OrderItemInput[] } | { ok: false; error: string } {
  const packageIds = formData.getAll("itemPackageId").map(String);
  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  const plannedDates = formData.getAll("itemPlannedEntryDate").map(String);
  const remarks = formData.getAll("itemRemark").map(String);
  const rowCount = Math.max(packageIds.length, itemIds.length, quantities.length, plannedDates.length, remarks.length);

  const items: OrderItemInput[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = { itemId: itemIds[index] ?? "", packageId: packageIds[index] ?? "", quantity: quantities[index] ?? "", plannedEntryDate: plannedDates[index] ?? "", remark: remarks[index] ?? "" };
    if (!row.packageId && !row.quantity) continue; // 整行留空，跳过
    const parsed = orderItemRowSchema.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: `第 ${index + 1} 行明细：${issue?.message ?? "内容不正确"}` };
    }
    items.push(parsed.data);
  }
  if (!items.length) return { ok: false, error: "请至少添加一个订单明细" };
  return { ok: true, items };
}

/** 部署状态：根据已部署台数与订单数量动态计算，不存数据库。 */
export function deploymentStatus(deployed: number, quantity: number): "未部署" | "部分部署" | "已部署" {
  if (deployed <= 0) return "未部署";
  if (deployed >= quantity) return "已部署";
  return "部分部署";
}

/** 押金固定规则：人民币 2,000 元 / 台（系统固定业务规则，不做成配置）。 */
export const DEPOSIT_PER_PRINTER = 2000;

/** depositAmount = 该 Order 所有 OrderItem.quantity 合计 × 2000。 */
export function computeDepositAmount(totalQuantity: number): number {
  if (!Number.isInteger(totalQuantity) || totalQuantity < 0) throw new Error("总台数必须是非负整数");
  return totalQuantity * DEPOSIT_PER_PRINTER;
}

/**
 * endDate 默认规则：startDate + 3 年 - 1 天（如 2026-10-01 → 2029-09-30）。
 * 仅作为默认计算规则，管理员可手动修改；按 UTC 日历日对齐 @db.Date 存储。
 */
export function defaultEndDate(startDate: Date): Date {
  return new Date(Date.UTC(startDate.getUTCFullYear() + 3, startDate.getUTCMonth(), startDate.getUTCDate() - 1));
}

export const orderStatusLabel: Record<z.infer<typeof orderStatusSchema>, string> = {
  draft: "草稿",
  confirmed: "履约中",
  completed: "已结束",
  cancelled: "已取消",
};

export const billingCycleLabel: Record<"monthly" | "quarterly", string> = {
  monthly: "按月结算",
  quarterly: "按自然季度结算",
};

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

export function values(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key)]));
}
