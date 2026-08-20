"use client";

import { AnimatePresence, motion } from "motion/react";

import { channelColor, channelList, channelNumber } from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { boxFromEdges, fitTransform, seeded, shade, VIEWBOX } from "./geometry";
import { DecorItem, decorationGlyph } from "./decorations";

const spring = { type: "spring", stiffness: 210, damping: 24 } as const;

/**
 * A tray of éclairs. The number of pastries follows the chosen quantity (up to
 * a legible maximum), the glaze colour morphs, the filling shows at the cut
 * end and decorations settle onto the glaze.
 */
export function EclairPreview({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const glaze = channelColor(model, "glaze", "#4f2f22");
  const filling = channelColor(model, "filling", "#f6e9d2");
  const decorations = channelList(model, "decoration");
  const requested = channelNumber(model, "count", 6);
  const shown = Math.max(3, Math.min(9, requested <= 9 ? requested : 9));

  const rows = shown <= 3 ? 1 : shown <= 6 ? 2 : 3;
  const perRow = Math.ceil(shown / rows);

  const contentBox = boxFromEdges(32, 104, 368, 456);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Визуализация на еклери — ${requested} броя`}
    >
      <defs>
        <linearGradient id={`cbe-choux-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d3a5" />
          <stop offset="55%" stopColor="#e2bd88" />
          <stop offset="100%" stopColor="#c79d68" />
        </linearGradient>
        <linearGradient id={`cbe-glaze-${uid}`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor={shade(glaze, 30)} />
          <stop offset="52%" stopColor={glaze} />
          <stop offset="100%" stopColor={shade(glaze, -30)} />
        </linearGradient>
        <linearGradient id={`cbe-tray-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#fdf6ec" />
          <stop offset="100%" stopColor="#eddcc8" />
        </linearGradient>
        <radialGradient id={`cbe-eclair-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3a2a25" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3a2a25" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={fitTransform(contentBox)}>

      <ellipse
        cx={VIEWBOX.width / 2}
        cy={420}
        rx="168"
        ry="30"
        fill={`url(#cbe-eclair-shadow-${uid})`}
      />

      {/* Serving board */}
      <g>
        <rect
          x="42"
          y="128"
          width="316"
          height="278"
          rx="26"
          fill="#d8bb95"
        />
        <rect
          x="42"
          y="120"
          width="316"
          height="278"
          rx="26"
          fill={`url(#cbe-tray-${uid})`}
          stroke="#e3cdb0"
          strokeWidth="1.4"
        />
        <rect
          x="58"
          y="136"
          width="284"
          height="246"
          rx="18"
          fill="none"
          stroke="#e6d3ba"
          strokeWidth="1"
        />
      </g>

      <AnimatePresence initial={false}>
        {Array.from({ length: shown }).map((_, i) => {
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const inRow = Math.min(perRow, shown - row * perRow);
          const spacing = 258 / Math.max(1, inRow);
          const x = 72 + spacing * col + spacing / 2 + (seeded(i) - 0.5) * 5;
          const y = 186 + row * (rows === 1 ? 0 : 86);
          const tilt = (seeded(i * 3.7) - 0.5) * 6;

          return (
            <g key={`eclair-${i}`} transform={`translate(${x} ${y}) rotate(${tilt})`}>
              <motion.g
                initial={{ opacity: 0, y: -18, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ ...spring, delay: i * 0.045 }}
                style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
              >
                <Eclair
                  filling={filling}
                  decorations={decorations}
                  seed={i}
                  accent={glaze}
                  uid={uid}
                />
              </motion.g>
            </g>
          );
        })}
      </AnimatePresence>

      {requested > shown ? (
        <text
          x={VIEWBOX.width / 2}
          y={440}
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

function Eclair({
  filling,
  decorations,
  seed,
  accent,
  uid,
}: {
  filling: string;
  decorations: string[];
  seed: number;
  accent: string;
  uid: string;
}) {
  return (
    <g>
      {/* Shadow on the board */}
      <ellipse cx="0" cy="20" rx="62" ry="9" fill="#3a2a25" opacity="0.13" />

      {/* Choux body */}
      <rect x="-62" y="-19" width="124" height="38" rx="19" fill={`url(#cbe-choux-${uid})`} />
      <rect
        x="-62"
        y="4"
        width="124"
        height="15"
        rx="7.5"
        fill="#b98d5b"
        opacity="0.35"
      />

      {/* Cream visible at the cut end */}
      <ellipse cx="-57" cy="0" rx="7" ry="13" fill={filling} />
      <ellipse cx="-57" cy="-2" rx="4.4" ry="8" fill="#ffffff" opacity="0.25" />

      {/* Glaze */}
      <path
        d="M-58 -19 h116 a17 17 0 0 1 0 22 q-16 5 -30 -1 q-16 6 -30 0 q-15 6 -30 -1 q-14 5 -26 1 a17 17 0 0 1 0 -21 z"
        fill={`url(#cbe-glaze-${uid})`}
      />
      <ellipse cx="-16" cy="-14" rx="24" ry="4.4" fill="#ffffff" opacity="0.22" />

      {/* Decorations sitting on the glaze */}
      <AnimatePresence initial={false}>
        {decorations.slice(0, 3).map((token, i) => {
          const glyph = decorationGlyph(token, accent);
          if (!glyph) {
            // Sprinkles and other scatter tokens render as fine dust.
            if (token !== "sprinkles") return null;
            return (
              <motion.g
                key={`dust-${token}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {Array.from({ length: 9 }).map((_, j) => (
                  <rect
                    key={j}
                    x={-46 + j * 11 + seeded(seed + j) * 4}
                    y={-14 + seeded(seed * 2 + j) * 8}
                    width="4.4"
                    height="1.7"
                    rx="0.85"
                    fill={
                      ["#c8515c", "#caa779", "#a7ad94", "#f2d7d7"][j % 4]
                    }
                  />
                ))}
              </motion.g>
            );
          }

          return (
            <DecorItem
              key={token}
              x={-30 + i * 30}
              y={-12}
              scale={0.52}
              rotate={(seeded(seed + i * 5) - 0.5) * 30}
              delay={i * 0.05}
            >
              {glyph}
            </DecorItem>
          );
        })}
      </AnimatePresence>
    </g>
  );
}
