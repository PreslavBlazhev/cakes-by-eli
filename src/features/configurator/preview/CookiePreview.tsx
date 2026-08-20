"use client";

import { AnimatePresence, motion } from "motion/react";

import { channelList, channelNumber, channelText, channelValue, NAMED_COLORS } from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { boxFromEdges, fitTransform, seeded, shade, VIEWBOX } from "./geometry";

const spring = { type: "spring", stiffness: 220, damping: 24 } as const;

function resolveColor(token: string, fallback: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(token)) return token;
  return NAMED_COLORS[token] ?? fallback;
}

const SHAPES: Record<string, (r: number) => string> = {
  round: (r) => `M0 ${-r} A ${r} ${r} 0 1 1 -0.01 ${-r} Z`,
  square: (r) =>
    `M${-r * 0.86} ${-r * 0.86} h${r * 1.72} a8 8 0 0 1 8 8 v${r * 1.56} a8 8 0 0 1 -8 8 h${-r * 1.72} a8 8 0 0 1 -8 -8 v${-r * 1.56} a8 8 0 0 1 8 -8 z`,
  heart: (r) =>
    `M0 ${r * 0.9} C ${-r * 1.4} ${-r * 0.1} ${-r * 0.9} ${-r * 1.2} 0 ${-r * 0.45} C ${r * 0.9} ${-r * 1.2} ${r * 1.4} ${-r * 0.1} 0 ${r * 0.9} Z`,
  star: (r) =>
    Array.from({ length: 10 })
      .map((_, i) => {
        const radius = i % 2 === 0 ? r : r * 0.46;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ") + " Z",
};

export function CookiePreview({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const shape = channelValue(model, "shape", "round");
  const palette = channelList(model, "icingColors").map((t) =>
    resolveColor(t, NAMED_COLORS.blush),
  );
  const colors = palette.length > 0 ? palette : [NAMED_COLORS.blush];
  const requested = channelNumber(model, "count", 6);
  const message = channelText(model, "message");
  const shown = Math.max(3, Math.min(6, requested <= 6 ? requested : 6));

  const shapeFn = SHAPES[shape] ?? SHAPES.round;
  const rows = shown <= 3 ? 1 : 2;
  const perRow = Math.ceil(shown / rows);

  const contentBox = boxFromEdges(
    38,
    rows === 1 ? 176 : 132,
    362,
    rows === 1 ? 444 : 480,
  );

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Визуализация на декорирани бисквити — ${requested} броя`}
    >
      <defs>
        <radialGradient id={`cbe-cookie-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3a2a25" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#3a2a25" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={fitTransform(contentBox)}>

      <ellipse
        cx={VIEWBOX.width / 2}
        cy={rows === 1 ? 356 : 428}
        rx="158"
        ry="24"
        fill={`url(#cbe-cookie-shadow-${uid})`}
      />

      <AnimatePresence initial={false}>
        {Array.from({ length: shown }).map((_, i) => {
          const row = Math.floor(i / perRow);
          const inRow = Math.min(perRow, shown - row * perRow);
          const col = i % perRow;
          const spacing = 292 / Math.max(1, inRow);
          const x = 54 + spacing * col + spacing / 2;
          const y = (rows === 1 ? 260 : 208) + row * 136;
          const color = colors[i % colors.length];

          return (
            <g key={`cookie-${i}`} transform={`translate(${x} ${y})`}>
              <motion.g
                initial={{ opacity: 0, scale: 0.6, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: (seeded(i) - 0.5) * 14 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ ...spring, delay: i * 0.05 }}
                style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
              >
              {/* Baked base peeking out from under the icing */}
              <path d={shapeFn(56)} fill="#d3a973" transform="translate(0 4)" />
              <path d={shapeFn(56)} fill="#e0b985" />
              <motion.path
                d={shapeFn(48)}
                fill={color}
                transition={{ duration: 0.35 }}
              />
              <path
                d={shapeFn(48)}
                fill="none"
                stroke="#fffdf9"
                strokeWidth="2.4"
                opacity="0.7"
              />
              <path
                d={shapeFn(34)}
                fill="none"
                stroke={shade(color, -46)}
                strokeWidth="1.4"
                opacity="0.35"
                strokeDasharray="5 6"
              />
              <ellipse
                cx="-16"
                cy="-20"
                rx="16"
                ry="8"
                fill="#ffffff"
                opacity="0.25"
              />
              </motion.g>
            </g>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {message ? (
          <motion.text
            key="cookie-msg"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            x={VIEWBOX.width / 2}
            y={rows === 1 ? 400 : 466}
            textAnchor="middle"
            fill="#8f4e5d"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 22,
              fontStyle: "italic",
            }}
          >
            {message}
          </motion.text>
        ) : null}
      </AnimatePresence>

      {requested > shown ? (
        <text
          x={VIEWBOX.width / 2}
          y={rows === 1 ? 430 : 60}
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
