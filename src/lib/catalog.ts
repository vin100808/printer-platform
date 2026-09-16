import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().max(500).nullable(),
);

const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label}不能为空`).max(max, `${label}不能超过 ${max} 个字符`);

// 金额/数值输入：必填、非负、限制整数与小数位，避免数据库 Decimal 静默四舍五入。
const decimalText = (label: string, integerDigits: number, fractionDigits: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    },
    z.coerce
      .number({ error: `请输入正确的${label}` })
      .refine((value) => {
        const text = String(value);
        return new RegExp(`^\\d{1,${integerDigits}}(\\.\\d{1,${fractionDigits}})?$`).test(text);
      }, `${label}最多 ${integerDigits} 位整数、${fractionDigits} 位小数`),
  );

export const machineModelSchema = z.object({
  brand: requiredText("品牌", 100),
  modelName: requiredText("型号名称", 100),
  deviceType: z.enum(["black_white", "color"], { error: "请选择机器类型" }),
  status: z.enum(["active", "inactive"]),
  remark: optionalText,
});

const packageCore = {
  packageCode: requiredText("套餐编码", 50),
  packageName: requiredText("套餐名称"),
  monthlyRent: decimalText("月租", 8, 2),
  monthlyFreeBwEquivalent: decimalText("每月免费 BW Equivalent 额度", 10, 2),
  overageRateBwEquivalent: decimalText("超印单价", 6, 4),
  effectiveFrom: z.preprocess(
    (value) => (typeof value === "string" && value ? value : undefined),
    z.coerce.date({ error: "请选择生效日期" }),
  ),
  status: z.enum(["active", "inactive"]),
  remark: optionalText,
};

export const customerPackageSchema = z.object({
  ...packageCore,
  // 为空代表标准套餐；有值代表客户专属套餐。
  customerId: z.preprocess(
    (value) => (typeof value === "string" && value ? value : null),
    z.string().nullable(),
  ),
});

export const supplierPackageSchema = z.object({
  ...packageCore,
  supplierId: z.string().trim().min(1, "请选择供应商"),
});

// 编辑套餐时价格与归属不可变：价格变更必须走新版本，历史版本价格永不覆盖。
export const customerPackageUpdateSchema = customerPackageSchema.omit({
  packageCode: true,
  monthlyRent: true,
  monthlyFreeBwEquivalent: true,
  overageRateBwEquivalent: true,
  customerId: true,
});

export const supplierPackageUpdateSchema = supplierPackageSchema.omit({
  packageCode: true,
  monthlyRent: true,
  monthlyFreeBwEquivalent: true,
  overageRateBwEquivalent: true,
  supplierId: true,
});

/** 依据同编码已有版本号计算下一个版本号；无历史版本时为 1。 */
export function nextVersion(existingVersions: number[]): number {
  return existingVersions.length ? Math.max(...existingVersions) + 1 : 1;
}

export function values(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key)]));
}

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

export function formatDecimal(value: { toString(): string }) {
  return value.toString();
}

export function formatDateCn(date: Date) {
  return date.toLocaleDateString("zh-CN");
}
