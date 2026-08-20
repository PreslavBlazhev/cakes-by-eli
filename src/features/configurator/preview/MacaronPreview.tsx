"use client";

import { AnimatePresence, motion } from "motion/react";

import { channelList, channelNumber, NAMED_COLORS } from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { boxFromEdges, fitTransform, seeded, shade, VIEWBOX } from "./geometry";

const spring = { type: "spring", stiffness: 230, damping: 22 } as const;

function resolveColor(token: string, fallback: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(token)) return token;
  return NAMED_COLORS[token] ?? fallback;
}

/**
 * A composed macaron display: a stacked tower in front, a row behind, coloured
 * from the chosen palette. Adding a colour re-shuffles the arrangement with an
 * animated transition rather than a redraw.
 */
export function MacaronPreview({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const palette = channelList(model, "shellColors").map((token) =>
    resolveColor(token, NAMED_COLORS.blush),
  );
  const colors = palette.length > 0 ? palette : [NAMED_COLORS.blush];
  const fillings = channelList(model, "filling").map((token) =>
    resolveColor(token, "#f6e9d2"),
  );
  const requested = channelNumber(model, "count", 6);
  const shown = Math.max(3, Math.min(9, requested <= 9 ? requested : 9));

  const layout = buildLayout(shown);

  const contentBox = boxFromEdges(40, 258, 360, 458);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Визуализация на макарони — ${requested} броя`}
    >
      <defs>
        <radialGradient id={`cbe-mac-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3a2a25" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3a2a25" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cbe-plate-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#fdf6ec" />
          <stop offset="100%" stopColor="#e9d6bd" />
        </linearGradient>
      </defs>

      <g transform={fitTransform(contentBox)}>

      <ellipse
        cx={VIEWBOX.width / 2}
        cy={412}
        rx="156"
        ry="26"
        fill={`url(#cbe-mac-shadow-${uid})`}
      />

      {/* Plate */}
      <ellipse cx={VIEWBOX.width / 2} cy={396} rx="148" ry="34" fill="#d9bd97" />
      <ellipse
        cx={VIEWBOX.width / 2}
        cy={390}
        rx="148"
        ry="34"
        fill={`url(#cbe-plate-${uid})`}
      />
      <ellipse
        cx={VIEWBOX.width / 2}
        cy={390}
        rx="120"
        ry="26"
        fill="none"
        stroke="#e4d0b5"
        strokeWidth="1.2"
      />

      <AnimatePresence initial={false}>
        {layout.map((item, i) => {
          const color = colors[i % colors.length];
          const filling = fillings[i % Math.max(1, fillings.length)] ?? "#f6e9d2";
          return (
            <g
              key={`mac-${i}`}
              transform={`translate(${item.x} ${item.y}) rotate(${item.rotate}) scale(${item.scale})`}
            >
              <motion.g
                initial={{ opacity: 0, scale: 0.6, y: -18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ ...spring, delay: i * 0.05 }}
                style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
              >
                <Macaron color={color} filling={filling} />
              </motion.g>
            </g>
          );
        })}
      </AnimatePresence>

      {requested > shown ? (
        <text
          x={VIEWBOX.width / 2}
          y={446}
          textAnchor="middle"
          fill="#6f5b53"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 17,
            fontStyle: "italic",
          }}
        >
          {`… общо ${requested} броя`}
        </text>
      ) : null}
      </g>
    </svg>
  );
}

function Macaron({ color, filling }: { color: string; filling: string }) {
  return (
    <g>
      <ellipse cx="0" cy="14" rx="34" ry="8" fill="#3a2a25" opacity="0.12" />
      {/* Bottom shell */}
      <ellipse cx="0" cy="8" rx="34" ry="17" fill={color} />
      <path
        d="M-33 8 q6 12 33 12 q27 0 33 -12 q-4 15 -33 15 q-29 0 -33 -15 z"
        fill={shade(color, -34)}
        opacity="0.6"
      />
      {/* Filling */}
      <rect x="-31" y="-4" width="62" height="10" rx="5" fill={filling} />
      {/* Top shell */}
      <ellipse cx="0" cy="-11" rx="34" ry="17" fill={color} />
      <path
        d="M-33 -11 q6 12 33 12 q27 0 33 -12 q-4 15 -33 15 q-29 0 -33 -15 z"
        fill={shade(color, -34)}
        opacity="0.5"
      />
      <ellipse
        cx="-10"
        cy="-16"
        rx="15"
        ry="6"
        fill="#ffffff"
        opacity="0.35"
      />
    </g>
  );
}

/** Front row, back row and a small tower — deterministic, never random. */
function buildLayout(count: number) {
  const items: { x: number; y: number; scale: number; rotate: number }[] = [];
  const centre = VIEWBOX.width / 2;

  const back = Math.min(count, Math.ceil(count / 2));
  for (let i = 0; i < back; i += 1) {
    const t = back === 1 ? 0 : (i / (back - 1)) * 2 - 1;
    items.push({
      x: centre + t * 108,
      y: 300,
      scale: 0.84,
      rotate: (seeded(i * 2.3) - 0.5) * 12,
    });
  }

  const front = count - back;
  for (let i = 0; i < front; i += 1) {
    const t = front === 1 ? 0 : (i / (front - 1)) * 2 - 1;
    items.push({
      x: centre + t * 92,
      y: 366,
      scale: 1,
      rotate: (seeded(i * 5.1 + 9) - 0.5) * 14,
    });
  }

  return items;
}
