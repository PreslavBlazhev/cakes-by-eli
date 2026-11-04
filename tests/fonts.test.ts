import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A deploy failed outright because next/font/google cannot build when Google
 * answers with a font address containing "&". Nothing in the repository had
 * changed the fonts, so these keep the build off Google for good.
 */

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const css = read("src/app/fonts.css");
const layout = read("src/app/layout.tsx");

describe("self-hosted fonts", () => {
  it("does not go through next/font/google", () => {
    expect(layout).not.toContain("next/font/google");
  });

  it("has a real woff2 file for every @font-face", () => {
    const urls = [...css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const bytes = fs.readFileSync(path.join(root, "public", url));
      expect(bytes.subarray(0, 4).toString("latin1"), url).toBe("wOF2");
    }
  });

  it("covers Cyrillic, upright and italic, for both families", () => {
    for (const file of [
      "manrope-cyrillic",
      "playfair-display-cyrillic",
      "playfair-display-italic-cyrillic",
    ]) {
      expect(css).toContain(`/fonts/${file}.woff2`);
    }
  });

  it("preloads only files that exist", () => {
    const preloaded = [...layout.matchAll(/"(\/fonts\/[^"]+)"/g)].map((m) => m[1]);
    expect(preloaded.length).toBeGreaterThan(0);
    for (const url of preloaded) {
      expect(fs.existsSync(path.join(root, "public", url)), url).toBe(true);
    }
  });
});
