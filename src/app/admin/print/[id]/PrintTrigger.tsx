"use client";

import { useEffect } from "react";

/** Opens the browser print dialog once the sheet has rendered. */
export function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
