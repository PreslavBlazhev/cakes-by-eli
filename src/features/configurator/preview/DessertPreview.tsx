"use client";

import { CakePreview } from "./CakePreview";
import { CakePopPreview } from "./CakePopPreview";
import { CakeTopView } from "./CakeTopView";
import { CookiePreview } from "./CookiePreview";
import { CupcakePreview } from "./CupcakePreview";
import { EclairPreview } from "./EclairPreview";
import { GenericPreview } from "./GenericPreview";
import { MacaronPreview } from "./MacaronPreview";
import { PlateTopView } from "./PlateTopView";
import type { PreviewModel } from "./model";

type Renderer = (props: { model: PreviewModel }) => React.ReactNode;

/**
 * Renderer registry. A dessert type stores its renderer key in the database,
 * so a new dessert can reuse an existing visualiser (a cheesecake is a
 * single-tier cake) or fall back to the presentation-box composition until a
 * dedicated renderer is written.
 */
const SIDE: Record<string, Renderer> = {
  cake: CakePreview,
  eclair: EclairPreview,
  cupcake: CupcakePreview,
  macaron: MacaronPreview,
  cookie: CookiePreview,
  cakepop: CakePopPreview,
  generic: GenericPreview,
};

/**
 * Plan views.
 *
 * Only the cake needs a bespoke one — its decorations wrap all the way round,
 * and the elevation can only ever show the front. Everything else is served on
 * a board, so the shared plate view covers them from the same channels.
 */
const TOP: Record<string, Renderer> = {
  cake: CakeTopView,
};

export type PreviewView = "side" | "top";

export function DessertPreview({
  model,
  view = "side",
}: {
  model: PreviewModel;
  view?: PreviewView;
}) {
  if (view === "top") {
    const Renderer = TOP[model.renderer] ?? PlateTopView;
    return <Renderer model={model} />;
  }

  const Renderer = SIDE[model.renderer] ?? GenericPreview;
  return <Renderer model={model} />;
}

export const AVAILABLE_RENDERERS = Object.keys(SIDE);
