import { describe, expect, it } from "vitest";

import {
  BASELINE,
  boxFromEdges,
  buildTiers,
  FRAME,
  fitTransform,
  VIEWBOX,
} from "@/features/configurator/preview/geometry";
import type { Box, CakeShape } from "@/features/configurator/preview/geometry";

/**
 * Regression cover for the framing bug: the cake used to be drawn from a fixed
 * baseline into a fixed viewBox, so a single-tier cake sat in the bottom third
 * of an otherwise empty box and looked tiny.
 */

function parseTransform(transform: string) {
  const translate = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(transform);
  const scale = /scale\(([\d.]+)\)/.exec(transform);
  if (!translate || !scale) throw new Error(`unparsable: ${transform}`);
  return {
    tx: Number(translate[1]),
    ty: Number(translate[2]),
    scale: Number(scale[1]),
  };
}

function applied(box: Box, transform: string): Box {
  const { tx, ty, scale } = parseTransform(transform);
  return {
    x: box.x * scale + tx,
    y: box.y * scale + ty,
    width: box.width * scale,
    height: box.height * scale,
  };
}

/** Mirrors the box CakePreview computes for a given configuration. */
function cakeBox(tierCount: number, shape: CakeShape, hasTopper: boolean): Box {
  const isHeart = shape === "heart";
  const tiers = buildTiers(isHeart ? 1 : tierCount, shape);
  const topTier = tiers[tiers.length - 1];

  const halfWidth = Math.max(
    Math.max(...tiers.map((tier) => tier.width), isHeart ? 220 : 0) / 2 + 34,
    134,
  );

  return boxFromEdges(
    VIEWBOX.width / 2 - halfWidth,
    isHeart
      ? BASELINE - 210 * 0.86 - 26
      : topTier.top - topTier.capRy - (hasTopper ? 74 : 16),
    VIEWBOX.width / 2 + halfWidth,
    BASELINE + 70,
  );
}

describe("fitTransform", () => {
  it("scales a wide composition to the frame width and centres it", () => {
    const content: Box = { x: 0, y: 0, width: 200, height: 50 };
    const result = applied(content, fitTransform(content));

    expect(result.width).toBeCloseTo(FRAME.width, 1);
    // Centred vertically inside the frame.
    expect(result.y + result.height / 2).toBeCloseTo(
      FRAME.y + FRAME.height / 2,
      1,
    );
  });

  it("scales a tall composition to the frame height and centres it", () => {
    const content: Box = { x: 0, y: 0, width: 50, height: 200 };
    const result = applied(content, fitTransform(content));

    expect(result.height).toBeCloseTo(FRAME.height, 1);
    expect(result.x + result.width / 2).toBeCloseTo(
      FRAME.x + FRAME.width / 2,
      1,
    );
  });

  it("never lets a composition spill outside the frame", () => {
    const content: Box = { x: -120, y: 300, width: 640, height: 90 };
    const result = applied(content, fitTransform(content));

    expect(result.x).toBeGreaterThanOrEqual(FRAME.x - 0.5);
    expect(result.y).toBeGreaterThanOrEqual(FRAME.y - 0.5);
    expect(result.x + result.width).toBeLessThanOrEqual(
      FRAME.x + FRAME.width + 0.5,
    );
    expect(result.y + result.height).toBeLessThanOrEqual(
      FRAME.y + FRAME.height + 0.5,
    );
  });
});

describe("the cake fills its block at every size", () => {
  const shapes: CakeShape[] = ["round", "square", "rect", "heart"];

  for (const shape of shapes) {
    for (const tiers of [1, 2, 3]) {
      for (const hasTopper of [false, true]) {
        it(`${shape}, ${tiers} tier(s), topper: ${hasTopper}`, () => {
          const box = cakeBox(tiers, shape, hasTopper);
          const result = applied(box, fitTransform(box));

          // It must touch one of the frame's dimensions — that is what stops
          // the dessert from floating small in the bottom of the box.
          const fillsWidth = result.width >= FRAME.width - 0.5;
          const fillsHeight = result.height >= FRAME.height - 0.5;
          expect(fillsWidth || fillsHeight).toBe(true);

          // And it must use most of the other one, so the block never looks
          // mostly empty.
          const coverage = Math.max(
            result.width / FRAME.width,
            result.height / FRAME.height,
          );
          expect(coverage).toBeGreaterThan(0.99);

          const otherCoverage = Math.min(
            result.width / FRAME.width,
            result.height / FRAME.height,
          );
          expect(otherCoverage).toBeGreaterThan(0.55);

          // Nothing may leave the drawing surface.
          expect(result.x).toBeGreaterThanOrEqual(0);
          expect(result.y).toBeGreaterThanOrEqual(0);
          expect(result.x + result.width).toBeLessThanOrEqual(VIEWBOX.width);
          expect(result.y + result.height).toBeLessThanOrEqual(VIEWBOX.height);
        });
      }
    }
  }

  it("gives a one-tier cake a comparable presence to a three-tier one", () => {
    const area = (tiers: number) => {
      const box = cakeBox(tiers, "round", false);
      const result = applied(box, fitTransform(box));
      return (result.width * result.height) / (FRAME.width * FRAME.height);
    };

    const one = area(1);
    const three = area(3);

    // A short wide cake is legitimately not as tall as a three-tier one, but
    // it must still command most of the block. Before the fix it filled
    // roughly a fifth of it and sat pinned to the bottom edge.
    expect(one).toBeGreaterThan(0.7);
    expect(three).toBeGreaterThan(0.7);
    expect(Math.min(one, three) / Math.max(one, three)).toBeGreaterThan(0.85);
  });
});
