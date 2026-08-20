"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/cn";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the value stays selectable on screen.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-[0.8rem] font-semibold transition-colors hover:border-ink",
        className,
      )}
    >
      {copied ? (
        <Check size={13} aria-hidden="true" className="text-positive" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
      {copied ? "Копирано" : label}
    </button>
  );
}
