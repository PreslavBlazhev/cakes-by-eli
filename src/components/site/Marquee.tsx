export function Marquee({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden border-y border-line bg-paper"
    >
      <div className="marquee-track flex w-max gap-11 whitespace-nowrap py-4 font-[family-name:var(--font-display)] text-[1.15rem] italic text-rose-dark">
        {doubled.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-11">
            {item}
            <span className="text-gold">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
