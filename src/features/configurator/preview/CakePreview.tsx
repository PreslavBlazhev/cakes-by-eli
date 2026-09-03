"use client";

import { AnimatePresence, motion } from "motion/react";

import {
  channelColor,
  channelDetails,
  channelHas,
  channelList,
  channelText,
  channelValue,
  NAMED_COLORS,
} from "./model";
import type { PreviewModel } from "./model";
import { useSvgIds } from "./useSvgIds";
import {
  arcPositions,
  BASELINE,
  buildTiers,
  cakeContentBox,
  contrastInk,
  dripPath,
  fitTransform,
  heartCapPath,
  heartFootPath,
  heartFootPoints,
  seeded,
  shade,
  standScale,
  tierBodyPath,
  VIEWBOX,
} from "./geometry";
import type { CakeShape, TierGeometry } from "./geometry";
import {
  buildPlacement,
  isDensity,
  isPlacementMode,
  isVisibleFromSide,
  projectSide,
  specsFrom,
} from "./placement";
import {
  Candle,
  DecorItem,
  decorationGlyph,
  Sprinkles,
} from "./decorations";

const layerTransition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] } as const;
const colorTransition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

/**
 * The signature visualiser.
 *
 * It is driven entirely by preview channels, so an option added in the admin
 * panel changes the picture with no code change here. Every layer animates
 * independently — a new tier rises into place, the frosting colour morphs, the
 * drip grows over the rim, fruit pops in one by one.
 */
