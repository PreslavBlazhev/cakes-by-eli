/**
 * Shared vector geometry for the dessert visualisers.
 *
 * Everything is deterministic — no `Math.random()` — so the server render and
 * the client hydration always produce byte-identical SVG.
 */

export const VIEWBOX = { width: 400, height: 400 };
export const BASELINE = 392;

/**
 * Rounds a computed number before it reaches an SVG attribute.
 *
 * "Deterministic" above is not quite enough on its own: the same arithmetic
 * has to give the same answer on the server and in the browser, and two
 * JavaScript engines are not obliged to agree to the last bit on `sin`,
 * `cos` or `hypot`. When they disagree React throws the hydrated tree away
 * and the visualiser silently loses its animations. Four places is finer
 * than a 400-unit viewBox can show and leaves nothing to disagree about.
 */
export function snap(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

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

/**
 * How deep the top surface looks, as a fraction of the tier's half-width.
 *
 * This is the camera. A round cake is drawn from barely above the rim, which
 * is why its top reads as a thin ellipse. The heart is drawn from much higher
 * up, because a heart squashed into a sliver stops being a heart — and the
 * shape is the entire reason somebody ordered one.
 */
function capRatio(shape: CakeShape): number {
  switch (shape) {
    case "square":
      return 0.055;
    case "rect":
      return 0.07;
    case "heart":
      return HEART_ASPECT * HEART_SQUASH;
    default:
      return 0.115;
  }
}

/** How far a tier sinks into the one below it, as a fraction of the cap. */
function sinkRatio(shape: CakeShape): number {
  // The heart's cap is deep, so the same fraction would swallow the tier
  // below it whole; the stack has to stay legible as a stack.
  return shape === "heart" ? 0.3 : 0.55;
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
  const sink = sinkRatio(shape);

  const tiers: TierGeometry[] = [];
  // From this camera a shaped cake's nearest corner — the heart's point —
  // hangs below the rest of its foot. The baseline is the lowest thing the
  // cake puts on the stand, so the stack is lifted to keep it there.
  const overhang =
    shape === "heart" ? (preset[0].width * scale * ratio) / 2 : 0;
  let bottom = BASELINE - overhang;

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
    bottom = top + (width / 2) * ratio * sink;
  }

  return tiers;
}

/**
 * How much wider the stand's ellipses open from this shape's camera.
 *
 * The cake and the thing it stands on have to be seen from the same place. A
 * heart is drawn from higher up than a round cake, so its stand has to open
 * up by the same amount — otherwise the cake reads as hovering over its plate
 * rather than resting on it.
 */
const BASE_TILT = 0.144;

export function standScale(shape: CakeShape): number {
  return shape === "heart" ? HEART_SQUASH / BASE_TILT : 1;
}

/** How far the stand reaches below the baseline. */
export function standDepth(shape: CakeShape): number {
  return 50 + 20 * standScale(shape);
}

/**
 * The area a cake actually occupies, which moves with every choice: the
 * number of tiers, whether there is a topper, how deep the shape's own cap
 * is. `fitTransform` then scales this to fill the frame.
 */
export function cakeContentBox({
  tiers,
  shape,
  hasTopper,
}: {
  tiers: TierGeometry[];
  shape: CakeShape;
  hasTopper: boolean;
}): Box {
  const topTier = tiers[tiers.length - 1];
  const halfWidth = Math.max(
    Math.max(...tiers.map((tier) => tier.width)) / 2 + 34,
    134,
  );

  return boxFromEdges(
    VIEWBOX.width / 2 - halfWidth,
    topTier.top - topTier.capRy - (hasTopper ? 74 : 16),
    VIEWBOX.width / 2 + halfWidth,
    BASELINE + standDepth(shape),
  );
}

/**
 * Body of one tier: straight sides, an elliptical foot and a flat top edge
 * (the cap ellipse is drawn separately so it can take its own highlight).
 */
