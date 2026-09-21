import { randomBytes } from "node:crypto";
import { z } from "zod";
import { nextCode } from "@/lib/codes";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().max(500).nullable(),
);

const requiredId = (label: string) => z.string().trim().min(1, `请选择${label}`);

const requiredCode = (label: string) => z.string().trim().min(1, `请输入${label}`).max(50, `${label}不能超过 50 个字符`);

const optionalCode = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    z.string().max(50, `${label}不能超过 50 个字符`).nullable(),
  );

// 供应商订单明细在新流程中不再要求（TASK 15）；留空即不关联。
const optionalId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);

const dateInput = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "string" && value ? value : undefined),
    z.coerce.date({ error: `请选择${label}` }),
  );

const readingInput = (label: string) =>
  z.coerce
    .number({ error: `${label}必须是数字` })
    .int(`${label}必须是整数`)
    .min(0, `${label}不能为负数`)
    .max(999999999, `${label}超出允许范围`);

// printerCode 不再必填：手填 > 供应商资产编码 > 系统生成（P0001 起），见 resolvePrinterCode。
// supplierOrderItemId / supplierAssetCode 自 TASK 15 起可选，新流程不再依赖 SupplierOrder。
export const printerSchema = z.object({
  printerCode: optionalCode("打印机编码"),
  supplierAssetCode: optionalCode("供应商资产编码"),
  machineModelId: requiredId("机型"),
  customerOrderItemId: requiredId("客户订单明细"),
  supplierOrderItemId: optionalId,
  entryDate: dateInput("进场日期"),
  initialBwReading: readingInput("黑白初始读数"),
  initialColorReading: readingInput("彩色初始读数"),
  remark: optionalText,
});

// 订单明细关系定义打印机身份与追溯链，创建后不可改；编辑时编码必须已存在（创建时已解析出最终编码）。
export const printerUpdateSchema = printerSchema
  .omit({ customerOrderItemId: true, supplierOrderItemId: true })
  .extend({ printerCode: requiredCode("打印机编码") });

// 换机：客户订单明细沿用原打印机；供应商明细可改选，留空则沿用原机（原机未关联则保持不关联）。
export const printerReplaceSchema = printerSchema
  .omit({ customerOrderItemId: true, entryDate: true })
  .extend({ replaceDate: dateInput("换机日期") });

export const printerRemoveSchema = z.object({ exitDate: dateInput("撤机日期") });

// 生命周期操作（换机 / 撤机）只允许对运行中的打印机执行。
export function canChangeLifecycle(status: string) {
  return status === "active";
}

/** 日期粒度比较（本地日历日），用于换机 / 撤机日期不得早于进场日期。 */
export function isBeforeDay(a: Date, b: Date) {
  return Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) < Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
}

export function newQrToken() {
  return randomBytes(18).toString("base64url");
}

/**
 * 解析新打印机的最终编码：手填编码 > 供应商资产编码 > 系统生成（P0001 起）。
 * 返回的 systemGenerated 标识由调用方决定是否跳过「运行中重名」提示（系统生成码已与现有编码错开）。
 */
export function resolvePrinterCode(
  input: { printerCode: string | null; supplierAssetCode: string | null },
  existingCodes: string[],
): { code: string; systemGenerated: boolean } {
  if (input.printerCode) return { code: input.printerCode, systemGenerated: false };
  if (input.supplierAssetCode) return { code: input.supplierAssetCode, systemGenerated: false };
  return { code: nextCode("P", existingCodes), systemGenerated: true };
}

export const printerStatusLabel: Record<"draft" | "active" | "replaced" | "removed", string> = {
  draft: "草稿",
  active: "运行中",
  replaced: "已换机",
  removed: "已撤机",
};

export const deviceTypeLabel: Record<"black_white" | "color", string> = {
  black_white: "黑白",
  color: "彩色",
};

/** 明细是否还能接受新打印机：已部署台数（运行中）低于订单数量。 */
export function hasDeploymentCapacity(deployed: number, quantity: number) {
  return deployed < quantity;
}

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

export function values(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key)]));
}
