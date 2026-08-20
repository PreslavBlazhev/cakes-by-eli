"use client";

import { AnimatePresence, motion } from "motion/react";

import {
  channelColor,
  channelList,
  channelNumber,
  channelValue,
  NAMED_COLORS,
} from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { seeded, shade, VIEWBOX } from "./geometry";
import { DecorItem, decorationGlyph } from "./decorations";

const spring = { type: "spring", stiffness: 220, damping: 22 } as const;
const colorTransition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

const CENTRE = { cx: VIEWBOX.width / 2, cy: VIEWBOX.height / 2 };
const BOARD = 146;

/**
 * Plan view for everything that is served as a set rather than as one object.
 *
 * Éclairs, macarons, cookies and cake pops are laid out on a board, and how
 * many there are and how they are arranged is exactly what the elevation
 * cannot show — it can only draw the front row. This view is the board seen
 * from above, so the customer can count what they are actually ordering.
 */
export function PlateTopView({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const renderer = model.renderer;
  const count = Math.max(1, Math.min(24, channelNumber(model, "count", 6)));
  const decorations = channelList(model, "decoration");

  // Each renderer keeps its colour on a different channel; the first one that
  // is actually set wins, so a new dessert type needs no code here.
  const primary =
    firstColor(model, ["glaze", "coating", "icingColors", "shellColors", "frostingColor"]) ??
    NAMED_COLORS.blush;
  const filling = channelColor(model, "filling", NAMED_COLORS.cream);

  const layout = ringLayout(count, BOARD);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={buildAltText(model, count)}
    >
      <defs>
        <radialGradient id={`cbe-board-${uid}`} cx="0.38" cy="0.32" r="0.86">
          <stop offset="0%" stopColor="#f6ece0" />
          <stop offset="72%" stopColor="#e7d7c3" />
          <stop offset="100%" stopColor="#cdb79c" />
        </radialGradient>
      </defs>

      <circle
        cx={CENTRE.cx}
        cy={CENTRE.cy}
        r={BOARD + 24}
        fill={`url(#cbe-board-${uid})`}
      />
      <circle
        cx={CENTRE.cx}
        cy={CENTRE.cy}
        r={BOARD + 24}
        fill="none"
        stroke="#b99b76"
        strokeOpacity={0.4}
      />
      <circle
        cx={CENTRE.cx}
        cy={CENTRE.cy}
        r={BOARD + 8}
        fill="none"
        stroke="#b99b76"
        strokeOpacity={0.2}
      />

      <AnimatePresence initial={false}>
        {layout.map((pos, index) => (
          <motion.g
            key={`item-${index}`}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ ...spring, delay: Math.min(index, 12) * 0.03 }}
            style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
          >
            <g
              transform={`translate(${pos.x} ${pos.y}) rotate(${
                (pos.angle * 180) / Math.PI
              }) scale(${pos.scale})`}
            >
              <ItemGlyph renderer={renderer} primary={primary} filling={filling} seed={index} />
            </g>
          </motion.g>
        ))}
      </AnimatePresence>

      {/* Decorations scattered between the items, as they would be plated. */}
      <AnimatePresence initial={false}>
        {decorations
          .filter((token) => token !== "sprinkles" && token !== "candles")
          .slice(0, 4)
          .flatMap((token, tokenIndex) =>
            [0, 1, 2].map((i) => {
              const glyph = decorationGlyph(token, primary);
              if (!glyph) return null;
              const seed = tokenIndex * 13 + i * 7;
              const angle = seeded(seed) * Math.PI * 2;
              const r = BOARD * (0.34 + seeded(seed + 3) * 0.6);
              return (
                <DecorItem
                  key={`${token}-${i}`}
                  x={CENTRE.cx + Math.sin(angle) * r}
                  y={CENTRE.cy - Math.cos(angle) * r}
                  scale={0.72}
                  rotate={(seeded(seed + 11) - 0.5) * 60}
                  delay={0.25 + tokenIndex * 0.05 + i * 0.03}
                >
                  {glyph}
                </DecorItem>
              );
            }),
          )}
      </AnimatePresence>

      <text
        x={CENTRE.cx}
        y={CENTRE.cy + BOARD + 40}
        textAnchor="middle"
        fill="#98867a"
        style={{
          fontFamily: "var(--font-manrope), sans-serif",
          fontSize: 11,
          letterSpacing: 2,
        }}
      >
        {count} БР.
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function firstColor(model: PreviewModel, channels: string[]): string | null {
  for (const channel of channels) {
    if (channelValue(model, channel)) {
      return channelColor(model, channel, NAMED_COLORS.blush);
    }
  }
  return null;
}

