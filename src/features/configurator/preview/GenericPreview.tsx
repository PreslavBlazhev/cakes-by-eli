"use client";

import { AnimatePresence, motion } from "motion/react";

import { channelList, channelNumber, NAMED_COLORS } from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { boxFromEdges, fitTransform, seeded, shade, VIEWBOX } from "./geometry";

const spring = { type: "spring", stiffness: 220, damping: 24 } as const;

function resolveColor(token: string, fallback: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(token)) return token;
  return NAMED_COLORS[token] ?? fallback;
}

/**
 * The elegant fallback: a boutique presentation box whose compartments fill
 * with the dessert types and colours the customer has chosen. Used by dessert
 * types without a dedicated renderer, and by the sweet-bar builder.
 */
export function GenericPreview({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const assortment = channelList(model, "assortment");
  const decorations = channelList(model, "decoration");
  const palette = channelList(model, "frostingColor").map((t) =>
    resolveColor(t, NAMED_COLORS.blush),
  );
  const colors = palette.length > 0 ? palette : [NAMED_COLORS.blush, NAMED_COLORS.cream];

  const tokens = assortment.length > 0 ? assortment : decorations.length > 0 ? decorations : ["cake"];
  const requested = channelNumber(model, "count", 0);

  const cells = buildCells(Math.max(4, Math.min(9, tokens.length * 2)));

  const contentBox = boxFromEdges(28, 100, 372, 460);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label="Визуализация на десертна композиция"
    >
      <defs>
        <linearGradient id={`cbe-box-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#fdf6ec" />
          <stop offset="100%" stopColor="#ecd9c1" />
        </linearGradient>
        <radialGradient id={`cbe-generic-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3a2a25" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3a2a25" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={fitTransform(contentBox)}>

      <ellipse
        cx={VIEWBOX.width / 2}
        cy={424}
        rx="168"
        ry="28"
        fill={`url(#cbe-generic-shadow-${uid})`}
      />

      {/* Presentation box */}
      <rect x="38" y="124" width="324" height="288" rx="26" fill="#d5b48c" />
      <rect
        x="38"
        y="112"
        width="324"
        height="288"
        rx="26"
        fill={`url(#cbe-box-${uid})`}
        stroke="#e2cdb0"
        strokeWidth="1.6"
      />
      <rect
        x="56"
        y="130"
        width="288"
        height="252"
        rx="18"
        fill="none"
        stroke="#e7d5bc"
        strokeWidth="1.1"
      />

      {/* Ribbon */}
      <rect x="38" y="232" width="324" height="16" fill="#8f4e5d" opacity="0.16" />

      <AnimatePresence initial={false}>
        {cells.map((cell, i) => {
          const token = tokens[i % tokens.length];
          const color = colors[i % colors.length];
          return (
            <g key={`cell-${i}-${token}`} transform={`translate(${cell.x} ${cell.y})`}>
              <motion.g
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ ...spring, delay: i * 0.045 }}
                style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
              >
              <circle r="40" fill="#f6e6d2" opacity="0.75" />
              <circle r="40" fill="none" stroke="#e3cdb0" strokeWidth="1" />
              <g transform={`rotate(${(seeded(i) - 0.5) * 10})`}>
                <Assortment token={token} color={color} />
              </g>
              </motion.g>
            </g>
          );
        })}
      </AnimatePresence>

      {requested > 0 ? (
        <text
          x={VIEWBOX.width / 2}
          y={444}
          textAnchor="middle"
          fill="#6f5b53"
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 17,
            fontStyle: "italic",
          }}
        >
          {`за ${requested} гости`}
        </text>
      ) : null}
      </g>
    </svg>
  );
}

function Assortment({ token, color }: { token: string; color: string }) {
  switch (token) {
    case "eclair":
      return (
        <g>
          <rect x="-27" y="-9" width="54" height="19" rx="9.5" fill="#e2bd88" />
          <rect x="-26" y="-11" width="50" height="10" rx="5" fill="#4f2f22" />
        </g>
      );
    case "cupcake":
      return (
        <g>
          <path d="M-20 0 L-15 26 h30 L20 0 z" fill="#c9946a" />
          <path d="M-20 0 q0 -24 20 -24 q20 0 20 24 z" fill={color} />
          <circle cx="0" cy="-26" r="4.6" fill="#c8515c" />
        </g>
      );
    case "macaron":
      return (
        <g>
          <ellipse cx="0" cy="-6" rx="22" ry="11" fill={color} />
          <rect x="-20" y="-1" width="40" height="6" rx="3" fill="#fdf4e6" />
          <ellipse cx="0" cy="9" rx="22" ry="11" fill={color} />
        </g>
      );
    case "cookie":
      return (
        <g>
          <circle r="24" fill="#dcb98c" />
          <circle r="19" fill={color} />
          <circle r="19" fill="none" stroke="#fffdf9" strokeWidth="2" opacity="0.7" />
        </g>
      );
    case "cakepop":
      return (
        <g>
          <rect x="-2" y="0" width="4" height="30" rx="2" fill="#f3e5d0" />
          <circle cy="-8" r="17" fill={color} />
          <circle cx="-5" cy="-13" r="4" fill="#fff" opacity="0.3" />
        </g>
      );
    case "tartlet":
      return (
        <g>
          <path d="M-24 -6 L-20 12 h40 L24 -6 z" fill="#d3a973" />
          <ellipse cx="0" cy="-6" rx="24" ry="9" fill={color} />
          <circle cx="-9" cy="-8" r="5" fill="#c8515c" />
          <circle cx="6" cy="-9" r="5" fill="#a83a56" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="-24" y="-14" width="48" height="30" rx="7" fill={color} />
          <ellipse cx="0" cy="-14" rx="24" ry="7" fill={shade(color, 24)} />
          <rect x="-24" y="4" width="48" height="4" fill="#8f4e5d" opacity="0.5" />
        </g>
      );
  }
}

function buildCells(count: number) {
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const cells: { x: number; y: number }[] = [];

  const areaX = 74;
  const areaY = 148;
  const areaW = 252;
  const areaH = 216;

  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, count - row * cols);
    const stepX = areaW / inRow;
    const stepY = areaH / rows;
    cells.push({
      x: areaX + stepX * col + stepX / 2,
      y: areaY + stepY * row + stepY / 2,
    });
  }

  return cells;
}
