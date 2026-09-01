import { describe, expect, it } from "vitest";

import { marqueeCopies } from "@/components/site/Marquee";

/**
 * The strapline animates by exactly one copy of its list and then restarts.
 * The seam is invisible only while the copies that follow the first one still
 * cover the whole band at that instant — otherwise the band runs out of words
 * and a gap opens at the right edge before the jump back.
 *
 * That is the bug this replaces: a fixed pair of copies was 1034px wide on a
 * 1265px band, so 231px of the strip was empty on every turn.
 */
const spareAtSeam = (bandWidth: number, copyWidth: number) =>
  marqueeCopies(bandWidth, copyWidth) * copyWidth - copyWidth - bandWidth;

describe("how many copies the strapline needs", () => {
  it("covers the band at the seam, from a phone to a very wide desktop", () => {
    const copyWidth = 1033.6; // the six Bulgarian labels, as measured

    for (let bandWidth = 320; bandWidth <= 5120; bandWidth += 8) {
      expect(spareAtSeam(bandWidth, copyWidth)).toBeGreaterThanOrEqual(0);
    }
  });

  it("covers the band for short lists too, where one copy is narrow", () => {
    for (const copyWidth of [80, 140, 260, 512, 1033.6, 2400]) {
      for (const bandWidth of [320, 768, 1024, 1265, 1920, 2560, 3840]) {
        expect(spareAtSeam(bandWidth, copyWidth)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never drops below the two copies the server renders", () => {
    expect(marqueeCopies(200, 4000)).toBe(2);
    expect(marqueeCopies(1, 4000)).toBe(2);
  });

  it("adds copies as the band widens", () => {
    expect(marqueeCopies(1265, 1033.6)).toBe(3);
    expect(marqueeCopies(2560, 1033.6)).toBe(4);
    expect(marqueeCopies(3840, 1033.6)).toBe(5);
  });

  it("falls back to two copies before anything has been measured", () => {
    expect(marqueeCopies(0, 0)).toBe(2);
    expect(marqueeCopies(1265, 0)).toBe(2);
    expect(marqueeCopies(Number.NaN, 1033.6)).toBe(2);
  });
});
