"use client";

import { useId } from "react";

/**
 * A per-instance suffix for SVG element ids.
 *
 * Gradients, filters and clip paths are referenced by `url(#id)`, which is
 * resolved against the whole document. The configurator renders the same
 * visualiser more than once on a page (a compact preview for phones and the
 * sticky one for wide screens), so a shared id makes every reference resolve
 * to whichever copy happens to come first — and if that copy sits in a
 * `display:none` branch, every gradient-filled shape silently disappears.
 *
 * `useId` is stable across server render and hydration; the non-alphanumeric
 * characters React puts in it are stripped so the value is safe inside a URL
 * fragment.
 */
export function useSvgIds(): string {
  return useId().replace(/[^a-zA-Z0-9]/g, "");
}
