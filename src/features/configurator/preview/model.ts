import { findOption, visibleGroups } from "../rules";
import type { ConfigState, DessertTypeConfig } from "../types";

/**
 * The bridge between configuration data and the SVG visualiser.
 *
 * Groups declare a `previewChannel` and options declare a `previewValue`, so
 * the renderers never look at group keys directly. Adding a new option in the
 * admin panel changes the picture without touching renderer code.
 */
export type PreviewModel = {
  renderer: string;
  /** channel → preview tokens of the selected options, in selection order. */
  channels: Record<string, string[]>;
  /** channel → labels, used for captions such as the cake message. */
  labels: Record<string, string[]>;
  text: Record<string, string>;
  numbers: Record<string, number>;
};

export function buildPreviewModel(
  dessert: DessertTypeConfig,
  state: ConfigState,
): PreviewModel {
  const model: PreviewModel = {
    renderer: dessert.renderer,
    channels: {},
    labels: {},
    text: {},
    numbers: {},
  };

  for (const group of visibleGroups(dessert, state)) {
    const channel = group.previewChannel;
    if (!channel) continue;

    const value = state[group.key];
    if (!value) continue;

    if (group.inputType === "TEXT") {
      if (value.text?.trim()) model.text[channel] = value.text.trim();
      continue;
    }

    if (group.inputType === "NUMBER") {
      if (value.number !== undefined) model.numbers[channel] = value.number;
      continue;
    }

    const tokens: string[] = [];
    const labels: string[] = [];
    for (const key of value.options ?? []) {
      const option = findOption(group, key);
      if (!option) continue;
      tokens.push(option.previewValue || option.key);
      labels.push(option.label);
    }
    if (tokens.length > 0) {
      model.channels[channel] = tokens;
      model.labels[channel] = labels;
    }
  }

  return model;
}

/* ------------------------------------------------------------------ *
 * Accessors used by the renderers
 * ------------------------------------------------------------------ */

export function channelValue(
  model: PreviewModel,
  channel: string,
  fallback = "",
): string {
  return model.channels[channel]?.[0] ?? fallback;
}

export function channelList(model: PreviewModel, channel: string): string[] {
  return model.channels[channel] ?? [];
}

export function channelHas(
  model: PreviewModel,
  channel: string,
  token: string,
): boolean {
  return (model.channels[channel] ?? []).includes(token);
}

/** Reads a colour channel, accepting either a hex token or a named preset. */
export function channelColor(
  model: PreviewModel,
  channel: string,
  fallback: string,
): string {
  const raw = channelValue(model, channel);
  if (!raw) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  return NAMED_COLORS[raw] ?? fallback;
}

export function channelNumber(
  model: PreviewModel,
  channel: string,
  fallback: number,
): number {
  if (model.numbers[channel] !== undefined) return model.numbers[channel];
  const raw = channelValue(model, channel);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function channelText(
  model: PreviewModel,
  channel: string,
  fallback = "",
): string {
  return model.text[channel] ?? fallback;
}

/**
 * The confectionery-appropriate palette shared by every renderer. Values are
 * deliberately soft and desaturated so previews stay boutique rather than
 * cartoonish.
 */
export const NAMED_COLORS: Record<string, string> = {
  ivory: "#fdf6ec",
  cream: "#f7e7d3",
  blush: "#f2d7d7",
  rose: "#e3aeb6",
  dusty: "#c98f99",
  burgundy: "#8f4e5d",
  sage: "#bcc4ae",
  olive: "#a7ad94",
  sky: "#c6d6de",
  lavender: "#d3c8dd",
  caramel: "#d8ab74",
  chocolate: "#7a4b34",
  darkchocolate: "#4f2f22",
  pistachio: "#bfd0a0",
  gold: "#caa779",
  white: "#fffdf9",
  black: "#3a2a25",
  strawberry: "#c8515c",
  raspberry: "#a83a56",
  lemon: "#f0dfa6",
  coffee: "#6d4a35",
};
