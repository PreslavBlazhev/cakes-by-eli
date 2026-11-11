import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import type { Category, ProductWithMedia } from "@/server/queries/catalog";

/**
 * Catalogue tiles.
 *
 * Neither of these is a "card" any more: there is no border, no fill and
 * no shadow. The photograph is the object, the type sits on the ivory
 * ground beneath it, and a hairline does the separating. Repeating an
 * identical bordered rectangle is what made the previous catalogue read
 * as a template rather than as a patisserie's own book of work.
 */

/** Warm washes used when a category or product has no photograph yet. */
const ACCENTS: Record<string, string> = {
  rose: "linear-gradient(150deg,#e5cdc9,#b57f88)",
  chocolate: "linear-gradient(150deg,#dcc2ad,#9c5f52)",
  gold: "linear-gradient(150deg,#dccbb2,#ab8a63)",
  sage: "linear-gradient(150deg,#ccd1c1,#828a72)",
  blush: "linear-gradient(150deg,#eed8d1,#cb9aa0)",
};

function accentFor(accent: string): string {
  return ACCENTS[accent] ?? ACCENTS.rose;
}

/**
 * One crop for grid tiles.
 *
 * Cycling ratios inside a uniform grid leaves every row with a ragged
 * baseline, which reads as a bug rather than as an editorial choice. The
 * variety lives in the layouts instead — the asymmetric split on the home
 * page, the category band, the masonry gallery — and any caller that
 * genuinely wants a different crop passes `ratio`.
 */
const TILE_RATIO = "aspect-[4/5]";

export function CategoryCard({
  category,
  productCount,
  index = 0,
}: {
  category: Category;
  productCount?: number;
  index?: number;
}) {
  return (
    <Link href={`/menu/${category.slug}`} className="group block">
      <div
        className={cn("frame", TILE_RATIO)}
        style={
          category.imagePath ? undefined : { background: accentFor(category.accent) }
        }
      >
        {category.imagePath ? (
          <Image
            src={category.imagePath}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.045]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="numeral absolute inset-0 flex items-center justify-center text-[4.5rem] text-paper/30"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-3 border-t border-line pt-4">
        <span aria-hidden="true" className="numeral text-[0.72rem] text-ink-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="display-4 transition-colors group-hover:text-rose-dark">
            {category.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[0.85rem] leading-relaxed text-ink-soft">
            {category.description}
          </p>
        </div>
        {typeof productCount === "number" && productCount > 0 ? (
          <span className="numeral flex-none text-[0.72rem] text-ink-faint">
            {productCount}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function ProductCard({
  product,
  showCategory = false,
  ratio,
}: {
  product: ProductWithMedia;
  showCategory?: boolean;
  /** Overrides the default crop when a layout wants a different one. */
  ratio?: string;
}) {
  const image = product.images[0];
  const price = formatPrice(product.basePriceCents);
  const unavailable = product.availability === "UNAVAILABLE";
  const href = `/menu/${product.category.slug}/${product.slug}`;

  return (
    <article className="group flex flex-col">
      {/* Decorative duplicate of the title link: kept out of the tab order
          and the accessibility tree so each product is announced once. */}
      <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
        <div
          className={cn("frame", ratio ?? TILE_RATIO)}
          style={
            image ? undefined : { background: accentFor(product.category.accent) }
          }
        >
          {image ? (
            <Image
              src={image.path}
              alt={image.alt || product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.045]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center px-6 text-center font-[family-name:var(--font-display)] text-[1.5rem] leading-tight text-paper/75"
            >
              {product.name}
            </span>
          )}

          {product.isFeatured || product.availability !== "ACTIVE" ? (
            <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {product.isFeatured ? <Badge tone="gold">Избрано</Badge> : null}
              {product.availability !== "ACTIVE" ? (
                <Badge tone={unavailable ? "danger" : "sage"}>
                  {AVAILABILITY_LABELS[product.availability]}
                </Badge>
              ) : null}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="mt-5 flex flex-1 flex-col border-t border-line pt-4">
        {showCategory ? (
          <span className="label label-muted mb-2 text-[0.62rem]">
            {product.category.name}
          </span>
        ) : null}

        <h3 className="display-4">
          <Link
            href={href}
            className="link-underline transition-colors group-hover:text-rose-dark"
          >
            {product.name}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-[0.86rem] leading-relaxed text-ink-soft">
          {product.shortDescription}
        </p>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.8rem]">
          <span
            className={cn(
              "numeral font-bold",
              price ? "text-ink" : "text-ink-faint",
            )}
          >
            {price ?? "Цена след уточнение"}
          </span>
          {product.portions ? (
            <span className="text-ink-faint">{product.portions}</span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[0.76rem] uppercase tracking-[0.16em]">
          {unavailable ? (
            <span className="font-semibold text-ink-faint">
              Не се приема поръчка
            </span>
          ) : (
            <>
              <Link
                href={`/order?product=${product.id}`}
                className="link-underline font-bold text-rose-dark"
              >
                Поръчай
              </Link>
              {product.isCustomizable && product.dessertTypeId ? (
                <Link
                  href={`/order?mode=custom&dessert=${product.dessertTypeId}`}
                  className="link-underline font-semibold text-ink-soft"
                >
                  Персонализирай
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
