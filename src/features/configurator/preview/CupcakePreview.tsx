"use client";

import { AnimatePresence, motion } from "motion/react";

import {
  channelColor,
  channelList,
  channelNumber,
  channelText,
  channelValue,
} from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { boxFromEdges, fitTransform, seeded, shade, VIEWBOX } from "./geometry";
import { DecorItem, decorationGlyph, Sprinkles } from "./decorations";

const spring = { type: "spring", stiffness: 220, damping: 23 } as const;

export function CupcakePreview({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const frosting = channelColor(model, "frostingColor", "#f2d7d7");
  const sponge = channelColor(model, "sponge", "#e6cfa8");
  const style = channelValue(model, "frostingStyle", "swirl");
  const decorations = channelList(model, "decoration");
  const requested = channelNumber(model, "count", 6);
  const message = channelText(model, "message");

  const shown = Math.max(1, Math.min(6, requested <= 6 ? requested : 6));
  const rows = shown <= 3 ? 1 : 2;
  const perRow = Math.ceil(shown / rows);

  const contentBox = boxFromEdges(
    34,
    message ? 40 : rows === 1 ? 250 : 180,
    366,
    rows === 1 ? 436 : 472,
  );

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Визуализация на къпкейкове — ${requested} броя`}
    >
      <defs>
        <linearGradient id={`cbe-cup-frost-${uid}`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={shade(frosting, 26)} />
          <stop offset="48%" stopColor={frosting} />
          <stop offset="100%" stopColor={shade(frosting, -34)} />
        </linearGradient>
        <linearGradient id={`cbe-cup-liner-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b47f52" />
          <stop offset="24%" stopColor="#d8a877" />
          <stop offset="62%" stopColor="#c69265" />
          <stop offset="100%" stopColor="#a97246" />
        </linearGradient>
        <radialGradient id={`cbe-cup-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3a2a25" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#3a2a25" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={fitTransform(contentBox)}>

      <ellipse
        cx={VIEWBOX.width / 2}
        cy={rows === 1 ? 392 : 430}
        rx="164"
        ry="26"
        fill={`url(#cbe-cup-shadow-${uid})`}
      />

      <AnimatePresence initial={false}>
        {Array.from({ length: shown }).map((_, i) => {
          const row = Math.floor(i / perRow);
          const inRow = Math.min(perRow, shown - row * perRow);
          const col = i % perRow;
          const spacing = 300 / Math.max(1, inRow);
          const x = 50 + spacing * col + spacing / 2;
          const y = (rows === 1 ? 330 : 250) + row * 128;
          const scale = rows === 1 ? 1 : 0.78;

          return (
            <g key={`cupcake-${i}`} transform={`translate(${x} ${y}) scale(${scale})`}>
              <motion.g
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ ...spring, delay: i * 0.05 }}
                style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
              >
              <Cupcake
                sponge={sponge}
                style={style}
                decorations={decorations}
                accent={frosting}
                seed={i}
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
          y={rows === 1 ? 424 : 462}
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

      <AnimatePresence>
        {message ? (
          <motion.text
            key="cup-message"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            x={VIEWBOX.width / 2}
            y={62}
            textAnchor="middle"
            fill="#8f4e5d"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 24,
              fontStyle: "italic",
            }}
          >
            {message}
          </motion.text>
        ) : null}
      </AnimatePresence>
      </g>
    </svg>
  );
}

function Cupcake({
  sponge,
  style,
  decorations,
  accent,
  seed,
  uid,
}: {
  sponge: string;
  style: string;
  decorations: string[];
  accent: string;
  seed: number;
  uid: string;
}) {
  const swirl =
    "M-46 -6 q-6 -40 26 -48 q6 -30 34 -20 q30 -14 34 18 q26 14 18 50 z";
  const rose =
    "M-46 -6 q0 -46 46 -46 q46 0 46 46 z";
  const smooth = "M-46 -6 q0 -52 46 -52 q46 0 46 52 z";

  const shapes: Record<string, string> = { swirl, rose, smooth };

  return (
    <g>
      {/* Liner */}
      <path d="M-46 0 L-36 74 h72 L46 0 z" fill={`url(#cbe-cup-liner-${uid})`} />
      {Array.from({ length: 7 }).map((_, i) => (
        <path
          key={i}
          d={`M${-42 + i * 14} 2 L${-33 + i * 12} 72`}
          stroke="#9a6a41"
          strokeWidth="1.4"
          opacity="0.4"
        />
      ))}
      <path d="M-46 0 h92" stroke="#8f5f39" strokeWidth="3" />

      {/* Cake peeking above the liner */}
      <path d="M-45 0 q0 -16 45 -16 q45 0 45 16 z" fill={sponge} />

      {/* Frosting */}
      <motion.path
        d={shapes[style] ?? swirl}
        fill={`url(#cbe-cup-frost-${uid})`}
        transition={{ duration: 0.4 }}
      />
      {style === "swirl" ? (
        <g opacity="0.22">
          <path
            d="M-38 -14 q38 -14 76 0"
            fill="none"
            stroke="#3a2a25"
            strokeWidth="1.6"
          />
          <path
            d="M-30 -32 q30 -12 60 0"
            fill="none"
            stroke="#3a2a25"
            strokeWidth="1.5"
          />
          <path
            d="M-20 -48 q20 -10 40 0"
            fill="none"
            stroke="#3a2a25"
            strokeWidth="1.4"
          />
        </g>
      ) : null}
      {style === "rose" ? (
        <g opacity="0.24" fill="none" stroke="#3a2a25" strokeWidth="1.4">
          <circle cx="0" cy="-24" r="12" />
          <circle cx="0" cy="-24" r="22" />
          <circle cx="0" cy="-22" r="32" />
        </g>
      ) : null}
      <ellipse cx="-16" cy="-40" rx="14" ry="7" fill="#ffffff" opacity="0.28" />

      {/* Decorations */}
      <AnimatePresence initial={false}>
        {decorations.includes("sprinkles") ? (
          <motion.g
            key="cup-sprinkles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Sprinkles cx={0} cy={-30} width={70} count={11} seed={seed + 3} />
          </motion.g>
        ) : null}

        {decorations
          .filter((d) => d !== "sprinkles")
          .slice(0, 2)
          .map((token, i) => {
            const glyph =
              decorationGlyph(token, accent) ??
              (token === "fruit" ? decorationGlyph("strawberries", accent) : null);
            if (!glyph) return null;
            return (
              <DecorItem
                key={token}
                x={i === 0 ? 0 : 24}
                y={i === 0 ? -62 : -40}
                scale={0.85}
                rotate={(seeded(seed + i * 4) - 0.5) * 26}
                delay={i * 0.06}
              >
                {glyph}
              </DecorItem>
            );
          })}
      </AnimatePresence>
    </g>
  );
}
