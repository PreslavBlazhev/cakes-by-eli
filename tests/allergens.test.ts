import { describe, expect, it } from "vitest";

import {
  ALLERGENS,
  canonicalStoredAllergens,
  formatAllergen,
  normalizeAllergens,
  selectedAllergens,
} from "@/lib/allergens";

describe("allergen list", () => {
  it("is the fourteen positions, numbered without gaps", () => {
    expect(ALLERGENS.map((allergen) => allergen.number)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
    expect(ALLERGENS.map(formatAllergen)).toEqual([
      "1. Зърнени култури, съдържащи глутен",
      "2. Ракообразни и продукти от тях",
      "3. Яйца и продукти от тях",
      "4. Риба и рибни продукти",
      "5. Фъстъци и продукти от тях",
      "6. Соя и соеви продукти",
      "7. Мляко и млечни продукти",
      "8. Ядки и продукти от тях",
      "9. Целина и продукти от нея",
      "10. Синап и продукти от него",
      "11. Сусамово семе и продукти от него",
      "12. Серен диоксид и сулфити",
      "13. Лупина и продукти от нея",
      "14. Мекотели и продукти от тях",
    ]);
  });

  it("has unique codes", () => {
    const codes = ALLERGENS.map((allergen) => allergen.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("existing selections", () => {
  it("maps every label the old form could store, by meaning", () => {
    expect(normalizeAllergens(["Глутен"])).toEqual(["gluten"]);
    expect(normalizeAllergens(["Яйца"])).toEqual(["eggs"]);
    expect(normalizeAllergens(["Мляко"])).toEqual(["milk"]);
    expect(normalizeAllergens(["Ядки"])).toEqual(["nuts"]);
    expect(normalizeAllergens(["Ядки от дървесни видове"])).toEqual(["nuts"]);
    expect(normalizeAllergens(["Фъстъци"])).toEqual(["peanuts"]);
    expect(normalizeAllergens(["Соя"])).toEqual(["soy"]);
    expect(normalizeAllergens(["Сусам"])).toEqual(["sesame"]);
  });

  it("merges the two old nut options into one record", () => {
    expect(normalizeAllergens(["Ядки", "Ядки от дървесни видове"])).toEqual([
      "nuts",
    ]);
  });

  it("is stable when applied to its own output", () => {
    const once = normalizeAllergens(["Мляко", "Глутен", "Сусам"]);
    expect(normalizeAllergens(once)).toEqual(once);
  });

  it("reads a current label or code, whatever the case and spacing", () => {
    expect(normalizeAllergens([" мляко и млечни продукти ", "GLUTEN"])).toEqual([
      "gluten",
      "milk",
    ]);
  });

  it("assigns nothing that was not selected", () => {
    expect(normalizeAllergens([])).toEqual([]);
    expect(selectedAllergens(["Глутен", "Мляко"])).toHaveLength(2);
  });

  it("orders by the list's numbers, not by when it was ticked", () => {
    expect(
      selectedAllergens(["Мляко", "Глутен"]).map(formatAllergen),
    ).toEqual(["1. Зърнени култури, съдържащи глутен", "7. Мляко и млечни продукти"]);
  });

  it("does not invent a meaning for a value it cannot read", () => {
    expect(normalizeAllergens(["Нещо друго"])).toEqual([]);
  });

  it("keeps such a value in the database and reports it", () => {
    expect(canonicalStoredAllergens(["Нещо друго", "Ядки", "Ядки"])).toEqual({
      stored: ["nuts", "Нещо друго"],
      unknown: ["Нещо друго"],
    });
  });

  it("leaves an already converted row unchanged", () => {
    expect(canonicalStoredAllergens(["gluten", "milk"]).stored).toEqual([
      "gluten",
      "milk",
    ]);
  });
});
