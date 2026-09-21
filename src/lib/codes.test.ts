import { describe, expect, it } from "vitest";
import { nextCode } from "./codes";

describe("customer / supplier / printer code auto-generation", () => {
  it("starts customers at C0001, suppliers at S0001 and printers at P0001 on an empty list", () => {
    expect(nextCode("C", [])).toBe("C0001");
    expect(nextCode("S", [])).toBe("S0001");
    expect(nextCode("P", [])).toBe("P0001");
  });

  it("increments from the highest matching numeric suffix", () => {
    expect(nextCode("C", ["C0001", "C0002"])).toBe("C0003");
    expect(nextCode("S", ["S0001", "S0007"])).toBe("S0008");
  });

  it("ignores codes that do not match the prefix-number pattern", () => {
    expect(nextCode("C", ["VIP-001", "CUSTOMERX", ""])).toBe("C0001");
    expect(nextCode("C", ["C0001", "C-EXTRA"])).toBe("C0002");
  });

  it("does not reuse numbers left behind by deleted records", () => {
    expect(nextCode("C", ["C0001", "C0003"])).toBe("C0004");
  });

  it("keeps prefixes independent", () => {
    expect(nextCode("S", ["C0005", "C0006"])).toBe("S0001");
  });

  it("handles legacy unpadded codes numerically", () => {
    expect(nextCode("C", ["C001"])).toBe("C0002");
  });

  it("grows past the 4-digit padding naturally", () => {
    expect(nextCode("C", ["C9999"])).toBe("C10000");
  });
});
