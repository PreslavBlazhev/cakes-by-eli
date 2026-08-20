"use client";

import { AnimatePresence, motion } from "motion/react";

import {
  channelColor,
  channelHas,
  channelList,
  channelText,
  channelValue,
  NAMED_COLORS,
} from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import { buildTiers, contrastInk, heartPath, seeded, shade, VIEWBOX } from "./geometry";
import type { CakeShape } from "./geometry";
import { DecorItem, decorationGlyph, Sprinkles } from "./decorations";
import {
  buildPlacement,
  isDensity,
  isPlacementMode,
  projectTop,
} from "./placement";

const layerTransition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] } as const;
const colorTransition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

const CENTRE = { cx: VIEWBOX.width / 2, cy: VIEWBOX.height / 2 };
/** Picture radius of the widest tier, leaving room for the stand and rim. */
const OUTER = 138;

/**
 * Plan view of the cake.
 *
 * The elevation can only ever show the front half; anything the customer
 * placed round the back is behind the cake itself. This is the drawing that
 * answers "so where did my blueberries actually end up" — tiers read as
 * concentric outlines and every decoration slot is visible at once, at the
 * exact angle the side view is hiding it at.
 */
export function CakeTopView({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const shape = (channelValue(model, "shape", "round") as CakeShape) || "round";
  const tierCount = Number(channelValue(model, "tiers", "1")) || 1;
  const isHeart = shape === "heart";

  const frosting = channelColor(model, "frostingColor", NAMED_COLORS.ivory);
  const style = channelValue(model, "frostingStyle", "smooth");
  const dripColor = channelColor(model, "dripColor", "#5a3524");
  const decorations = channelList(model, "decoration");
  const topper = channelValue(model, "topper", "none");
  const topperText = channelText(model, "topperText");
  const message = channelText(model, "message");

  const rawPlacement = channelValue(model, "decorPlacement", "top");
  const rawDensity = channelValue(model, "decorDensity", "medium");
  const placementMode = isPlacementMode(rawPlacement) ? rawPlacement : "top";
  const density = isDensity(rawDensity) ? rawDensity : "medium";

  const tiers = buildTiers(isHeart ? 1 : tierCount, shape);
  const widest = Math.max(...tiers.map((t) => t.width));

  const slots = buildPlacement({
    tokens: decorations,
    tierCount: tiers.length,
    mode: placementMode,
    density,
  });

  const isGanache = style === "ganache";
  const isNaked = style === "naked";
  const hasDrip = style === "drip";
  const bodyFill = isGanache ? shade(frosting, -46) : frosting;
  const ink = contrastInk(bodyFill);

  const hasTopper = topper !== "none" && topper !== "";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={buildAltText(model, tiers.length)}
    >
      <defs>
        <radialGradient id={`cbe-top-light-${uid}`} cx="0.36" cy="0.3" r="0.9">
          <stop offset="0%" stopColor={shade(bodyFill, 30)} />
          <stop offset="58%" stopColor={bodyFill} />
          <stop offset="100%" stopColor={shade(bodyFill, -24)} />
        </radialGradient>
        <radialGradient id={`cbe-top-stand-${uid}`} cx="0.4" cy="0.34" r="0.85">
          <stop offset="0%" stopColor="#e6d0a9" />
          <stop offset="70%" stopColor="#cdac7d" />
          <stop offset="100%" stopColor="#a8814f" />
        </radialGradient>
      </defs>

      {/* Stand, seen from directly above. */}
      <circle
        cx={CENTRE.cx}
        cy={CENTRE.cy}
        r={OUTER + 16}
        fill={`url(#cbe-top-stand-${uid})`}
        opacity={0.32}
      />
      <circle
        cx={CENTRE.cx}
        cy={CENTRE.cy}
        r={OUTER + 16}
        fill="none"
        stroke="#a8814f"
        strokeOpacity={0.28}
      />

      {/* Tiers, drawn outermost first so each one overlaps the one below. */}
      {tiers.map((tier, index) => {
        const radius = OUTER * (tier.width / widest);
        const isTop = index === tiers.length - 1;
        // Each ring is slightly darker than the surface above it, which is
        // what makes the stack legible without any outline clutter.
        const depth = (tiers.length - 1 - index) * 13;

        return (
          <motion.g
            key={`tier-${index}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...layerTransition, delay: index * 0.06 }}
            style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
          >
            <motion.path
              d={outlinePath(shape, CENTRE.cx, CENTRE.cy, radius)}
              animate={{
                fill: isTop
                  ? `url(#cbe-top-light-${uid})`
                  : shade(bodyFill, -depth - 8),
              }}
              transition={colorTransition}
              stroke={shade(bodyFill, -68)}
              strokeOpacity={0.55}
              strokeWidth={1.25}
            />

            {/* Each tier throws a soft shadow onto the one below it. */}
            {index < tiers.length - 1 ? (
              <path
                d={outlinePath(
                  shape,
                  CENTRE.cx + 3,
                  CENTRE.cy + 4,
                  OUTER * (tiers[index + 1].width / widest),
                )}
                fill="#241a15"
                opacity={0.2}
              />
            ) : null}

            {/* The exposed sponge of a naked cake reads as a warm ring. */}
            {isNaked ? (
              <path
                d={outlinePath(shape, CENTRE.cx, CENTRE.cy, radius * 0.93)}
                fill="none"
                stroke={shade(bodyFill, -34)}
                strokeOpacity={0.5}
                strokeDasharray="5 7"
              />
            ) : null}
          </motion.g>
        );
      })}

      {/* Drip: scallops hanging inward from the top tier's rim. */}
      <AnimatePresence>
        {hasDrip ? (
          <motion.g
            key="top-drip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={layerTransition}
          >
            {dripScallops(
              CENTRE.cx,
              CENTRE.cy,
              OUTER * (tiers[tiers.length - 1].width / widest),
            ).map((scallop, i) => (
              <circle
                key={`scallop-${i}`}
                cx={scallop.x}
                cy={scallop.y}
                r={scallop.r}
                fill={dripColor}
                opacity={0.92}
              />
            ))}
          </motion.g>
        ) : null}
      </AnimatePresence>

      {/* Sprinkles sit on the top surface. */}
      <AnimatePresence>
        {channelHas(model, "decoration", "sprinkles") ? (
          <motion.g
            key="top-sprinkles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Sprinkles
              cx={CENTRE.cx}
              cy={CENTRE.cy}
              width={OUTER * 1.5 * (tiers[tiers.length - 1].width / widest)}
              count={22}
            />
          </motion.g>
        ) : null}
      </AnimatePresence>

      {/* The message, curved onto the top surface. */}
      <AnimatePresence>
        {message ? (
          <motion.text
            key={`top-message-${message}`}
            x={CENTRE.cx}
            y={CENTRE.cy + (hasTopper ? 44 : 6)}
            textAnchor="middle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, fill: ink }}
            exit={{ opacity: 0 }}
            transition={colorTransition}
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 19,
              fontStyle: "italic",
            }}
          >
            {message}
          </motion.text>
        ) : null}
      </AnimatePresence>

      {/* Every decoration slot — including the ones the elevation hides. */}
      <AnimatePresence initial={false}>
        {slots.map((slot) => {
          const glyph = decorationGlyph(slot.token, frosting);
          if (!glyph) return null;
          const pos = projectTop(slot, tiers, CENTRE, OUTER);

          return (
            <DecorItem
              key={slot.id}
              x={pos.x}
              y={pos.y}
              scale={pos.scale * 1.08}
              // From above, items face outward from the centre.
              rotate={(slot.angle * 180) / Math.PI}
              delay={slot.order * 0.035}
            >
              {glyph}
            </DecorItem>
          );
        })}
      </AnimatePresence>

      {/* Candles, seen end-on. */}
      <AnimatePresence>
        {channelHas(model, "decoration", "candles")
          ? [0, 1, 2].map((i) => {
              const angle = (i / 3) * Math.PI * 2 + 0.5;
              const r = OUTER * (tiers[tiers.length - 1].width / widest) * 0.4;
              return (
                <motion.g
                  key={`top-candle-${i}`}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ ...layerTransition, delay: i * 0.06 }}
                  style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
                >
                  <circle
                    cx={CENTRE.cx + Math.sin(angle) * r}
                    cy={CENTRE.cy - Math.cos(angle) * r}
                    r={7}
                    fill={shade(frosting, -18)}
                    stroke={shade(frosting, -46)}
                  />
                  <circle
                    cx={CENTRE.cx + Math.sin(angle) * r}
                    cy={CENTRE.cy - Math.cos(angle) * r}
                    r={2.4}
                    fill="#e8a63c"
                  />
                </motion.g>
              );
            })
          : null}
      </AnimatePresence>

      {/* Topper, occupying the centre of the top surface. */}
      <AnimatePresence>
        {hasTopper ? (
          <motion.g
            key={`top-topper-${topper}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ ...layerTransition, delay: 0.1 }}
            style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
          >
            <circle
              cx={CENTRE.cx}
              cy={CENTRE.cy - (message ? 18 : 0)}
              r={30}
              fill={NAMED_COLORS.gold}
              opacity={0.16}
            />
            <text
              x={CENTRE.cx}
              y={CENTRE.cy - (message ? 12 : 6)}
              textAnchor="middle"
              fill={shade(NAMED_COLORS.gold, -46)}
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: topperText.length > 8 ? 16 : 24,
              }}
            >
              {topperText || "★"}
            </text>
          </motion.g>
        ) : null}
      </AnimatePresence>

      {/* Orientation marker, so the two views can be read against each other. */}
      <g opacity={0.55}>
        <path
          d={`M ${CENTRE.cx} ${CENTRE.cy + OUTER + 40} l -5 -8 l 10 0 Z`}
          fill="#98867a"
        />
        <text
          x={CENTRE.cx}
          y={CENTRE.cy + OUTER + 56}
          textAnchor="middle"
          fill="#98867a"
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Отпред
        </text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/** The silhouette of a tier as seen from directly above. */
function outlinePath(
  shape: CakeShape,
  cx: number,
  cy: number,
  radius: number,
): string {
  switch (shape) {
    case "square":
      return roundedRect(cx, cy, radius * 1.76, radius * 1.76, 10);
    case "rect":
      return roundedRect(cx, cy, radius * 2.05, radius * 1.42, 10);
    case "heart":
      // The elevation's heart outline is already a plan-shaped curve.
      return heartPath(cx, cy + radius * 0.82, radius * 1.9);
    default:
      return circlePath(cx, cy, radius);
  }
}

function circlePath(cx: number, cy: number, r: number): string {
  return [
    `M ${cx - r} ${cy}`,
    `A ${r} ${r} 0 1 0 ${cx + r} ${cy}`,
    `A ${r} ${r} 0 1 0 ${cx - r} ${cy}`,
    "Z",
  ].join(" ");
}

function roundedRect(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
): string {
  const x = cx - width / 2;
  const y = cy - height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M ${x + r} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

/** Chocolate pooling just inside the rim, as blobs of varying size. */
function dripScallops(
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const r = 7 + seeded(i * 11) * 6;
    const distance = radius - r * 0.35;
    out.push({
      x: cx + Math.sin(angle) * distance,
      y: cy - Math.cos(angle) * distance,
      r,
    });
  }
  return out;
}

function buildAltText(model: PreviewModel, tierCount: number): string {
  const labels = model.labels;
  const parts = ["Изглед отгоре"];
  if (tierCount > 1) parts.push(`${tierCount} етажа`);
  if (labels.decoration?.length) {
    parts.push(`декорация: ${labels.decoration.join(", ").toLowerCase()}`);
  }
  return parts.join(" · ");
}
