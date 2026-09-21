const CODE_PADDING = 4;

/**
 * 依据已有编码计算下一个自动编码。
 * 规则：prefix + 数字序号，序号从 1 开始，不足 4 位补零（C0001、S0001、P0001）。
 * 只考虑与 prefix 匹配且后续为纯数字的编码，取最大数字序号 + 1；
 * 不参与匹配的编码（如手工历史编码）不影响结果。
 * 采用“最大序号 + 1”而非“最小空缺”，保证已删除记录使用过的编码不会被复用。
 */
export function nextCode(prefix: "C" | "S" | "P", existingCodes: string[]): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const code of existingCodes) {
    const match = pattern.exec(code);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(CODE_PADDING, "0")}`;
}
