"use client";

import { AnimatePresence, motion } from "motion/react";

import { channelColor, channelList, channelNumber } from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { boxFromEdges, fitTransform, seeded, shade, VIEWBOX } from "./geometry";

const spring = { type: "spring", stiffness: 200, damping: 20 } as const;

export function CakePopPreview({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const coating = channelColor(model, "coating", "#7a4b34");
  const accent = channelColor(model, "frostingColor", coating);
  const decorations = channelList(model, "decoration");
  const requested = channelNumber(model, "count", 10);
  const shown = Math.max(3, Math.min(7, requested <= 7 ? requested : 7));

  const surface = coating === "#e3aeb6" ? accent : coating;

  const contentBox = boxFromEdges(58, 216, 342, 462);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={`Визуализация на кейк попс — ${requested} броя`}
    >
      <defs>
        <radialGradient id={`cbe-pop-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3a2a25" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3a2a25" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cbe-pop-holder-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c19a68" />
          <stop offset="35%" stopColor="#e9d0aa" />
          <stop offset="100%" stopColor="#b28954" />
        </linearGradient>
        <radialGradient id={`cbe-pop-body-${uid}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0%" stopColor={shade(surface, 44)} />
          <stop offset="55%" stopColor={surface} />
          <stop offset="100%" stopColor={shade(surface, -40)} />
        </radialGradient>
      </defs>

      <g transform={fitTransform(contentBox)}>

      <ellipse
        cx={VIEWBOX.width / 2}
        cy={430}
        rx="140"
        ry="24"
        fill={`url(#cbe-pop-shadow-${uid})`}
      />

      {/* Holder block */}
      <rect x="96" y="356" width="208" height="62" rx="16" fill="#b28954" />
      <rect x="96" y="348" width="208" height="62" rx="16" fill={`url(#cbe-pop-holder-${uid})`} />

      <AnimatePresence initial={false}>
        {Array.from({ length: shown }).map((_, i) => {
          const t = shown === 1 ? 0 : (i / (shown - 1)) * 2 - 1;
          const x = VIEWBOX.width / 2 + t * 86;
          const lift = 30 + (1 - Math.abs(t)) * 26;
          const headY = 348 - lift - 34;

          return (
            <motion.g
              key={`pop-${i}`}
              initial={{ opacity: 0, y: 24, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.7 }}
              transition={{ ...spring, delay: i * 0.05 }}
              style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
            >
              <rect
                x={x - 2.4}
                y={headY + 26}
                width="4.8"
                height={lift + 44}
                rx="2.4"
                fill="#f3e5d0"
                stroke="#dcc7a8"
                strokeWidth="0.7"
              />
              <circle cx={x} cy={headY} r="30" fill={`url(#cbe-pop-body-${uid})`} />
              <ellipse
                cx={x - 9}
                cy={headY - 11}
                rx="10"
                ry="6"
                fill="#ffffff"
                opacity="0.3"
              />

              {decorations.includes("drizzle") ? (
                <g stroke={shade(surface, 62)} strokeWidth="2.4" fill="none" strokeLinecap="round">
                  <path d={`M${x - 22} ${headY - 12} q 10 10 22 4 q 12 -6 22 4`} />
                  <path d={`M${x - 20} ${headY + 4} q 10 10 20 4 q 12 -6 20 3`} />
                </g>
              ) : null}

              {decorations.includes("sprinkles") ? (
                <g>
                  {Array.from({ length: 8 }).map((_, j) => {
                    const angle = seeded(i * 7 + j) * Math.PI * 2;
                    const radius = 8 + seeded(i * 3 + j) * 16;
                    const px = x + Math.cos(angle) * radius;
                    const py = headY + Math.sin(angle) * radius;
                    return (
                      <rect
                        key={j}
                        x={px}
                        y={py}
                        width="4.6"
                        height="1.8"
                        rx="0.9"
                        fill={["#c8515c", "#caa779", "#a7ad94", "#fdf4ea"][j % 4]}
                        transform={`rotate(${seeded(j + i) * 180} ${px} ${py})`}
                      />
                    );
                  })}
                </g>
              ) : null}

              {decorations.includes("gold") ? (
                <path
                  d={`M${x + 12} ${headY - 18} l7 -4 l-2 8 l6 -3 l-6 10 l-7 2 l3 -7 z`}
                  fill="#caa779"
                />
              ) : null}

              {decorations.includes("pearls") ? (
                <g>
                  {[[-14, 8], [10, 12], [-4, 18]].map(([dx, dy], j) => (
                    <circle
                      key={j}
                      cx={x + dx}
                      cy={headY + dy}
                      r="3.2"
                      fill="#f3e6d2"
                    />
                  ))}
                </g>
              ) : null}
            </motion.g>
          );
        })}
      </AnimatePresence>

      {requested > shown ? (
        <text
          x={VIEWBOX.width / 2}
          y={452}
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
