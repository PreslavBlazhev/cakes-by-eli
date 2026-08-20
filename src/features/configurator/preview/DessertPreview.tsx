"use client";

import { CakePreview } from "./CakePreview";
import { CakePopPreview } from "./CakePopPreview";
import { CookiePreview } from "./CookiePreview";
import { CupcakePreview } from "./CupcakePreview";
import { EclairPreview } from "./EclairPreview";
import { GenericPreview } from "./GenericPreview";
import { MacaronPreview } from "./MacaronPreview";
import type { PreviewModel } from "./model";

/**
 * Renderer registry. A dessert type stores its renderer key in the database,
 * so a new dessert can reuse an existing visualiser (a cheesecake is a
 * single-tier cake) or fall back to the presentation-box composition until a
 * dedicated renderer is written.
 */
const RENDERERS: Record<string, (props: { model: PreviewModel }) => React.ReactNode> = {
  cake: CakePreview,
  eclair: EclairPreview,
  cupcake: CupcakePreview,
  macaron: MacaronPreview,
  cookie: CookiePreview,
  cakepop: CakePopPreview,
  generic: GenericPreview,
};

export function DessertPreview({ model }: { model: PreviewModel }) {
  const Renderer = RENDERERS[model.renderer] ?? GenericPreview;
  return <Renderer model={model} />;
}

export const AVAILABLE_RENDERERS = Object.keys(RENDERERS);
