/**
 * Shared vector geometry for the dessert visualisers.
 *
 * Everything is deterministic — no `Math.random()` — so the server render and
 * the client hydration always produce byte-identical SVG.
 */

export const VIEWBOX = { width: 400, height: 400 };
export const BASELINE = 392;

export type Box = { x: number; y: number; width: number; height: number };

/** The area a composition should fill, leaving a little breathing room. */
export const FRAME: Box = {
  x: 14,
  y: 14,
  width: VIEWBOX.width - 28,
  height: VIEWBOX.height - 28,
};

/**
 * Scales and centres a composition so it always fills the frame.
 *
 * Renderers draw in whatever coordinates are natural for them — a cake grows
 * upward from a fixed baseline, a tray of éclairs spreads sideways — and the
 * amount of space they occupy changes with the customer's choices. Without
 * this, a single-tier cake would sit in the bottom third of an otherwise empty
 * box while a three-tier one would touch the edges.
 */
export function fitTransform(content: Box, frame: Box = FRAME): string {
  const scale = Math.min(
    frame.width / content.width,
    frame.height / content.height,
  );

  const tx =
    frame.x + (frame.width - content.width * scale) / 2 - content.x * scale;
  const ty =
    frame.y + (frame.height - content.height * scale) / 2 - content.y * scale;

  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})`;
}

/** Convenience for compositions described by their edges rather than size. */
export function boxFromEdges(
  left: number,
  top: number,
  right: number,
  bottom: number,
): Box {
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export type CakeShape = "round" | "square" | "rect" | "heart";

export type TierGeometry = {
  /** Horizontal centre. */
  cx: number;
  /** Top edge of the tier body. */
  top: number;
  /** Bottom edge of the tier body. */
  bottom: number;
  width: number;
  height: number;
  /** Vertical radius of the elliptical cap — this is what sells the shape. */
  capRy: number;
};

const TIER_PRESETS: Record<number, { width: number; height: number }[]> = {
  1: [{ width: 196, height: 128 }],
  2: [
    { width: 206, height: 116 },
    { width: 152, height: 100 },
  ],
  3: [
    { width: 218, height: 104 },
    { width: 164, height: 92 },
    { width: 118, height: 80 },
  ],
};

/** How deep the top ellipse looks, per shape. */
function capRatio(shape: CakeShape): number {
  switch (shape) {
    case "square":
      return 0.055;
    case "rect":
      return 0.07;
    case "heart":
      return 0.1;
    default:
      return 0.115;
  }
}

/** Wider silhouette for the rectangular cake. */
function widthScale(shape: CakeShape): number {
  return shape === "rect" ? 1.12 : 1;
}

export function buildTiers(
  tierCount: number,
  shape: CakeShape,
): TierGeometry[] {
  const preset = TIER_PRESETS[Math.min(3, Math.max(1, tierCount))] ?? TIER_PRESETS[1];
  const scale = widthScale(shape);
  const ratio = capRatio(shape);

  const tiers: TierGeometry[] = [];
  let bottom = BASELINE;

  for (const item of preset) {
    const width = item.width * scale;
    const top = bottom - item.height;
    tiers.push({
      cx: VIEWBOX.width / 2,
      top,
      bottom,
      width,
      height: item.height,
      capRy: (width / 2) * ratio,
    });
    // The next tier sits on the visual top surface, slightly inside the cap.
    bottom = top + (width / 2) * ratio * 0.55;
  }

  return tiers;
}

/**
 * Body of one tier: straight sides, an elliptical foot and a flat top edge
 * (the cap ellipse is drawn separately so it can take its own highlight).
 */
export function tierBodyPath(tier: TierGeometry, shape: CakeShape): string {
  const half = tier.width / 2;
  const left = tier.cx - half;
  const right = tier.cx + half;
  const ry = tier.capRy;
  const corner = shape === "square" || shape === "rect" ? 3 : 8;

  return [
    `M ${left} ${tier.top}`,
    `L ${left} ${tier.bottom - corner}`,
    `A ${half} ${ry} 0 0 0 ${right} ${tier.bottom - corner}`,
    `L ${right} ${tier.top}`,
    "Z",
  ].join(" ");
}

/** Heart silhouette used when the customer picks the heart shape. */
export function heartPath(cx: number, baseY: number, width: number): string {
  const w = width / 2;
  const topY = baseY - width * 0.86;
  const tipY = baseY;
  return [
    `M ${cx} ${topY + width * 0.2}`,
    `C ${cx - w * 0.55} ${topY - width * 0.28} ${cx - w * 1.35} ${topY + width * 0.16} ${cx - w} ${topY + width * 0.52}`,
    `C ${cx - w * 0.86} ${topY + width * 0.86} ${cx - w * 0.34} ${tipY - width * 0.06} ${cx} ${tipY}`,
    `C ${cx + w * 0.34} ${tipY - width * 0.06} ${cx + w * 0.86} ${topY + width * 0.86} ${cx + w} ${topY + width * 0.52}`,
    `C ${cx + w * 1.35} ${topY + width * 0.16} ${cx + w * 0.55} ${topY - width * 0.28} ${cx} ${topY + width * 0.2}`,
    "Z",
  ].join(" ");
}

/**
 * Chocolate drip running over the rim of a tier. The wave is derived from the
 * tier width so it always lands inside the silhouette.
 */
export function dripPath(tier: TierGeometry, drops = 9): string {
  const half = tier.width / 2;
  const left = tier.cx - half;
  const span = tier.width;
  const step = span / drops;
  const lipTop = tier.top;
  const lipBottom = tier.top + tier.capRy + 6;

  const parts: string[] = [`M ${left} ${lipTop}`, `L ${left} ${lipBottom}`];

  for (let i = 0; i < drops; i += 1) {
    const x0 = left + i * step;
    const x1 = x0 + step;
    const mid = (x0 + x1) / 2;
    // A stable, non-random rhythm keeps the drips organic but reproducible.
    const depth = 12 + ((i * 37) % 5) * 7;
    parts.push(
      `Q ${mid} ${lipBottom + depth} ${x1} ${lipBottom - ((i * 13) % 4)}`,
    );
  }

  parts.push(`L ${left + span} ${lipTop}`, "Z");
  return parts.join(" ");
}

/**
 * Evenly distributes decoration items along the visible front arc of a tier's
 * top surface, alternating slightly in depth so the cluster reads as 3D.
 */
export function arcPositions(
  tier: TierGeometry,
  count: number,
  spread = 0.78,
): { x: number; y: number; scale: number }[] {
  if (count <= 0) return [];

  const half = (tier.width / 2) * spread;
  const out: { x: number; y: number; scale: number }[] = [];

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1 … 1
    const x = tier.cx + t * half;
    // Points on the ellipse rim, pushed slightly forward.
    const y = tier.top + tier.capRy * (1 - t * t) * 0.9 + 2;
    const scale = 0.86 + (1 - Math.abs(t)) * 0.2;
    out.push({ x, y, scale });
  }

  return out;
}

/** Stable pseudo-random in [0, 1) from an integer seed. */
export function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Slightly darkens a hex colour — used for shading without extra tokens. */
export function shade(hex: string, amount: number): string {
  const normalised = hex.replace("#", "");
  const full =
    normalised.length === 3
      ? normalised
          .split("")
          .map((c) => c + c)
          .join("")
      : normalised;

  if (full.length !== 6) return hex;

  const num = Number.parseInt(full, 16);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0xff) + amount);
  const b = clamp((num & 0xff) + amount);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Picks a readable ink colour for text drawn on a frosting colour. */
export function contrastInk(hex: string): string {
  const normalised = hex.replace("#", "");
  const full =
    normalised.length === 3
      ? normalised
          .split("")
          .map((c) => c + c)
          .join("")
      : normalised;
  if (full.length !== 6) return "#3a2a25";

  const num = Number.parseInt(full, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.62 ? "#7a4257" : "#fdf4ea";
}
