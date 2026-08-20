import { describe, expect, it } from "vitest";

import {
  buildSummary,
  completionProgress,
  estimatePrice,
  isGroupVisible,
  isOptionVisible,
  pruneState,
  toggleOption,
  validateState,
  visibleGroups,
  visibleSteps,
  withDefaults,
} from "@/features/configurator/rules";
import type {
  ConfigGroup,
  ConfigState,
  DessertTypeConfig,
} from "@/features/configurator/types";
import { buildPreviewModel, channelValue } from "@/features/configurator/preview/model";

/* ------------------------------------------------------------------ *
 * Fixture — a miniature cake configurator with the same shapes the
 * database produces.
 * ------------------------------------------------------------------ */

function group(partial: Partial<ConfigGroup> & { key: string }): ConfigGroup {
  return {
    id: `g-${partial.key}`,
    label: partial.key,
    helpText: "",
    inputType: "SINGLE",
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    maxLength: null,
    placeholder: "",
    previewChannel: "",
    step: 1,
    sortOrder: 0,
    options: [],
    ...partial,
  };
}

const dessert: DessertTypeConfig = {
  id: "d1",
  slug: "torta",
  name: "Торта",
  renderer: "cake",
  description: "",
  basePriceCents: 4500,
  categoryId: null,
  groups: [
    group({
      key: "shape",
      label: "Форма",
      isRequired: true,
      previewChannel: "shape",
      step: 1,
      options: [
        {
          id: "o1",
          key: "round",
          label: "Кръгла",
          description: "",
          priceModifierCents: 0,
          previewValue: "round",
          swatchColor: null,
          sortOrder: 0,
        },
        {
          id: "o2",
          key: "heart",
          label: "Сърце",
          description: "",
          priceModifierCents: 500,
          previewValue: "heart",
          swatchColor: null,
          sortOrder: 1,
        },
      ],
    }),
    group({
      key: "exterior",
      label: "Покритие",
      isRequired: true,
      step: 2,
      options: [
        {
          id: "o3",
          key: "smooth",
          label: "Гладък",
          description: "",
          priceModifierCents: 0,
          previewValue: "smooth",
          swatchColor: null,
          sortOrder: 0,
        },
        {
          id: "o4",
          key: "drip",
          label: "Дрип",
          description: "",
          priceModifierCents: 0,
          previewValue: "drip",
          swatchColor: null,
          sortOrder: 1,
        },
      ],
    }),
    group({
      key: "dripColor",
      label: "Цвят на дрипа",
      step: 2,
      previewChannel: "dripColor",
      options: [
        {
          id: "o5",
          key: "dark",
          label: "Тъмен",
          description: "",
          priceModifierCents: null,
          previewValue: "#4f2f22",
          swatchColor: "#4f2f22",
          sortOrder: 0,
        },
      ],
    }),
    group({
      key: "decoration",
      label: "Декорация",
      inputType: "MULTI",
      maxSelect: 2,
      step: 3,
      previewChannel: "decoration",
      options: [
        {
          id: "o6",
          key: "strawberries",
          label: "Ягоди",
          description: "",
          priceModifierCents: 200,
          previewValue: "strawberries",
          swatchColor: null,
          sortOrder: 0,
        },
        {
          id: "o7",
          key: "gold",
          label: "Златни детайли",
          description: "",
          priceModifierCents: 300,
          previewValue: "gold",
          swatchColor: null,
          sortOrder: 1,
        },
        {
          id: "o8",
          key: "flowers",
          label: "Цветя",
          description: "",
          priceModifierCents: null,
          previewValue: "flowers",
          swatchColor: null,
          sortOrder: 2,
        },
      ],
    }),
    group({
      key: "message",
      label: "Надпис",
      inputType: "TEXT",
      maxLength: 20,
      step: 4,
      previewChannel: "message",
    }),
  ],
  rules: [
    {
      targetType: "GROUP",
      targetKey: "dripColor",
      targetGroupKey: null,
      mode: "SHOW_WHEN",
      whenGroupKey: "exterior",
      whenOptionKeys: ["drip"],
    },
    {
      targetType: "OPTION",
      targetKey: "gold",
      targetGroupKey: "decoration",
      mode: "HIDE_WHEN",
      whenGroupKey: "shape",
      whenOptionKeys: ["heart"],
    },
  ],
};

