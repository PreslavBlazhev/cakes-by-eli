"use client";

import type { ConfigState } from "@/features/configurator/types";

/**
 * Lightweight local draft so an accidental reload does not throw away a
 * carefully configured cake.
 *
 * Only non-sensitive choices are kept — never the phone number, e-mail or
 * anything that would be unpleasant to find left behind on a shared computer.
 */

const KEY = "cbe:order-draft:v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export type OrderDraft = {
  savedAt: number;
  mode: "catalog" | "custom" | null;
  productId: string | null;
  dessertTypeId: string | null;
  configState: ConfigState;
  quantity: number;
  fulfillmentDate: string;
  occasion: string;
  notes: string;
};

export function loadDraft(): OrderDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as OrderDraft;
    if (
      typeof parsed?.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<OrderDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch {
    // Private browsing or a full quota — the draft is a convenience, not a
    // requirement, so failing to save it must stay silent.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
