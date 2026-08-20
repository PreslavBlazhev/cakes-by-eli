"use client";

import { useEffect, useState } from "react";

import { CakePreview } from "@/features/configurator/preview/CakePreview";
import type { PreviewModel } from "@/features/configurator/preview/model";

/**
 * The hero uses the very same visualiser as the custom builder, cycling
 * slowly through a few tasteful presets. It is an honest advertisement for
 * the feature: what the visitor sees moving here is exactly what they will be
 * able to drive themselves on the order page.
 */
const PRESETS: PreviewModel[] = [
  {
    renderer: "cake",
    channels: {
      shape: ["round"],
      tiers: ["2"],
      frostingColor: ["#f7e7d3"],
      frostingStyle: ["smooth"],
      sponge: ["#f2e2c4"],
      decoration: ["strawberries", "gold"],
      ribbon: ["gold-line"],
    },
    labels: {},
    text: {},
    numbers: {},
  },
  {
    renderer: "cake",
    channels: {
      shape: ["round"],
      tiers: ["3"],
      frostingColor: ["#f2d7d7"],
      frostingStyle: ["textured"],
      sponge: ["#9d4148"],
      decoration: ["flowers", "pearls"],
      ribbon: ["pearls"],
    },
    labels: {},
    text: {},
    numbers: {},
  },
  {
    renderer: "cake",
    channels: {
      shape: ["round"],
      tiers: ["2"],
      frostingColor: ["#fdf6ec"],
      frostingStyle: ["drip"],
      dripColor: ["#5a3524"],
      sponge: ["#6b4430"],
      decoration: ["raspberries", "chocolate"],
      ribbon: ["none"],
    },
    labels: {},
    text: {},
    numbers: {},
  },
];

export function HeroScene() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % PRESETS.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* Arch backdrop, carried over from the reference design */}
      <div
        aria-hidden="true"
        className="absolute inset-x-6 top-2 bottom-10 rounded-t-[240px] rounded-b-[28px] bg-[linear-gradient(160deg,#ead3ce_0%,#e3b9b8_47%,#d89ea7_100%)] shadow-[var(--shadow-card)]"
      >
        <span className="absolute -right-16 -top-14 size-64 rounded-full bg-[#f7e9dc] opacity-80" />
        <span className="absolute bottom-6 left-6 size-24 rounded-full border border-white/55" />
      </div>

      <div className="relative aspect-square w-full">
        <CakePreview model={PRESETS[index]} />
      </div>

      <div className="absolute left-0 top-16 -rotate-[4deg] rounded-[var(--radius-sm)] border border-white/70 bg-paper/95 px-4 py-3 shadow-[0_18px_40px_rgba(69,43,35,0.16)] backdrop-blur">
        <span className="block text-[0.72rem] text-ink-soft">Изработка</span>
        <strong className="font-[family-name:var(--font-display)] text-[1.1rem] font-medium">
          специално за вас
        </strong>
      </div>

      <div className="absolute -right-1 bottom-6 rotate-[3deg] rounded-[var(--radius-sm)] border border-white/70 bg-paper/95 px-4 py-3 shadow-[0_18px_40px_rgba(69,43,35,0.16)] backdrop-blur">
        <span className="block text-[0.72rem] text-ink-soft">Вкус + визия</span>
        <strong className="font-[family-name:var(--font-display)] text-[1.1rem] font-medium">
          в един десерт
        </strong>
      </div>
    </div>
  );
}
