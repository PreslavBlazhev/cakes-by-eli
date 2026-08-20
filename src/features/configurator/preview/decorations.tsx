"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { seeded, shade } from "./geometry";

/**
 * The decoration vocabulary shared by every renderer.
 *
 * Each item is a small, self-contained vector drawn around the origin so the
 * callers only have to decide where to place it and at what scale.
 */

const spring = { type: "spring", stiffness: 260, damping: 22 } as const;

/**
 * Places one decoration and animates it in.
 *
 * Placement lives on a plain outer `<g>` and the animation on an inner
 * `motion.g`. They must not share an element: Motion writes `style.transform`,
 * and a CSS transform overrides the SVG `transform` attribute entirely — the
 * item would lose its position and snap to the top-left corner the moment it
 * animated.
 */
export function DecorItem({
  x,
  y,
  scale = 1,
  rotate = 0,
  delay = 0,
  children,
}: {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <motion.g
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.2 }}
        transition={{ ...spring, delay }}
        style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
      >
        {children}
      </motion.g>
    </g>
  );
}

export function Strawberry() {
  return (
    <g>
      <path
        d="M0 -9 C 9 -9 13 -2 12 5 C 11 13 5 19 0 21 C -5 19 -11 13 -12 5 C -13 -2 -9 -9 0 -9 Z"
        fill="#c8515c"
      />
      <path
        d="M0 -9 C 9 -9 13 -2 12 5 C 8 2 3 0 0 0 C -3 0 -8 2 -12 5 C -13 -2 -9 -9 0 -9 Z"
        fill="#d9727c"
      />
      <path
        d="M-9 -9 L-2 -12 L0 -18 L2 -12 L9 -9 L2 -6 L0 -4 L-2 -6 Z"
        fill="#7d9463"
      />
      {[
        [-5, 2],
        [4, 1],
        [0, 8],
        [-3, 12],
        [5, 9],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="1.1" fill="#f6e2c8" opacity="0.85" />
      ))}
    </g>
  );
}

export function Raspberry() {
  return (
    <g>
      {[
        [0, -5],
        [-5, -1],
        [5, -1],
        [-3, 4],
        [3, 4],
        [0, 8],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="3.6" fill="#a83a56" />
      ))}
      {[
        [-1, -6],
        [-6, -2],
        [4, -2],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="1.2" fill="#d1728a" opacity="0.7" />
      ))}
    </g>
  );
}

export function Blueberry() {
  return (
    <g>
      <circle r="6.4" fill="#4a4a72" />
      <circle r="6.4" fill="#5b5b86" opacity="0.6" />
      <path
        d="M-2.4 -1.6 l2.4 -2 l2.4 2 l-1 2.6 h-2.8 z"
        fill="#3a3a5c"
        opacity="0.8"
      />
      <ellipse cx="-2" cy="-3" rx="2" ry="1.4" fill="#9a9ac0" opacity="0.5" />
    </g>
  );
}

export function MacaronBite({ color = "#e3aeb6" }: { color?: string }) {
  return (
    <g>
      <ellipse cx="0" cy="-4" rx="9" ry="4.6" fill={color} />
      <rect x="-8" y="-1.6" width="16" height="3.4" rx="1.7" fill="#fdf4e6" />
      <ellipse cx="0" cy="4" rx="9" ry="4.6" fill={color} />
      <ellipse cx="-2.5" cy="-5.5" rx="4" ry="1.8" fill="#fff" opacity="0.35" />
    </g>
  );
}

export function ChocolateShard({ color = "#5a3524" }: { color?: string }) {
  return (
    <g>
      <path d="M-6 10 L-3 -12 L7 -8 L4 12 Z" fill={color} />
      <path d="M-3 -12 L7 -8 L5 -5 L-2 -8 Z" fill={shade(color, 34)} />
    </g>
  );
}

export function SugarFlower({ color = "#fdf4ea" }: { color?: string }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <g>
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy="-6.6"
          rx="4.4"
          ry="7"
          fill={color}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r="3.2" fill="#caa779" />
      <circle r="1.4" fill="#a8834f" />
    </g>
  );
}

export function Leaf() {
  return (
    <path
      d="M0 0 C 10 -3 18 -1 22 4 C 15 9 5 8 0 0 Z"
      fill="#a7ad94"
    />
  );
}

/** A sugar pearl needs an edge: unrimmed cream on cream frosting is invisible. */
export function Pearl({ color = "#f3e6d2" }: { color?: string }) {
  return (
    <g>
      <circle r="4" fill={color} stroke="#b8a084" strokeWidth="0.7" />
      <circle cx="-1.1" cy="-1.1" r="1.1" fill="#fff" opacity="0.75" />
    </g>
  );
}

export function GoldLeaf() {
  return (
    <g>
      <path d="M0 0 l9 -5 l-2 10 l8 -4 l-7 12 l-9 2 l3 -8 z" fill="#caa779" />
      <path d="M0 0 l9 -5 l-2 10 l-4 -2 z" fill="#e0c294" />
    </g>
  );
}

export function Candle({ color = "#f2d7d7" }: { color?: string }) {
  return (
    <g>
      <rect x="-2" y="-22" width="4" height="24" rx="2" fill={color} />
      <rect x="-2" y="-22" width="1.6" height="24" fill="#fff" opacity="0.4" />
      <path
        d="M0 -32 C 3.4 -28 3.4 -24 0 -23 C -3.4 -24 -3.4 -28 0 -32 Z"
        fill="#e8b45c"
      />
      <path
        d="M0 -29.5 C 1.6 -27.4 1.6 -25.2 0 -24.6 C -1.6 -25.2 -1.6 -27.4 0 -29.5 Z"
        fill="#fdf0c8"
      />
    </g>
  );
}

/** Scatter of sprinkles across a tier's top surface. */
export function Sprinkles({
  cx,
  cy,
  width,
  count = 22,
  seed = 7,
}: {
  cx: number;
  cy: number;
  width: number;
  count?: number;
  seed?: number;
}) {
  const colors = ["#c8515c", "#caa779", "#a7ad94", "#8f4e5d", "#f2d7d7"];

  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = seeded(seed + i * 3.1);
        const r2 = seeded(seed + i * 7.7);
        const r3 = seeded(seed + i * 11.3);
        const x = cx + (r1 - 0.5) * width * 0.86;
        const y = cy + (r2 - 0.5) * 16;
        return (
          <g key={i} transform={`rotate(${r3 * 180 - 90} ${x + 2.6} ${y + 1})`}>
            <motion.rect
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.95 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.012, duration: 0.28 }}
              x={x}
              y={y}
              width="5.2"
              height="2"
              rx="1"
              fill={colors[i % colors.length]}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Maps a decoration token to its vector, so renderers stay declarative. */
export function decorationGlyph(
  token: string,
  accent: string,
): ReactNode | null {
  switch (token) {
    case "strawberries":
      return <Strawberry />;
    case "raspberries":
    case "raspberry":
      return <Raspberry />;
    case "blueberries":
      return <Blueberry />;
    case "macarons":
      return <MacaronBite color={accent} />;
    case "chocolate":
      return <ChocolateShard />;
    case "flowers":
      return <SugarFlower />;
    case "pearls":
      return <Pearl />;
    case "gold":
      return <GoldLeaf />;
    case "nuts":
      return <ChocolateShard color="#b08a5c" />;
    case "pistachio":
      return <ChocolateShard color="#9db977" />;
    default:
      return null;
  }
}
