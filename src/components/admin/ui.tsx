import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/primitives";
import type { BadgeTone } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "@/lib/labels";
import type { OrderStatus } from "@/lib/labels";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {breadcrumb ? (
        <Link
          href={breadcrumb.href}
          className="mb-2 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-ink-soft transition-colors hover:text-rose-dark"
        >
          ← {breadcrumb.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[1.85rem] leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-[0.9rem] text-ink-soft">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-md)] border border-line bg-paper",
        className,
      )}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title ? (
              <h2 className="text-[1.02rem] font-bold leading-snug">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[0.82rem] text-ink-soft">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? "px-5 py-5" : undefined}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: BadgeTone;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line",
    new: "border-blush bg-blush-soft",
    progress: "border-[#ecd9b8] bg-warning-soft",
    positive: "border-[#cfdcc6] bg-positive-soft",
    danger: "border-[#eecccd] bg-danger-soft",
    info: "border-[#cddbe5] bg-info-soft",
    rose: "border-blush bg-blush-soft",
    gold: "border-gold-soft",
    sage: "border-sage-soft",
    warning: "border-[#ecd9b8] bg-warning-soft",
    muted: "border-line",
  };

  const content = (
    <>
      <p className="text-[0.76rem] font-extrabold uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1.5 font-[family-name:var(--font-display)] text-[2rem] leading-none tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[0.78rem] text-ink-soft">{hint}</p>
      ) : null}
    </>
  );

  const className = cn(
    "block rounded-[var(--radius-md)] border bg-paper px-4 py-4 transition-shadow",
    tones[tone] ?? tones.neutral,
    href && "hover:shadow-[var(--shadow-soft)]",
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>
  );
}

export function DataTable({
  head,
  children,
  empty,
}: {
  head: ReactNode;
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-ink-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-3 py-3 align-top text-[0.88rem]", className)}>
      {children}
    </td>
  );
}

export function DefinitionList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-[0.82rem] text-ink-faint">{item.label}</dt>
          <dd className="text-right text-[0.9rem] font-semibold">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-[1.02rem] font-bold">{title}</p>
      {description ? (
        <p className="max-w-md text-[0.86rem] text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 rounded-[var(--radius-sm)] border border-warning/30 bg-warning-soft px-4 py-3 text-[0.84rem] text-warning">
      {children}
    </div>
  );
}
