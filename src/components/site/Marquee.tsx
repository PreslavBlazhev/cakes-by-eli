"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Container } from "@/components/ui/primitives";

/**
 * A running strapline, set like the spine of a menu: small caps, wide
 * tracking, hairline rules.
 *
 * The loop is seamless only while one copy of the list is at least as wide as
 * the band, so the number of copies is measured rather than assumed: with a
 * fixed pair, a wide screen ran out of items before the animation restarted
 * and a gap opened at the right edge. The copies are rendered, measured, and
 * repeated until they cover the band with one to spare, and the animation
 * shifts by exactly one copy's width — so the strip reads as evenly filled
 * from edge to edge at every window size.
 *
 * Pressing it holds it still, mouse or finger, long enough to read a word.
 */
/**
 * How many copies of the list must be on the track.
 *
 * The animation shifts by one copy, so at the moment it restarts the band is
 * showing everything from the end of the first copy onwards. That stretch has
 * to be wide enough to fill the band, which needs one copy for the shift plus
 * enough to cover the band — hence the `+ 1`, and never fewer than two.
 */
export function marqueeCopies(bandWidth: number, copyWidth: number): number {
  if (!(copyWidth > 0) || !(bandWidth > 0)) return 2;
  return Math.max(2, Math.ceil(bandWidth / copyWidth) + 1);
}

export function Marquee({ items }: { items: string[] }) {
  const bandRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  // Two copies is the server-rendered starting point: it is what the CSS
  // fallback of -50% assumes, so the strip animates correctly before the
  // measurement lands.
  const [copies, setCopies] = useState(2);
  const [copyWidth, setCopyWidth] = useState<number | null>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const band = bandRef.current;
    const copy = copyRef.current;
    if (!band || !copy) return;

    const measure = () => {
      const width = copy.getBoundingClientRect().width;
      const bandWidth = band.getBoundingClientRect().width;
      if (width <= 0 || bandWidth <= 0) return;

      setCopyWidth(width);
      setCopies(marqueeCopies(bandWidth, width));
    };

    measure();

    // Both the band and the copy can change: the window resizes, and the copy
    // grows when the display face finishes loading. A resize listener backs
    // the observer up, because a gap opening at the right edge is exactly the
    // failure this is here to prevent.
    const observer = new ResizeObserver(measure);
    observer.observe(band);
    observer.observe(copy);
    window.addEventListener("resize", measure);

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items]);

  if (items.length === 0) return null;

  const trackStyle = {
    animationPlayState: held ? "paused" : "running",
    ...(copyWidth === null
      ? {}
      : { "--cbe-marquee-copy": `${copyWidth}px` }),
  } as CSSProperties;

  return (
    <div className="border-y border-line bg-paper">
      {/*
        The rules run the full width of the page, but the words stay inside the
        site's column like everything else — they used to sprawl across the
        whole screen, which on a wide monitor left the strapline as the only
        element ignoring the layout. Past the soft edges the band is simply
        empty.
      */}
      <Container>
        <div
          ref={bandRef}
          aria-hidden="true"
          className="marquee-mask select-none overflow-hidden"
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onPointerCancel={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
        >
          <div
            className="marquee-track flex w-max whitespace-nowrap py-3.5"
            style={trackStyle}
          >
            {Array.from({ length: copies }, (_, copy) => (
              <div
                key={copy}
                ref={copy === 0 ? copyRef : undefined}
                className="flex"
              >
                {items.map((item, index) => (
                  <span
                    key={`${item}-${index}`}
                    className="flex items-center text-[0.68rem] uppercase tracking-[0.26em] text-ink-soft"
                  >
                    {item}
                    <span
                      aria-hidden="true"
                      className="mx-8 text-[0.5rem] text-gold"
                    >
                      ◆
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
