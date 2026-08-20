import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("wrap", className)}>{children}</div>;
}

export function Section({
  children,
  className,
  tone = "cream",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "cream" | "paper" | "ink" | "blush" | "none";
  id?: string;
}) {
  const tones: Record<string, string> = {
    cream: "bg-cream",
    paper: "bg-paper",
    ink: "bg-cocoa text-paper",
    blush: "bg-gradient-to-b from-blush to-[#f7e9df]",
    none: "",
  };
  return (
    <section
      id={id}
      className={cn("py-16 sm:py-20 lg:py-[105px]", tones[tone], className)}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Headings
 * ------------------------------------------------------------------ */

export function Eyebrow({
  children,
  className,
  plain,
}: {
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <span className={cn("eyebrow", plain && "eyebrow-plain", className)}>
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "split",
  className,
  level = 2,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "split" | "center" | "start";
  className?: string;
  level?: 1 | 2;
}) {
  const Tag = level === 1 ? "h1" : "h2";
  const displayClass = level === 1 ? "display-1" : "display-2";

  if (align === "split") {
    return (
      <div
        className={cn(
          "mb-11 grid items-end gap-8 lg:grid-cols-[1fr_0.75fr] lg:gap-12",
          className,
        )}
      >
        <div>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <Tag className={cn(displayClass, "mt-3")}>{title}</Tag>
        </div>
        {intro ? <p className="lede">{intro}</p> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-11 max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Tag className={cn(displayClass, "mt-3")}>{title}</Tag>
      {intro ? (
        <p className={cn("lede mt-4", align === "center" && "mx-auto")}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Badges & states
 * ------------------------------------------------------------------ */

export type BadgeTone =
  | "neutral"
  | "rose"
  | "gold"
  | "sage"
  | "positive"
  | "warning"
  | "danger"
  | "info"
  | "new"
  | "progress"
  | "muted";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunk text-ink-soft border-line",
  rose: "bg-blush-soft text-rose-deep border-blush",
  gold: "bg-[#f6eddd] text-[#8a6a35] border-gold-soft",
  sage: "bg-[#eaeee3] text-[#54604a] border-sage-soft",
  positive: "bg-positive-soft text-positive border-[#cfdcc6]",
  warning: "bg-warning-soft text-warning border-[#ecd9b8]",
  danger: "bg-danger-soft text-danger border-[#eecccd]",
  info: "bg-info-soft text-info border-[#cddbe5]",
  new: "bg-blush text-rose-deep border-[#e5c3c3]",
  progress: "bg-warning-soft text-warning border-[#ecd9b8]",
  muted: "bg-surface-sunk text-ink-faint border-line",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] leading-none",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <p className="display-3">{title}</p>
      {description ? (
        <p className="lede mx-auto max-w-md text-[0.95rem]">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({
  title = "Възникна грешка",
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-md)] border border-[#eecccd] bg-danger-soft px-4 py-3 text-[0.9rem] text-danger",
        className,
      )}
    >
      <p className="font-bold">{title}</p>
      <div className="mt-1 [&_p]:text-danger">{children}</div>
    </div>
  );
}

export function SuccessNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-[var(--radius-md)] border border-[#cfdcc6] bg-positive-soft px-4 py-3 text-[0.9rem] text-positive",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("hairline my-8", className)} />;
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
