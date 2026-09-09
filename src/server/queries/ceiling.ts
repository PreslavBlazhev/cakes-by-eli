/**
 * Safety ceilings for the lists that grow with the catalogue.
 *
 * Not pagination: at a few dozen products and photos these are unreachable, and
 * adding page controls to the admin panel would change how the owner works for
 * no benefit today. They exist so an unbounded `SELECT` can never become one —
 * and when a ceiling is ever reached it says so in the log rather than quietly
 * dropping rows.
 */

export const MAX_PRODUCT_ROWS = 1_000;
export const MAX_GALLERY_ROWS = 1_000;
/** The reuse picker shows the newest photos; 500 is far past what fits on screen. */
export const MAX_LIBRARY_ROWS = 500;

/** Logs once when a query came back at its ceiling, so silence means correct. */
export function warnIfTruncated(
  query: string,
  rows: readonly unknown[],
  ceiling: number,
): void {
  if (rows.length < ceiling) return;
  console.warn(JSON.stringify({ tag: "QUERY_CEILING_REACHED", query, ceiling }));
}
