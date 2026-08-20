/**
 * A running strapline, set like the spine of a menu: small caps, wide
 * tracking, hairline rules. The previous version was large display
 * italic, which competed with the headlines on either side of it.
 */
export function Marquee({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden border-y border-line bg-paper"
    >
      <div className="marquee-track flex w-max whitespace-nowrap py-3.5">
        {doubled.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center text-[0.68rem] uppercase tracking-[0.26em] text-ink-soft"
          >
            {item}
            <span aria-hidden="true" className="mx-8 text-[0.5rem] text-gold">
              ◆
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
