import Link from "next/link";
import type { ReactNode } from "react";

import { Container, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export type Crumb = { href: string; label: string };

/**
 * The masthead every interior page opens with.
 *
 * One shared composition — breadcrumb rail, label, display title, lede,
 * actions — so /menu, /gallery and /contacts read as chapters of the same
 * publication instead of three separately invented hero sections. The
 * decorative pastel blob the old headers each carried is gone: it was
 * doing nothing except announcing "template".
 */
export function PageHeader({
  label,
  title,
  intro,
  actions,
  crumbs,
  aside,
  className,
}: {
  label?: string;
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  /** Optional right-hand column — counts, filters, a note. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-cream pb-12 pt-8 lg:pb-16 lg:pt-12", className)}>
      <Container>
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Навигация по нива" className="mb-9">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] uppercase tracking-[0.18em] text-ink-faint">
              {crumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-3">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-line-strong">
                      /
                    </span>
                  ) : null}
                  {index === crumbs.length - 1 ? (
                    <span aria-current="page" className="text-ink-soft">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="link-underline transition-colors hover:text-rose-dark"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="grid gap-8 border-t border-line pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            {label ? <Label className="mb-5 block">{label}</Label> : null}
            <h1 className="display-1">{title}</h1>
          </div>

          <div className="flex flex-col justify-end gap-7 lg:pb-2">
            {intro ? <p className="lede">{intro}</p> : null}
            {actions ? (
              <div className="flex flex-wrap items-center gap-3">{actions}</div>
            ) : null}
            {aside}
          </div>
        </div>
      </Container>
    </section>
  );
}