/**
 * Concentric rings, filled from the outside in.
 *
 * A square grid would waste the corners of a round board and would make eight
 * éclairs look like a spreadsheet; rings are how a pâtissier actually plates.
 */
function ringLayout(
  count: number,
  radius: number,
): { x: number; y: number; angle: number; scale: number }[] {
  const out: { x: number; y: number; angle: number; scale: number }[] = [];

  if (count === 1) {
    return [{ x: CENTRE.cx, y: CENTRE.cy, angle: 0, scale: 1.5 }];
  }

  // Ring capacities grow outward; the scale shrinks as the board fills.
  const rings: number[] = [];
  let remaining = count;
  let capacity = 6;
  while (remaining > 0) {
    const take = Math.min(remaining, capacity);
    rings.push(take);
    remaining -= take;
    capacity += 6;
  }

  const scale = Math.max(0.5, Math.min(1.25, 7 / Math.sqrt(count * 2.4)));

  rings.forEach((inRing, ringIndex) => {
    // Innermost ring sits nearer the centre; a single leftover item centres.
    const ringRadius =
      rings.length === 1
        ? radius * 0.58
        : radius * (0.3 + (ringIndex / Math.max(1, rings.length - 1)) * 0.62);

    if (inRing === 1 && ringIndex === 0) {
      out.push({ x: CENTRE.cx, y: CENTRE.cy, angle: 0, scale });
      return;
    }

    for (let i = 0; i < inRing; i += 1) {
      const angle = (i / inRing) * Math.PI * 2 + ringIndex * 0.4;
      out.push({
        x: CENTRE.cx + Math.sin(angle) * ringRadius,
        y: CENTRE.cy - Math.cos(angle) * ringRadius,
        angle,
        scale,
      });
    }
  });

  return out;
}

/** A single item drawn as it looks from directly above. */
function ItemGlyph({
  renderer,
  primary,
  filling,
  seed,
}: {
  renderer: string;
  primary: string;
  filling: string;
  seed: number;
}) {
  const edge = shade(primary, -50);

  switch (renderer) {
    case "eclair":
      return (
        <g>
          <rect x={-13} y={-31} width={26} height={62} rx={13} fill={shade(primary, -22)} />
          <rect x={-11} y={-29} width={22} height={58} rx={11} fill={primary} />
          <motion.rect
            x={-8}
            y={-24}
            width={16}
            height={20}
            rx={8}
            animate={{ fill: shade(primary, 28) }}
            transition={colorTransition}
            opacity={0.6}
          />
        </g>
      );

    case "macaron":
      return (
        <g>
          <circle r={22} fill={shade(primary, -30)} />
          <circle r={20} fill={primary} />
          <circle r={13} fill={shade(primary, 22)} opacity={0.5} />
          <circle r={5} fill={filling} opacity={0.55} />
        </g>
      );

    case "cookie":
      return (
        <g>
          <circle r={22} fill="#d8ab74" />
          <circle r={19} fill={primary} />
          <circle r={19} fill="none" stroke={edge} strokeOpacity={0.35} />
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={(seeded(seed * 3 + i) - 0.5) * 20}
              cy={(seeded(seed * 5 + i) - 0.5) * 20}
              r={2.2}
              fill={shade(primary, -40)}
              opacity={0.7}
            />
          ))}
        </g>
      );

    case "cakepop":
      return (
        <g>
          <circle r={19} fill={shade(primary, -28)} />
          <circle r={17} fill={primary} />
          <circle cx={-5} cy={-5} r={5} fill="#fffdf9" opacity={0.35} />
        </g>
      );

    case "cupcake":
      // A rosette of piped frosting, seen end-on.
      return (
        <g>
          <circle r={24} fill="#c9a877" opacity={0.55} />
          <circle r={21} fill={shade(primary, -18)} />
          <circle r={16} fill={primary} />
          <circle r={10} fill={shade(primary, 18)} />
          <circle r={4} fill={shade(primary, 34)} />
        </g>
      );

    default:
      return (
        <g>
          <circle r={20} fill={shade(primary, -26)} />
          <circle r={17} fill={primary} />
          <circle r={7} fill={filling} opacity={0.6} />
        </g>
      );
  }
}

function buildAltText(model: PreviewModel, count: number): string {
  const parts = [`Изглед отгоре · ${count} бр.`];
  if (model.labels.decoration?.length) {
    parts.push(model.labels.decoration.join(", ").toLowerCase());
  }
  return parts.join(" · ");
}