export function tierBodyPath(tier: TierGeometry, shape: CakeShape): string {
  if (shape === "heart") return heartBodyPath(tier);

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

/**
 * Chocolate drip running over the rim of a tier. The wave is derived from the
 * tier width so it always lands inside the silhouette.
 */
export function dripPath(
  tier: TierGeometry,
  shape: CakeShape = "round",
  drops = 9,
): string {
  if (shape === "heart") return heartDripPath(tier, drops);

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

/* ------------------------------------------------------------------ *
 * The heart
 * ------------------------------------------------------------------ */

export type Point = { x: number; y: number };

/**
 * The heart is not drawn by eye. It is the classic parametric heart
 *
 *     x = 16 sin³t        y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t
 *
 * sampled and smoothed back into cubic Béziers. Two things follow from that.
 * The proportions are the ones everyone recognises as *a heart* rather than
 * somebody's guess at one; and only the right half is ever computed, because
 * the left is its mirror image — so the silhouette is symmetric exactly, not
 * approximately.
 *
 * Both ends of that half are cusps: the notch and the point both have
 * vertical tangents. The samples are therefore eased towards the ends and the
 * spline is left open there, which is what keeps the point of the heart sharp
 * instead of rounding it off.
 */
const HEART_SAMPLES = 22;

/** How flat the elevation's camera makes the heart's plan. */
export const HEART_SQUASH = 0.42;

function heartCurve(t: number): Point {
  const s = Math.sin(t);
  return {
    x: 16 * s * s * s,
    // Negated: the curve is written for a y-up axis and SVG's points down.
    y: -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    ),
  };
}

const HEART = buildHeart();

/** The heart's height as a fraction of its width. */
export const HEART_ASPECT = HEART.aspect;

function buildHeart() {
  const raw: Point[] = [];
  for (let i = 0; i <= HEART_SAMPLES; i += 1) {
    // Cosine easing crowds the samples towards the notch and the point.
    const t = (Math.PI * (1 - Math.cos(Math.PI * (i / HEART_SAMPLES)))) / 2;
    raw.push(heartCurve(t));
  }

  const width = 32; // x runs −16 … 16
  const top = Math.min(...raw.map((p) => p.y));
  const bottom = Math.max(...raw.map((p) => p.y));
  const aspect = (bottom - top) / width;

  // Normalised into a box one unit wide, centred on the origin, so a caller
  // only ever supplies a centre and a width.
  const half = raw.map((point) => ({
    x: point.x / width,
    y: (point.y - top) / width - aspect / 2,
  }));

  // The widest point is the seam between the half of the outline the viewer
  // sees the wall of and the half hidden behind the cake.
  let widest = 0;
  half.forEach((point, i) => {
    if (point.x > half[widest].x) widest = i;
  });

  return { half, aspect, widest };
}

function heartHalf(
  cx: number,
  cy: number,
  width: number,
  squash: number,
): Point[] {
  return HEART.half.map((point) => ({
    x: cx + point.x * width,
    y: cy + point.y * width * squash,
  }));
}

function mirror(points: Point[], cx: number): Point[] {
  return points.map((p) => ({ x: 2 * cx - p.x, y: p.y }));
}

/**
 * Turns sampled points into a smooth open run of cubic Béziers
 * (Catmull–Rom). The ends are clamped, so a chain starts and ends exactly
 * where its samples do and keeps whatever corner is there.
 */
function curveThrough(points: Point[]): string {
  let d = "";
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[0];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[points.length - 1];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${round2(c1.x)} ${round2(c1.y)} ${round2(c2.x)} ${round2(c2.y)} ${round2(p2.x)} ${round2(p2.y)}`;
  }
  return d;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/** The closed heart outline, centred on (cx, cy) and `width` across. */
export function heartPath(
  cx: number,
  cy: number,
  width: number,
  squash = 1,
): string {
  const right = heartHalf(cx, cy, width, squash);
  const left = mirror(right, cx).reverse();
  return `M ${round2(right[0].x)} ${round2(right[0].y)}${curveThrough(right)}${curveThrough(left)} Z`;
}

/**
 * The stretch of outline whose wall the viewer can see: from the widest point
 * on the left, round the point of the heart, to the widest point on the
 * right. Everything else is behind the cake.
 */
function heartFront(tier: TierGeometry, dy = 0): Point[] {
  const right = heartHalf(
    tier.cx,
    tier.top + dy,
    tier.width,
    HEART_SQUASH,
  ).slice(HEART.widest);
  const left = mirror(right, tier.cx);
  return [...left, ...[...right].reverse().slice(1)];
}

/** The heart-shaped top surface of a tier. */
export function heartCapPath(tier: TierGeometry): string {
  return heartPath(tier.cx, tier.top, tier.width, HEART_SQUASH);
}

/** The wall of a heart tier: its front outline, swept down to the foot. */
function heartBodyPath(tier: TierGeometry): string {
  const rim = heartFront(tier);
  const foot = heartFront(tier, tier.bottom - tier.top).reverse();
  return [
    `M ${round2(rim[0].x)} ${round2(rim[0].y)}`,
    curveThrough(rim),
    ` L ${round2(foot[0].x)} ${round2(foot[0].y)}`,
    curveThrough(foot),
    " Z",
  ].join("");
}

/** Chocolate hanging over the heart's rim, following its curve. */
function heartDripPath(tier: TierGeometry, drops: number): string {
  const rim = heartFront(tier);
  const lip = alongChain(rim, drops).map((p) => ({ x: p.x, y: p.y + 7 }));
  const back = lip.reverse();

  const parts = [`M ${round2(rim[0].x)} ${round2(rim[0].y)}`, curveThrough(rim)];
  parts.push(` L ${round2(back[0].x)} ${round2(back[0].y)}`);

  for (let i = 0; i < back.length - 1; i += 1) {
    const a = back[i];
    const b = back[i + 1];
    // A stable, non-random rhythm keeps the drips organic but reproducible.
    const depth = 11 + ((i * 37) % 5) * 6;
    parts.push(
      ` Q ${round2((a.x + b.x) / 2)} ${round2((a.y + b.y) / 2 + depth)} ${round2(b.x)} ${round2(b.y)}`,
    );
  }

  return `${parts.join("")} Z`;
}

/** The foot of a heart tier as an open path, for a ribbon or a gold line. */
export function heartFootPath(tier: TierGeometry, inset: number): string {
  const chain = heartFront(tier, tier.bottom - tier.top - inset);
  return `M ${round2(chain[0].x)} ${round2(chain[0].y)}${curveThrough(chain)}`;
}

/**
 * Points evenly spaced along the foot of a heart tier — where the piping, the
 * ribbon and the pearls go, which on a heart is a curve rather than a line.
 */
export function heartFootPoints(
  tier: TierGeometry,
  count: number,
  inset: number,
): Point[] {
  return alongChain(heartFront(tier, tier.bottom - tier.top - inset), count);
}

/** Plain Pythagoras — `Math.hypot` is free to round differently per engine. */
function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Resamples a chain of points at even distances along its length. */
function alongChain(points: Point[], count: number): Point[] {
  if (count <= 1) return points.length ? [points[0]] : [];

  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(
      lengths[i - 1] + distance(points[i - 1], points[i]),
    );
  }

  const total = lengths[lengths.length - 1];
  const out: Point[] = [];
  let cursor = 1;

  for (let i = 0; i < count; i += 1) {
    const target = (i / (count - 1)) * total;
    while (cursor < lengths.length - 1 && lengths[cursor] < target) cursor += 1;
    const span = lengths[cursor] - lengths[cursor - 1] || 1;
    const t = (target - lengths[cursor - 1]) / span;
    const a = points[cursor - 1];
    const b = points[cursor];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Where a tier's outline sits, per shape
 * ------------------------------------------------------------------ */

/** A tier's depth as a fraction of its width, seen from directly above. */
export function planAspect(shape: CakeShape): number {
  switch (shape) {
    case "rect":
      return 0.693;
    case "heart":
      return HEART_ASPECT;
    default:
      return 1;
  }
}

/**
 * The point of a tier's outline at a given bearing, as offsets in the shape's
 * own plan — x across, y towards the viewer, both as fractions of the tier's
 * width. A ring of decorations follows this, which is why berries on a heart
 * cake sit round the heart instead of round an invisible circle.
 *
 * The bearing is read as *distance travelled round the edge*, not as a ray
 * cast from the centre. On a circle the two are the same thing; on a heart
 * they are not, and only the first keeps the promise the placement model
 * makes — that n berries are evenly spaced. Cast as rays, evenly spaced
 * angles bunch up wherever the outline is close to the centre, which on a
 * heart means a crowd either side of the notch and gaps down the sides.
 *
 * Bearing 0 is the point of the outline nearest the viewer.
 */
export function outlineOffset(shape: CakeShape, angle: number): Point {
  // A circle needs no table: equal angles already are equal distances.
  if (shape === "round") {
    return { x: Math.sin(angle) * 0.5, y: Math.cos(angle) * 0.5 };
  }

  const table = outlineTable(shape);
  const turns = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
  const position = turns * table.length;
  const index = Math.floor(position);
  const a = table[index % table.length];
  const b = table[(index + 1) % table.length];
  const t = position - index;

  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const OUTLINE_STEPS = 360;
const outlineTables = new Map<CakeShape, Point[]>();

function outlineTable(shape: CakeShape): Point[] {
  const cached = outlineTables.get(shape);
  if (cached) return cached;

  const table = resampleClosed(shapePolygon(shape), OUTLINE_STEPS);
  outlineTables.set(shape, table);
  return table;
}

/**
 * A shape's plan as a closed polygon, one unit wide, starting at the point
 * nearest the viewer and running clockwise as seen from above.
 */
function shapePolygon(shape: CakeShape): Point[] {
  if (shape === "heart") {
    // Down the right side from the point to the notch, then the mirror image
    // back down to the point.
    const right = [...HEART.half].reverse();
    const left = HEART.half.map((p) => ({ x: -p.x, y: p.y }));
    return [...right, ...left.slice(1, -1)];
  }

  const depth = planAspect(shape) / 2;
  return [
    { x: 0, y: depth },
    { x: 0.5, y: depth },
    { x: 0.5, y: -depth },
    { x: -0.5, y: -depth },
    { x: -0.5, y: depth },
  ];
}

/** Points at even distances round a closed polygon. */
function resampleClosed(points: Point[], count: number): Point[] {
  const loop = [...points, points[0]];
  const lengths: number[] = [0];

  for (let i = 1; i < loop.length; i += 1) {
    lengths.push(
      lengths[i - 1] +
        distance(loop[i - 1], loop[i]),
    );
  }

  const total = lengths[lengths.length - 1];
  const out: Point[] = [];
  let cursor = 1;

  for (let i = 0; i < count; i += 1) {
    const target = (i / count) * total;
    while (cursor < lengths.length - 1 && lengths[cursor] < target) cursor += 1;
    const span = lengths[cursor] - lengths[cursor - 1] || 1;
    const t = (target - lengths[cursor - 1]) / span;
    const a = loop[cursor - 1];
    const b = loop[cursor];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  return out;
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
    out.push({ x: snap(x), y: snap(y), scale: snap(scale) });
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
