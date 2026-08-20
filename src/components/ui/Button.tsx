import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "rose"
  | "ghost"
  | "outline"
  | "quiet"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

/**
 * Near-square, letterspaced, no drop shadow.
 *
 * Rounded pills with coloured glows underneath are the single loudest
 * signal of a templated page. A 3px edge and a flat fill read as print,
 * which is the register the rest of the site is written in.
 */
const base =
  "inline-flex items-center justify-center gap-2.5 rounded-[3px] font-semibold " +
  "tracking-[0.02em] transition-[background-color,color,border-color,opacity] duration-200 " +
  "disabled:pointer-events-none disabled:opacity-50 select-none text-center";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper border border-ink hover:bg-cocoa-deep",
  rose: "bg-rose-dark text-paper border border-rose-dark hover:bg-rose-deep",
  outline:
    "bg-transparent text-ink border border-ink/30 hover:border-ink hover:bg-ink hover:text-paper",
  ghost:
    "bg-paper text-ink border border-line hover:border-line-strong hover:bg-surface-sunk",
  quiet:
    "bg-transparent text-ink-soft border border-transparent hover:text-rose-dark",
  danger: "bg-danger text-paper border border-danger hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-[0.8rem]",
  md: "min-h-12 px-6 text-[0.86rem]",
  lg: "min-h-14 px-8 text-[0.92rem]",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  fullWidth,
  ...props
}: CommonProps & ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  fullWidth,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
    />
  );
}

/** External links get the safe rel/target pairing in one place. */
export function ExternalButtonLink({
  variant = "primary",
  size = "md",
  className,
  fullWidth,
  ...props
}: CommonProps & ComponentProps<"a">) {
  return (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
    />
  );
}
