import { describe, expect, it } from "vitest";

import { formatWeightGrams } from "@/lib/format";

describe("formatWeightGrams", () => {
  it("formats a positive weight in grams", () => {
    expect(formatWeightGrams(90)).toBe("90 г");
    expect(formatWeightGrams(450)).toBe("450 г");
  });

  it("hides empty, zero and invalid weights", () => {
    expect(formatWeightGrams(null)).toBeNull();
    expect(formatWeightGrams(undefined)).toBeNull();
    expect(formatWeightGrams(0)).toBeNull();
    expect(formatWeightGrams(-5)).toBeNull();
    expect(formatWeightGrams(Number.NaN)).toBeNull();
  });
});
