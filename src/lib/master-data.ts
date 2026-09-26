import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().max(500).nullable(),
);

const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label}不能为空`).max(max, `${label}不能超过 ${max} 个字符`);

export const customerSchema = z.object({
  customerCode: requiredText("客户编码", 50),
  customerName: requiredText("客户名称"),
  customerType: z.enum(["internal", "external"]),
  taxpayerIdentificationNo: optionalText,
  registeredAddress: optionalText,
  bankName: optionalText,
  bankAccountName: optionalText,
  bankAccountNo: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
  status: z.enum(["active", "inactive"]),
  remark: optionalText,
});

// 新增/编辑客户表单不携带 customerCode：新增时由服务端自动生成，编辑时编码不可修改。
// Customer 不再有业务状态：status 不出现在表单中，新建固定为 active，编辑不改动既有值。
export const customerInputSchema = customerSchema.omit({ customerCode: true, status: true });

export const supplierSchema = z.object({
  supplierCode: requiredText("供应商编码", 50),
  supplierName: requiredText("供应商名称"),
  taxpayerIdentificationNo: optionalText,
  registeredAddress: optionalText,
  bankName: optionalText,
  bankAccountName: optionalText,
  bankAccountNo: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
  serviceArea: optionalText,
  status: z.enum(["active", "inactive"]),
  remark: optionalText,
});

// 新增/编辑供应商表单不携带 supplierCode：新增时由服务端自动生成，编辑时编码不可修改。
export const supplierInputSchema = supplierSchema.omit({ supplierCode: true });

export const locationSchema = z.object({
  locationCode: requiredText("地点编码", 50),
  locationName: requiredText("地点名称"),
  address: requiredText("实际部署地址", 500),
  contactName: optionalText,
  contactPhone: optionalText,
  status: z.enum(["active", "inactive"]),
  remark: optionalText,
});

export const contractSchema = z
  .object({
    contractNo: requiredText("合同编号", 100),
    contractName: requiredText("合同名称"),
    effectiveDate: z.coerce.date({ error: "请选择生效日期" }),
    expiryDate: z.preprocess(
      (value) => (typeof value === "string" && value ? value : null),
      z.coerce.date().nullable(),
    ),
    status: z.enum(["active", "inactive"]),
    remark: optionalText,
  })
  .refine((data) => !data.expiryDate || data.expiryDate >= data.effectiveDate, {
    message: "到期日期不能早于生效日期",
    path: ["expiryDate"],
  });

export function values(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key)]));
}

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

export function formatDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}
