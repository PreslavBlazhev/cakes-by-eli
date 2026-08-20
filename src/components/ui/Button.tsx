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

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "transition-[transform,background-color,color,box-shadow,border-color] duration-200 " +
  "disabled:pointer-events-none disabled:opacity-55 select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-paper border border-ink shadow-[0_8px_25px_rgba(47,33,29,0.14)] " +
    "hover:bg-cocoa hover:-translate-y-0.5 active:translate-y-0",
  rose:
    "bg-rose-dark text-paper border border-rose-dark shadow-[0_8px_25px_rgba(143,78,93,0.22)] " +
    "hover:bg-rose-deep hover:-translate-y-0.5 active:translate-y-0",
  outline:
    "bg-transparent text-ink border border-ink/25 hover:border-ink/60 hover:bg-paper",
  ghost:
    "bg-paper/70 text-ink border border-line hover:bg-paper hover:border-line-strong",
  quiet:
    "bg-transparent text-ink-soft border border-transparent hover:text-ink hover:bg-blush-soft",
  danger:
    "bg-danger text-paper border border-danger hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-[0.85rem]",
  md: "min-h-12 px-5 text-[0.94rem]",
  lg: "min-h-14 px-7 text-[1rem]",
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