const base: ConfigState = {
  shape: { options: ["round"] },
  exterior: { options: ["smooth"] },
};

/* ------------------------------------------------------------------ */

describe("visibility rules", () => {
  it("hides a group until its condition is met", () => {
    expect(isGroupVisible(dessert, "dripColor", base)).toBe(false);

    const withDrip: ConfigState = { ...base, exterior: { options: ["drip"] } };
    expect(isGroupVisible(dessert, "dripColor", withDrip)).toBe(true);
  });

  it("hides a single option with a HIDE_WHEN rule", () => {
    expect(isOptionVisible(dessert, "decoration", "gold", base)).toBe(true);

    const heart: ConfigState = { ...base, shape: { options: ["heart"] } };
    expect(isOptionVisible(dessert, "decoration", "gold", heart)).toBe(false);
  });

  it("omits hidden groups and options from the visible set", () => {
    const heart: ConfigState = { ...base, shape: { options: ["heart"] } };
    const groups = visibleGroups(dessert, heart);

    expect(groups.map((g) => g.key)).not.toContain("dripColor");

    const decoration = groups.find((g) => g.key === "decoration");
    expect(decoration?.options.map((o) => o.key)).toEqual([
      "strawberries",
      "flowers",
    ]);
  });

  it("groups visible controls into ordered steps", () => {
    const steps = visibleSteps(dessert, base);
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4]);
    expect(steps[1].groups.map((g) => g.key)).toEqual(["exterior"]);
  });
});

describe("pruneState", () => {
  it("drops selections that a later change made unreachable", () => {
    const withDrip: ConfigState = {
      ...base,
      exterior: { options: ["drip"] },
      dripColor: { options: ["dark"] },
    };
    expect(pruneState(dessert, withDrip).dripColor).toBeDefined();

    const backToSmooth: ConfigState = {
      ...withDrip,
      exterior: { options: ["smooth"] },
    };
    expect(pruneState(dessert, backToSmooth).dripColor).toBeUndefined();
  });

  it("drops an option that a rule has just hidden", () => {
    const state: ConfigState = {
      ...base,
      decoration: { options: ["gold", "strawberries"] },
      shape: { options: ["heart"] },
    };
    expect(pruneState(dessert, state).decoration?.options).toEqual([
      "strawberries",
    ]);
  });
});

describe("toggleOption", () => {
  it("replaces the value of a single-select group", () => {
    const next = toggleOption(dessert, base, "shape", "heart");
    expect(next.shape?.options).toEqual(["heart"]);
  });

  it("keeps a required single-select group filled", () => {
    const next = toggleOption(dessert, base, "shape", "round");
    expect(next.shape?.options).toEqual(["round"]);
  });

  it("accumulates values in a multi-select group up to maxSelect", () => {
    let state = toggleOption(dessert, base, "decoration", "strawberries");
    state = toggleOption(dessert, state, "decoration", "gold");
    expect(state.decoration?.options).toEqual(["strawberries", "gold"]);

    state = toggleOption(dessert, state, "decoration", "flowers");
    expect(state.decoration?.options).toEqual(["gold", "flowers"]);
  });

  it("removes an already-selected multi value", () => {
    let state = toggleOption(dessert, base, "decoration", "strawberries");
    state = toggleOption(dessert, state, "decoration", "strawberries");
    expect(state.decoration).toBeUndefined();
  });
});

