import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import type { Category, ProductWithMedia } from "@/server/queries/catalog";

/** Warm gradients used when a category or product has no photograph yet. */
const ACCENTS: Record<string, string> = {
  rose: "linear-gradient(135deg,#e9cec8,#c98791)",
  chocolate: "linear-gradient(135deg,#dfc0aa,#a95f53)",
  gold: "linear-gradient(135deg,#d8c6b2,#b6936d)",
  sage: "linear-gradient(135deg,#cad0bf,#8b947b)",
  blush: "linear-gradient(135deg,#f0d6cf,#d59fa4)",
};

function accentFor(accent: string): string {
  return ACCENTS[accent] ?? ACCENTS.rose;
}

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
    <Link
      href={`/menu/${category.slug}`}
      className="group flex min-h-[380px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-paper transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card)]"
    >
      <div
        className="relative h-[210px] overflow-hidden"
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
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] text-[5rem] leading-none text-paper/25 transition-transform duration-500 group-hover:scale-110"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="display-3">{category.name}</h3>
        <p className="mt-2 line-clamp-3 text-[0.9rem] text-ink-soft">
          {category.description}
        </p>
        <span className="mt-auto flex items-center gap-2 pt-5 text-[0.88rem] font-bold text-rose-dark">
          {typeof productCount === "number" && productCount > 0
            ? `Виж ${productCount} предложения`
            : "Разгледай"}
          <ArrowRight
            size={15}
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}

export function ProductCard({
  product,
  showCategory = false,
}: {
  product: ProductWithMedia;
  showCategory?: boolean;
}) {
  const image = product.images[0];
  const price = formatPrice(product.basePriceCents);
  const unavailable = product.availability === "UNAVAILABLE";

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-paper transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-card)]">
      <Link
        href={`/menu/${product.category.slug}/${product.slug}`}
        className="relative block h-[230px] overflow-hidden"
        style={image ? undefined : { background: accentFor(product.category.accent) }}
        aria-label={product.name}
      >
        {image ? (
          <Image
            src={image.path}
            alt={image.alt || product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center px-6 text-center font-[family-name:var(--font-display)] text-[1.6rem] leading-tight text-paper/70"
          >
            {product.name}
          </span>
        )}

        <span className="absolute left-4 top-4 flex flex-wrap gap-1.5">
          {product.isFeatured ? <Badge tone="gold">Избрано</Badge> : null}
          {product.availability !== "ACTIVE" ? (
            <Badge tone={unavailable ? "danger" : "sage"}>
              {AVAILABILITY_LABELS[product.availability]}
            </Badge>
          ) : null}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-6">
        {showCategory ? (
          <span className="eyebrow eyebrow-plain mb-2 text-[0.68rem]">
            {product.category.name}
          </span>
        ) : null}

        <h3 className="font-[family-name:var(--font-display)] text-[1.42rem] leading-tight tracking-[-0.025em]">
          <Link
            href={`/menu/${product.category.slug}/${product.slug}`}
            className="transition-colors hover:text-rose-dark"
          >
            {product.name}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-[0.9rem] text-ink-soft">
          {product.shortDescription}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem] text-ink-soft">
          {product.portions ? <span>{product.portions}</span> : null}
          {product.portions && price ? (
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
          ) : null}
          <span className={cn("font-bold", price ? "text-ink" : "text-ink-faint")}>
            {price ? `от ${price}` : "Цена след уточнение"}
          </span>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {unavailable ? (
            <span className="text-[0.85rem] font-semibold text-ink-faint">
              Временно не се приема поръчка
            </span>
          ) : (
            <>
              <Link
                href={`/order?product=${product.id}`}
                className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-[0.84rem] font-semibold text-paper transition-colors hover:bg-cocoa"
              >
                Поръчай този продукт
              </Link>
              {product.isCustomizable && product.dessertTypeId ? (
                <Link
                  href={`/order?mode=custom&dessert=${product.dessertTypeId}`}
                  className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[0.84rem] font-semibold transition-colors hover:border-ink"
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
