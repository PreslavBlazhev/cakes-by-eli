import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DessertPreview } from "@/features/configurator/preview/DessertPreview";
import type { PreviewModel } from "@/features/configurator/preview/model";

/**
 * Regression cover for a bug that made the configurator preview show only the
 * cake stand.
 *
 * The order page mounts the same visualiser three times (a compact preview and
 * an expanded one for phones, plus the sticky one for wide screens). All three
 * used to emit identical gradient ids, so every `url(#id)` resolved to the
 * first copy — which lives inside a `display:none` branch on desktop — and
 * every gradient-filled shape vanished. Only the flat-coloured plate and the
 * white piping dots survived.
 */

function model(renderer: string): PreviewModel {
  return {
    renderer,
    channels: {
      shape: ["round"],
      tiers: ["2"],
      frostingColor: ["#f7e7d3"],
      frostingStyle: ["drip"],
      dripColor: ["#5a3524"],
      sponge: ["#6b4430"],
      decoration: ["strawberries"],
      count: ["6"],
      glaze: ["#4f2f22"],
      coating: ["#7a4b34"],
      shellColors: ["#e3aeb6"],
      icingColors: ["#f2d7d7"],
      assortment: ["cake"],
    },
    labels: {},
    text: {},
    numbers: {},
  };
}

const RENDERERS = [
  "cake",
  "eclair",
  "cupcake",
  "macaron",
  "cookie",
  "cakepop",
  "generic",
];

function idsIn(markup: string): string[] {
  return [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
}

function refsIn(markup: string): string[] {
  return [...markup.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
}

describe.each(RENDERERS)("%s preview", (renderer) => {
  const first = renderToStaticMarkup(<DessertPreview model={model(renderer)} />);
  const both = renderToStaticMarkup(
    <>
      <DessertPreview model={model(renderer)} />
      <DessertPreview model={model(renderer)} />
    </>,
  );

  it("references only ids it defines itself", () => {
    const defined = new Set(idsIn(first));
    for (const ref of refsIn(first)) {
      expect(defined.has(ref), `липсва дефиниция за #${ref}`).toBe(true);
    }
  });

  it("gives every id a unique name when mounted twice", () => {
    const ids = idsIn(both);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each copy's references pointing at its own ids", () => {
    const halves = both.split("</svg>").filter((part) => part.includes("<svg"));
    expect(halves.length).toBe(2);

    for (const half of halves) {
      const defined = new Set(idsIn(half));
      for (const ref of refsIn(half)) {
        expect(defined.has(ref), `препратка към чужд #${ref}`).toBe(true);
      }
    }
  });
});

describe("cake preview content", () => {
  it("draws the tiers, not just the stand", () => {
    const markup = renderToStaticMarkup(<DessertPreview model={model("cake")} />);

    // The tier bodies are the only paths filled with the body gradient.
    const bodyRefs = refsIn(markup).filter((r) => r.startsWith("cbe-cake-body"));
    expect(bodyRefs.length).toBeGreaterThanOrEqual(2);

    // And the drip layer must be present for the drip finish.
    expect(refsIn(markup).some((r) => r.startsWith("cbe-drip"))).toBe(true);
  });
});
