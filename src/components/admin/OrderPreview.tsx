"use client";

import { useMemo } from "react";

import { DessertPreview } from "@/features/configurator/preview/DessertPreview";
import { buildPreviewModel } from "@/features/configurator/preview/model";
import type { ConfigState, DessertTypeConfig } from "@/features/configurator/types";

/**
 * Replays the customer's configuration in the admin panel using the very same
 * renderer they saw while ordering, so what the owner looks at and what the
 * customer designed cannot drift apart.
 */
export function OrderPreview({
  dessert,
  configState,
}: {
  dessert: DessertTypeConfig;
  configState: ConfigState;
}) {
  const model = useMemo(
    () => buildPreviewModel(dessert, configState),
    [dessert, configState],
  );

  return (
    <div className="mx-auto aspect-square w-full max-w-[260px]">
      <DessertPreview model={model} />
    </div>
  );
}
