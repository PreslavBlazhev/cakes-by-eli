"use client";

import { useEffect } from "react";

/**
 * Marks the document as admin chrome so the global paper-grain overlay is
 * suppressed. The admin panel prioritises legibility over decoration.
 */
export function AdminChrome() {
  useEffect(() => {
    document.body.dataset.chrome = "admin";
    return () => {
      delete document.body.dataset.chrome;
    };
  }, []);

  return null;
}
