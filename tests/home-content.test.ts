import { describe, expect, it } from "vitest";

import {
  HOME_FIELDS,
  homeList,
  readHomeContentForm,
  resolveHomeContent,
} from "@/lib/home-content";
import { sanitizeText } from "@/lib/validation";

/**
 * The home page used to hard-code most of its copy, so the owner could not
 * find where to change it. These pin down the contract that replaced it: one
 * list of fields, defaults equal to the shipped texts, and a cleared field
 * staying cleared instead of snapping back to the default.
 */

describe("home content", () => {
  it("has unique keys", () => {
    const keys = HOME_FIELDS.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to the shipped texts when nothing was saved", () => {
    const copy = resolveHomeContent({});
    expect(copy.featuredEyebrow).toBe("Избрано");
    expect(copy.processTitle).toBe("От идея до\nготов десерт.");
    expect(homeList(copy.marqueeItems)).toHaveLength(6);
  });

  it("tolerates a missing or malformed column", () => {
    expect(resolveHomeContent(null).menuEyebrow).toBe("Менюто");
    expect(resolveHomeContent({ menuEyebrow: 42 }).menuEyebrow).toBe("Менюто");
  });

  it("keeps a field the owner cleared", () => {
    expect(resolveHomeContent({ builderEyebrow: "" }).builderEyebrow).toBe("");
  });

  it("reads the form, keeping line breaks only where they belong", () => {
    const form = new FormData();
    form.set("home.featuredTitle", "Първи ред\r\nВтори ред");
    form.set("home.featuredEyebrow", "едно\nдве");
    form.set("home.marqueeItems", "Торти\n\n  Еклери  \n");
    form.set("home.menuIntro", "x".repeat(1000));

    const copy = readHomeContentForm(form, sanitizeText);

    expect(copy.featuredTitle).toBe("Първи ред\nВтори ред");
    expect(copy.featuredEyebrow).toBe("едно две");
    expect(homeList(copy.marqueeItems)).toEqual(["Торти", "Еклери"]);
    expect(copy.menuIntro).toHaveLength(400);
    // Absent from the form — keeps its default rather than being wiped.
    expect(copy.galleryLink).toBe("Цялата галерия");
  });
});
