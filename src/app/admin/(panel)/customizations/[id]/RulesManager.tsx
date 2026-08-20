"use client";

import { useState } from "react";

import {
  ActionForm,
  ConfirmAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { AdminEmpty } from "@/components/admin/ui";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import type { ConfigGroup } from "@/features/configurator/types";
import {
  deleteCustomizationRule,
  saveCustomizationRule,
} from "@/server/admin/customizations";

type Rule = {
  id: string;
  targetType: "GROUP" | "OPTION";
  targetKey: string;
  targetGroupKey: string | null;
  mode: "SHOW_WHEN" | "HIDE_WHEN";
  whenGroupKey: string;
  whenOptionKeys: string[];
};

export function RulesManager({
  dessertTypeId,
  groups,
  rules,
}: {
  dessertTypeId: string;
  groups: ConfigGroup[];
  rules: Rule[];
}) {
  const [targetType, setTargetType] = useState<"GROUP" | "OPTION">("GROUP");
  const [whenGroupKey, setWhenGroupKey] = useState(groups[0]?.key ?? "");
  const [targetGroupKey, setTargetGroupKey] = useState(groups[0]?.key ?? "");

  const whenGroup = groups.find((group) => group.key === whenGroupKey);
  const targetGroup = groups.find((group) => group.key === targetGroupKey);

  const describe = (rule: Rule) => {
    const target =
      rule.targetType === "GROUP"
        ? `групата „${labelForGroup(groups, rule.targetKey)}“`
        : `опцията „${rule.targetKey}“ от „${labelForGroup(groups, rule.targetGroupKey ?? "")}“`;

    const condition = `„${labelForGroup(groups, rule.whenGroupKey)}“ = ${rule.whenOptionKeys.join(" или ")}`;

    return rule.mode === "SHOW_WHEN"
      ? `Показвай ${target}, когато ${condition}`
      : `Скрий ${target}, когато ${condition}`;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr] lg:items-start">
      <ActionForm
        action={saveCustomizationRule}
        resetOnSuccess
        className="space-y-3"
      >
        {({ pending }) => (
          <>
            <input type="hidden" name="dessertTypeId" value={dessertTypeId} />

            <Field label="Какво управляваме" htmlFor="r-target-type">
              <Select
                id="r-target-type"
                name="targetType"
                value={targetType}
                onChange={(event) =>
                  setTargetType(event.target.value as "GROUP" | "OPTION")
                }
              >
                <option value="GROUP">Цяла група</option>
                <option value="OPTION">Единична опция</option>
              </Select>
            </Field>

            {targetType === "GROUP" ? (
              <Field label="Група" htmlFor="r-target-key">
                <Select id="r-target-key" name="targetKey" required>
                  {groups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Група на опцията" htmlFor="r-target-group">
                  <Select
                    id="r-target-group"
                    name="targetGroupKey"
                    value={targetGroupKey}
                    onChange={(event) => setTargetGroupKey(event.target.value)}
                  >
                    {groups.map((group) => (
                      <option key={group.key} value={group.key}>
                        {group.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Опция" htmlFor="r-target-option">
                  <Select id="r-target-option" name="targetKey" required>
                    {(targetGroup?.options ?? []).map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}

            <Field label="Действие" htmlFor="r-mode">
              <Select id="r-mode" name="mode" defaultValue="SHOW_WHEN">
                <option value="SHOW_WHEN">Показвай, когато…</option>
                <option value="HIDE_WHEN">Скрий, когато…</option>
              </Select>
            </Field>

            <Field label="Зависи от групата" htmlFor="r-when-group">
              <Select
                id="r-when-group"
                name="whenGroupKey"
                value={whenGroupKey}
                onChange={(event) => setWhenGroupKey(event.target.value)}
                required
              >
                {groups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Избрани опции"
              hint={
                whenGroup?.options.length
                  ? `Налични ключове: ${whenGroup.options.map((o) => o.key).join(", ")}`
                  : "Разделете няколко ключа със запетая."
              }
              htmlFor="r-when-options"
            >
              <Input
                id="r-when-options"
                name="whenOptionKeys"
                required
                placeholder="напр. drip"
                className="font-mono"
              />
            </Field>

            <SubmitButton pending={pending}>Добави правило</SubmitButton>
          </>
        )}
      </ActionForm>

      <div>
        {rules.length === 0 ? (
          <AdminEmpty
            title="Няма правила."
            description="Без правила всички групи се показват винаги."
          />
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <Badge tone={rule.mode === "SHOW_WHEN" ? "positive" : "warning"}>
                    {rule.mode === "SHOW_WHEN" ? "Показвай" : "Скрий"}
                  </Badge>
                  <p className="mt-1.5 text-[0.85rem]">{describe(rule)}</p>
                </div>
                <ConfirmAction
                  action={deleteCustomizationRule}
                  hiddenFields={{ id: rule.id }}
                  label="Изтрий"
                  title="Изтриване на правило"
                  message="Правилото ще бъде премахнато и засегнатите групи ще се показват винаги."
                  confirmLabel="Изтрий"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function labelForGroup(groups: ConfigGroup[], key: string): string {
  return groups.find((group) => group.key === key)?.label ?? key;
}