export function CakePreview({ model }: { model: PreviewModel }) {
  const uid = useSvgIds();
  const shape = (channelValue(model, "shape", "round") as CakeShape) || "round";
  const tierCount = Number(channelValue(model, "tiers", "1")) || 1;

  const frosting = channelColor(model, "frostingColor", NAMED_COLORS.ivory);
  const sponge = channelColor(model, "sponge", "#e6cfa8");
  const filling = channelColor(model, "filling", "#f6e9d2");
  const style = channelValue(model, "frostingStyle", "smooth");
  const dripColor = channelColor(model, "dripColor", "#5a3524");
  const ribbon = channelValue(model, "ribbon", "none");
  const decorations = channelList(model, "decoration");
  const rawPlacement = channelValue(model, "decorPlacement", "crown");
  const rawDensity = channelValue(model, "decorDensity", "medium");
  const placementMode = isPlacementMode(rawPlacement) ? rawPlacement : "crown";
  const density = isDensity(rawDensity) ? rawDensity : "medium";
  const topper = channelValue(model, "topper", "none");
  const topperText = channelText(model, "topperText");
  const message = channelText(model, "message");

  const tiers = buildTiers(tierCount, shape);
  const slots = buildPlacement({
    specs: specsFrom({
      tokens: decorations,
      details: channelDetails(model, "decoration"),
      density,
    }),
    tiers,
    mode: placementMode,
  });
  const topTier = tiers[tiers.length - 1];
  const bottomTier = tiers[0];

  const isNaked = style === "naked";
  const hasDrip = style === "drip";
  const isGanache = style === "ganache";
  const isTextured = style === "textured";

  const bodyFill = isGanache ? shade(frosting, -46) : frosting;
  const ink = contrastInk(bodyFill);

  // How much room the drawing actually needs changes with every choice, so the
  // composition is measured and then scaled to fill the frame.
  const hasTopper = topper !== "none" && topper !== "";
  const contentBox = cakeContentBox({ tiers, shape, hasTopper });
  const tilt = standScale(shape);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={buildAltText(model)}
    >
      <defs>
        <linearGradient id={`cbe-cake-body-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={shade(bodyFill, -26)} />
          <stop offset="26%" stopColor={bodyFill} />
          <stop offset="62%" stopColor={shade(bodyFill, 14)} />
          <stop offset="100%" stopColor={shade(bodyFill, -34)} />
        </linearGradient>
        <linearGradient id={`cbe-cake-cap-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={shade(bodyFill, 26)} />
          <stop offset="100%" stopColor={shade(bodyFill, -6)} />
        </linearGradient>
        <linearGradient id={`cbe-stand-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b7935f" />
          <stop offset="34%" stopColor="#e0c79b" />
          <stop offset="72%" stopColor="#c9a877" />
          <stop offset="100%" stopColor="#a8814f" />
        </linearGradient>
        <linearGradient id={`cbe-drip-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={shade(dripColor, -18)} />
          <stop offset="45%" stopColor={dripColor} />
          <stop offset="100%" stopColor={shade(dripColor, -26)} />
        </linearGradient>
        <radialGradient id={`cbe-shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#3a2a25" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#3a2a25" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`cbe-sheen-${uid}`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform={fitTransform(contentBox)}>
      {/* Ground shadow */}
      <ellipse
        cx={VIEWBOX.width / 2}
        cy={BASELINE + 46}
        rx="128"
        ry={20 * tilt}
        fill={`url(#cbe-shadow-${uid})`}
      />

      {/* Cake stand, seen from wherever the cake is seen from */}
      <g>
        <path
          d={`M ${VIEWBOX.width / 2 - 42} ${BASELINE + 6}
              L ${VIEWBOX.width / 2 - 30} ${BASELINE + 44}
              L ${VIEWBOX.width / 2 + 30} ${BASELINE + 44}
              L ${VIEWBOX.width / 2 + 42} ${BASELINE + 6} Z`}
          fill={`url(#cbe-stand-${uid})`}
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 46}
          rx="62"
          ry={11 * tilt}
          fill="#c19a68"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 43}
          rx="62"
          ry={11 * tilt}
          fill="#e3c99e"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 6}
          rx="132"
          ry={19 * tilt}
          fill="#c8a276"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 1}
          rx="132"
          ry={19 * tilt}
          fill="#f0dcc0"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 1}
          rx="132"
          ry={19 * tilt}
          fill="none"
          stroke="#d3b28a"
          strokeWidth="1"
        />
      </g>

      {/* Cake */}
      <AnimatePresence initial={false}>
        {tiers.map((tier, index) => (
          <Tier
            key={`tier-${index}`}
            tier={tier}
            index={index}
            shape={shape}
            bodyFill={bodyFill}
            sponge={sponge}
            filling={filling}
            isNaked={isNaked}
            isTextured={isTextured}
            hasDrip={hasDrip && index === tiers.length - 1}
            ribbon={index < tiers.length - 1 ? ribbon : "none"}
            uid={uid}
          />
        ))}
      </AnimatePresence>

      {/* Message piped on the front of the largest tier */}
      <AnimatePresence>
        {message ? (
          <motion.text
            key="message"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={layerTransition}
            x={VIEWBOX.width / 2}
            y={bottomTier.top + bottomTier.height * 0.62}
            textAnchor="middle"
            fill={ink}
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: message.length > 22 ? 13 : 16,
              fontStyle: "italic",
              letterSpacing: "0.01em",
            }}
          >
            {message}
          </motion.text>
        ) : null}
      </AnimatePresence>

      {/*
        Decorations, placed across every tier.
        Slots come from the shared placement model, so what is drawn here is
        the same arrangement the plan view draws — items on the far side are
        simply hidden, because the cake body is in front of them.
      */}
      <AnimatePresence initial={false}>
        {slots.filter(isVisibleFromSide).map((slot) => {
          const glyph = decorationGlyph(slot.token, frosting);
          if (!glyph) return null;
          const pos = projectSide(slot, tiers, shape);

          return (
            <DecorItem
              key={slot.id}
              x={pos.x}
              y={pos.y - (slot.surface === "side" ? 0 : 4)}
              scale={pos.scale}
              rotate={(seeded(slot.order * 5 + 1) - 0.5) * 26}
              delay={slot.order * 0.035}
            >
              {glyph}
            </DecorItem>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {channelHas(model, "decoration", "sprinkles") ? (
          <motion.g
            key="sprinkles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Sprinkles
              cx={topTier.cx}
              cy={topTier.top + 4}
              width={topTier.width}
              count={20}
            />
          </motion.g>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {channelHas(model, "decoration", "candles")
          ? arcPositions(topTier, 3, 0.42).map((pos, i) => (
              <DecorItem
                key={`candle-${i}`}
                x={pos.x}
                y={pos.y}
                scale={0.95}
                delay={i * 0.07}
              >
                <Candle color={shade(frosting, -18)} />
              </DecorItem>
            ))
          : null}
      </AnimatePresence>

      {/* Topper */}
      <AnimatePresence>
        {topper !== "none" && topper !== "" ? (
          <motion.g
            key={`topper-${topper}`}
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ ...layerTransition, delay: 0.1 }}
          >
            <line
              x1={topTier.cx}
              y1={topTier.top - 4}
              x2={topTier.cx}
              y2={topTier.top - 30}
              stroke="#caa779"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <g transform={`translate(${topTier.cx} ${topTier.top - 46})`}>
              <rect
                x="-38"
                y="-16"
                width="76"
                height="32"
                rx="16"
                fill="#fdf4ea"
                stroke="#caa779"
                strokeWidth="1.4"
              />
              <text
                x="0"
                y="5"
                textAnchor="middle"
                fill="#8f4e5d"
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: 15,
                  fontStyle: "italic",
                }}
              >
                {topperText || (topper === "number" ? "18" : "Ели")}
              </text>
            </g>
          </motion.g>
        ) : null}
      </AnimatePresence>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function Tier({
  tier,
  index,
  shape,
  bodyFill,
  sponge,
  filling,
  isNaked,
  isTextured,
  hasDrip,
  ribbon,
  uid,
}: {
  tier: TierGeometry;
  index: number;
  shape: CakeShape;
  bodyFill: string;
  sponge: string;
  filling: string;
  isNaked: boolean;
  isTextured: boolean;
  hasDrip: boolean;
  ribbon: string;
  uid: string;
}) {
  const half = tier.width / 2;
  const isHeart = shape === "heart";

  return (
    <motion.g
      initial={{ opacity: 0, y: -26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ ...layerTransition, delay: index * 0.06 }}
    >
      {/* Anything drawn across the wall has to stop at the wall's own edge. */}
      <clipPath id={`cbe-wall-${uid}-${index}`}>
        <path d={tierBodyPath(tier, shape)} />
      </clipPath>

      {/* Sponge layers show through on naked cakes */}
      {isNaked ? (
        <>
          <path d={tierBodyPath(tier, shape)} fill={sponge} />
          {[0.3, 0.58].map((t) => (
            <rect
              key={t}
              x={tier.cx - half}
              y={tier.top + tier.height * t}
              width={tier.width}
              height={tier.height * 0.11}
              fill={filling}
              opacity="0.95"
              clipPath={`url(#cbe-wall-${uid}-${index})`}
            />
          ))}
          <motion.path
            d={tierBodyPath(tier, shape)}
            animate={{ fill: `url(#cbe-cake-body-${uid})` }}
            transition={colorTransition}
            opacity="0.42"
          />
        </>
      ) : (
        <motion.path
          d={tierBodyPath(tier, shape)}
          animate={{ d: tierBodyPath(tier, shape) }}
          transition={colorTransition}
          fill={`url(#cbe-cake-body-${uid})`}
        />
      )}

      {/* Piped texture */}
      {isTextured ? (
        <g opacity="0.24" clipPath={`url(#cbe-wall-${uid}-${index})`}>
          {Array.from({
            length: Math.max(
              3,
              Math.floor((tier.height + (isHeart ? tier.capRy : 0)) / 17),
            ),
          }).map((_, i) => {
            const y = tier.top + 12 + i * 17;
            if (y > tier.bottom - 6 + (isHeart ? tier.capRy : 0)) return null;
            return (
              <path
                key={i}
                d={`M ${tier.cx - half} ${y} q ${half / 2} 9 ${half} 0 q ${half / 2} -9 ${half} 0`}
                fill="none"
                stroke="#3a2a25"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : null}

      {/* Side sheen */}
      <path
        d={tierBodyPath(tier, shape)}
        fill={`url(#cbe-sheen-${uid})`}
        opacity="0.35"
      />

      {/* Top cap — the shape's own plan, seen from the shape's own camera */}
      {isHeart ? (
        <>
          <clipPath id={`cbe-cap-${uid}-${index}`}>
            <path d={heartCapPath(tier)} />
          </clipPath>
          <motion.path
            d={heartCapPath(tier)}
            fill={`url(#cbe-cake-cap-${uid})`}
            transition={colorTransition}
          />
          <ellipse
            cx={tier.cx - half * 0.3}
            cy={tier.top - tier.capRy * 0.34}
            rx={half * 0.42}
            ry={tier.capRy * 0.4}
            fill="#ffffff"
            opacity="0.18"
            clipPath={`url(#cbe-cap-${uid}-${index})`}
          />
          {/* Without this the top surface and the wall melt into one shape. */}
          <path
            d={heartCapPath(tier)}
            fill="none"
            stroke={shade(bodyFill, -34)}
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
        </>
      ) : (
        <>
          <motion.ellipse
            cx={tier.cx}
            cy={tier.top}
            rx={half}
            ry={tier.capRy}
            fill={`url(#cbe-cake-cap-${uid})`}
            transition={colorTransition}
          />
          <ellipse
            cx={tier.cx - half * 0.22}
            cy={tier.top - tier.capRy * 0.18}
            rx={half * 0.5}
            ry={tier.capRy * 0.44}
            fill="#ffffff"
            opacity="0.18"
          />
        </>
      )}

      {/* Drip over the rim */}
      <AnimatePresence>
        {hasDrip ? (
          <motion.path
            key="drip"
            initial={{ opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.2 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformBox: "fill-box", transformOrigin: "50% 0%" }}
            d={dripPath(tier, shape)}
            fill={`url(#cbe-drip-${uid})`}
          />
        ) : null}
      </AnimatePresence>

      {/* Accent between tiers, following the foot rather than cutting across it */}
      <AnimatePresence>
        {ribbon === "ribbon" ? (
          isHeart ? (
            <motion.path
              key="ribbon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.82 }}
              exit={{ opacity: 0 }}
              d={heartFootPath(tier, 19.5)}
              fill="none"
              stroke="#8f4e5d"
              strokeWidth="13"
            />
          ) : (
            <motion.rect
              key="ribbon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.82 }}
              exit={{ opacity: 0 }}
              x={tier.cx - half}
              y={tier.bottom - 26}
              width={tier.width}
              height="13"
              fill="#8f4e5d"
            />
          )
        ) : null}
        {ribbon === "gold-line" ? (
          isHeart ? (
            <motion.path
              key="gold-line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              d={heartFootPath(tier, 20)}
              fill="none"
              stroke="#caa779"
              strokeWidth="4"
            />
          ) : (
            <motion.rect
              key="gold-line"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              exit={{ opacity: 0 }}
              x={tier.cx - half}
              y={tier.bottom - 22}
              width={tier.width}
              height="4"
              fill="#caa779"
            />
          )
        ) : null}
        {ribbon === "pearls" ? (
          <motion.g
            key="pearls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {pearlPositions(tier, shape, 15, 18).map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#f3e6d2"
                stroke="#dcc7a8"
                strokeWidth="0.6"
              />
            ))}
          </motion.g>
        ) : null}
      </AnimatePresence>

      {/* Base piping */}
      <g>
        {pearlPositions(tier, shape, 16, 4).map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="6"
            fill="#ffffff"
            opacity="0.32"
          />
        ))}
      </g>
    </motion.g>
  );
}

/**
 * Where the beads of a pearl trim or a run of base piping sit. On a straight
 * foot that is a line of them; on a heart it is the curve of the foot itself,
 * so the trim wraps the point instead of cutting the cake in half.
 */
function pearlPositions(
  tier: TierGeometry,
  shape: CakeShape,
  spacing: number,
  inset: number,
) {
  const count = Math.floor(tier.width / spacing);

  if (shape === "heart") return heartFootPoints(tier, count, inset);

  const half = tier.width / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: tier.cx - half + spacing / 2 + i * spacing,
    y: tier.bottom - inset,
  }));
}

/* ------------------------------------------------------------------ */

function buildAltText(model: PreviewModel): string {
  const parts: string[] = ["Визуализация на торта"];
  const labels = model.labels;

  if (labels.tiers?.length) parts.push(`${labels.tiers[0]}`);
  if (labels.shape?.length) parts.push(labels.shape[0].toLowerCase());
  if (labels.frostingColor?.length)
    parts.push(`покритие в ${labels.frostingColor[0].toLowerCase()}`);
  if (labels.decoration?.length)
    parts.push(`с ${labels.decoration.join(", ").toLowerCase()}`);

  return parts.join(", ");
}
