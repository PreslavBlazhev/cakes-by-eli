"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment } from "react";

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
import {
  arcPositions,
  BASELINE,
  boxFromEdges,
  buildTiers,
  contrastInk,
  dripPath,
  fitTransform,
  heartPath,
  seeded,
  shade,
  tierBodyPath,
  VIEWBOX,
} from "./geometry";
import type { CakeShape, TierGeometry } from "./geometry";
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
  const isHeart = shape === "heart";

  const frosting = channelColor(model, "frostingColor", NAMED_COLORS.ivory);
  const sponge = channelColor(model, "sponge", "#e6cfa8");
  const filling = channelColor(model, "filling", "#f6e9d2");
  const style = channelValue(model, "frostingStyle", "smooth");
  const dripColor = channelColor(model, "dripColor", "#5a3524");
  const ribbon = channelValue(model, "ribbon", "none");
  const decorations = channelList(model, "decoration");
  const topper = channelValue(model, "topper", "none");
  const topperText = channelText(model, "topperText");
  const message = channelText(model, "message");

  const tiers = buildTiers(isHeart ? 1 : tierCount, shape);
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
  const halfWidth = Math.max(
    Math.max(...tiers.map((tier) => tier.width), isHeart ? 220 : 0) / 2 + 34,
    134,
  );
  const contentBox = boxFromEdges(
    VIEWBOX.width / 2 - halfWidth,
    isHeart
      ? BASELINE - 210 * 0.86 - 26
      : topTier.top - topTier.capRy - (hasTopper ? 74 : 16),
    VIEWBOX.width / 2 + halfWidth,
    BASELINE + 70,
  );

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
        ry="20"
        fill={`url(#cbe-shadow-${uid})`}
      />

      {/* Cake stand */}
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
          ry="11"
          fill="#c19a68"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 43}
          rx="62"
          ry="11"
          fill="#e3c99e"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 6}
          rx="132"
          ry="19"
          fill="#c8a276"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 1}
          rx="132"
          ry="19"
          fill="#f0dcc0"
        />
        <ellipse
          cx={VIEWBOX.width / 2}
          cy={BASELINE + 1}
          rx="132"
          ry="19"
          fill="none"
          stroke="#d3b28a"
          strokeWidth="1"
        />
      </g>

      {/* Cake */}
      {isHeart ? (
        <HeartCake
          fill={bodyFill}
          sponge={sponge}
          isNaked={isNaked}
          decorations={decorations}
          accent={frosting}
          uid={uid}
        />
      ) : (
        <AnimatePresence initial={false}>
          {tiers.map((tier, index) => (
            <Tier
              key={`tier-${index}`}
              tier={tier}
              index={index}
              shape={shape}
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
      )}

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

      {/* Decorations on the top tier */}
      <AnimatePresence initial={false}>
        {decorations
          .filter((d) => d !== "sprinkles" && d !== "candles")
          .slice(0, 5)
          .map((token, tokenIndex, list) => {
            const perToken = list.length > 3 ? 2 : 3;
            const positions = arcPositions(topTier, perToken, 0.62);
            const glyph = decorationGlyph(token, frosting);
            if (!glyph) return null;

            return (
              <Fragment key={token}>
                {positions.map((pos, i) => (
                  <DecorItem
                    key={`${token}-${i}`}
                    x={pos.x + (tokenIndex - (list.length - 1) / 2) * 6}
                    y={pos.y - 4}
                    scale={pos.scale}
                    rotate={(seeded(tokenIndex * 5 + i) - 0.5) * 28}
                    delay={i * 0.05 + tokenIndex * 0.03}
                  >
                    {glyph}
                  </DecorItem>
                ))}
              </Fragment>
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
  sponge: string;
  filling: string;
  isNaked: boolean;
  isTextured: boolean;
  hasDrip: boolean;
  ribbon: string;
  uid: string;
}) {
  const half = tier.width / 2;

  return (
    <motion.g
      initial={{ opacity: 0, y: -26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ ...layerTransition, delay: index * 0.06 }}
    >
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
        <g opacity="0.24">
          {Array.from({
            length: Math.max(3, Math.floor(tier.height / 17)),
          }).map((_, i) => {
            const y = tier.top + 12 + i * 17;
            if (y > tier.bottom - 6) return null;
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

      {/* Top cap */}
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
            d={dripPath(tier)}
            fill={`url(#cbe-drip-${uid})`}
          />
        ) : null}
      </AnimatePresence>

      {/* Accent between tiers */}
      <AnimatePresence>
        {ribbon === "ribbon" ? (
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
        ) : null}
        {ribbon === "gold-line" ? (
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
        ) : null}
        {ribbon === "pearls" ? (
          <motion.g
            key="pearls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: Math.floor(tier.width / 15) }).map((_, i) => (
              <circle
                key={i}
                cx={tier.cx - half + 8 + i * 15}
                cy={tier.bottom - 18}
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
        {Array.from({ length: Math.floor(tier.width / 16) }).map((_, i) => (
          <circle
            key={i}
            cx={tier.cx - half + 8 + i * 16}
            cy={tier.bottom - 4}
            r="6"
            fill="#ffffff"
            opacity="0.32"
          />
        ))}
      </g>
    </motion.g>
  );
}

function HeartCake({
  fill,
  sponge,
  isNaked,
  decorations,
  accent,
  uid,
}: {
  fill: string;
  sponge: string;
  isNaked: boolean;
  decorations: string[];
  accent: string;
  uid: string;
}) {
  const cx = VIEWBOX.width / 2;
  const width = 210;
  const path = heartPath(cx, BASELINE, width);

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={layerTransition}
      style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
    >
      <path d={path} fill={isNaked ? sponge : `url(#cbe-cake-body-${uid})`} />
      <path d={path} fill={`url(#cbe-sheen-${uid})`} opacity="0.3" />
      <path
        d={path}
        fill="none"
        stroke={shade(fill, -40)}
        strokeWidth="1.2"
        opacity="0.5"
      />
      <AnimatePresence initial={false}>
        {decorations.slice(0, 3).map((token, i) => {
          const glyph = decorationGlyph(token, accent);
          if (!glyph) return null;
          return (
            <DecorItem
              key={token}
              x={cx + (i - 1) * 46}
              y={BASELINE - width * 0.52 + (i % 2) * 14}
              scale={1}
              rotate={(seeded(i * 3) - 0.5) * 24}
              delay={i * 0.06}
            >
              {glyph}
            </DecorItem>
          );
        })}
      </AnimatePresence>
    </motion.g>
  );
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