describe("validateState", () => {
  it("accepts a complete configuration", () => {
    expect(validateState(dessert, base)).toEqual([]);
  });

  it("reports a missing required group", () => {
    const issues = validateState(dessert, { shape: { options: ["round"] } });
    expect(issues.map((i) => i.groupKey)).toContain("exterior");
  });

  it("rejects an option that does not belong to the group", () => {
    const issues = validateState(dessert, {
      ...base,
      shape: { options: ["triangle"] },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Невалиден избор");
  });

  it("rejects a value for a group that is not currently visible", () => {
    const issues = validateState(dessert, {
      ...base,
      dripColor: { options: ["dark"] },
    });
    expect(issues.map((i) => i.groupKey)).toContain("dripColor");
  });

  it("rejects more selections than maxSelect allows", () => {
    const issues = validateState(dessert, {
      ...base,
      decoration: { options: ["strawberries", "gold", "flowers"] },
    });
    expect(issues[0].message).toContain("най-много");
  });

  it("rejects text longer than maxLength", () => {
    const issues = validateState(dessert, {
      ...base,
      message: { text: "x".repeat(25) },
    });
    expect(issues[0].groupKey).toBe("message");
  });
});

describe("estimatePrice", () => {
  it("adds the modifiers of every selected option", () => {
    const state: ConfigState = {
      ...base,
      shape: { options: ["heart"] },
      decoration: { options: ["strawberries"] },
    };
    // 4500 base + 500 heart + 0 smooth + 200 strawberries
    expect(estimatePrice(dessert, state).totalCents).toBe(5200);
  });

  it("multiplies by quantity", () => {
    expect(estimatePrice(dessert, base, 3).totalCents).toBe(13500);
  });

  it("returns null when any selected option has no configured price", () => {
    const state: ConfigState = {
      ...base,
      decoration: { options: ["flowers"] },
    };
    expect(estimatePrice(dessert, state)).toEqual({
      totalCents: null,
      complete: false,
    });
  });

  it("returns null when the dessert has no base price", () => {
    const free = { ...dessert, basePriceCents: null };
    expect(estimatePrice(free, base).totalCents).toBeNull();
  });
});

describe("buildSummary", () => {
  it("produces readable Bulgarian lines in group order", () => {
    const state: ConfigState = {
      ...base,
      decoration: { options: ["strawberries", "gold"] },
      message: { text: "Честит рожден ден" },
    };

    expect(buildSummary(dessert, state)).toEqual([
      expect.objectContaining({ groupLabel: "Форма", value: "Кръгла" }),
      expect.objectContaining({ groupLabel: "Покритие", value: "Гладък" }),
      expect.objectContaining({
        groupLabel: "Декорация",
        value: "Ягоди, Златни детайли",
      }),
      expect.objectContaining({
        groupLabel: "Надпис",
        value: "Честит рожден ден",
      }),
    ]);
  });
});

describe("withDefaults and progress", () => {
  it("preselects the first option of every required single-select group", () => {
    const state = withDefaults(dessert);
    expect(state.shape?.options).toEqual(["round"]);
    expect(state.exterior?.options).toEqual(["smooth"]);
    expect(state.decoration).toBeUndefined();
  });

  it("counts answered groups against currently visible ones", () => {
    expect(completionProgress(dessert, base)).toEqual({
      answered: 2,
      total: 4,
    });
  });
});

describe("preview model", () => {
  it("maps selected options onto their preview channels", () => {
    const state: ConfigState = {
      ...base,
      exterior: { options: ["drip"] },
      dripColor: { options: ["dark"] },
      message: { text: "Мария" },
    };

    const model = buildPreviewModel(dessert, state);

    expect(channelValue(model, "shape")).toBe("round");
    expect(channelValue(model, "dripColor")).toBe("#4f2f22");
    expect(model.text.message).toBe("Мария");
  });

  it("never exposes a channel for a hidden group", () => {
    const model = buildPreviewModel(dessert, base);
    expect(model.channels.dripColor).toBeUndefined();
  });
});
