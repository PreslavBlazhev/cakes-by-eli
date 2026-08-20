"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import {
  ActionForm,
  ConfirmAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { AdminEmpty, Card } from "@/components/admin/ui";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import type { ConfigGroup } from "@/features/configurator/types";
import { formatPrice } from "@/lib/format";
import {
  deleteCustomizationGroup,
  deleteCustomizationOption,
  saveCustomizationGroup,
  saveCustomizationOption,
} from "@/server/admin/customizations";

const INPUT_LABELS: Record<string, string> = {
  SINGLE: "Един избор",
  MULTI: "Няколко избора",
  TEXT: "Свободен текст",
  NUMBER: "Число",
};

/** Preview channels the bundled renderers understand. */
const CHANNELS = [
  ["", "— без връзка с визуализацията —"],
  ["shape", "Форма"],
  ["tiers", "Брой етажи"],
  ["sponge", "Цвят на блата"],
  ["filling", "Цвят на крема"],
  ["frostingStyle", "Стил на покритието"],
  ["frostingColor", "Цвят на покритието"],
  ["dripColor", "Цвят на дрипа"],
  ["ribbon", "Акцент между етажите"],
  ["decoration", "Декорация"],
  ["topper", "Топер"],
  ["topperText", "Текст на топера"],
  ["message", "Надпис"],
  ["count", "Брой изделия"],
  ["glaze", "Глазура"],
  ["coating", "Покритие"],
  ["shellColors", "Цветове на черупките"],
  ["icingColors", "Цветове на айсинга"],
  ["assortment", "Видове в кутията"],
] as const;

export function GroupsManager({
  dessertTypeId,
  groups,
}: {
  dessertTypeId: string;
  groups: ConfigGroup[];
}) {
  const [editingGroup, setEditingGroup] = useState<ConfigGroup | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [optionTarget, setOptionTarget] = useState<{
    group: ConfigGroup;
    option: ConfigGroup["options"][number] | null;
  } | null>(null);

  const closeGroup = () => {
    setEditingGroup(null);
    setCreatingGroup(false);
  };

  return (
    <>
      <Card
        title={`Групи (${groups.length})`}
        description="Подредени по стъпка, после по ред."
        actions={
          <button
            type="button"
            onClick={() => setCreatingGroup(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-[0.86rem] font-semibold text-paper transition-colors hover:bg-cocoa"
          >
            <Plus size={15} aria-hidden="true" />
            Добави група
          </button>
        }
        padded={false}
      >
        {groups.length === 0 ? (
          <div className="p-5">
            <AdminEmpty
              title="Няма групи."
              description="Добавете първия въпрос към този вид десерт."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {groups.map((group) => (
              <li key={group.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{group.label}</p>
                      <Badge tone="neutral">Стъпка {group.step}</Badge>
                      <Badge tone="sage">
                        {INPUT_LABELS[group.inputType] ?? group.inputType}
                      </Badge>
                      {group.isRequired ? (
                        <Badge tone="rose">Задължителна</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 font-mono text-[0.78rem] text-ink-faint">
                      key: {group.key}
                      {group.previewChannel
                        ? ` · визуализация: ${group.previewChannel}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingGroup(group)}
                      className="inline-flex min-h-9 items-center rounded-full border border-line bg-paper px-3.5 text-[0.82rem] font-semibold transition-colors hover:border-ink"
                    >
                      Редактирай
                    </button>
                    <ConfirmAction
                      action={deleteCustomizationGroup}
                      hiddenFields={{ id: group.id }}
                      label="Изтрий"
                      title="Изтриване на група"
                      message={`Групата „${group.label}“ и всичките ѝ опции ще бъдат изтрити. Вече записаните поръчки запазват своя текст.`}
                      confirmLabel="Изтрий"
                    />
                  </div>
                </div>

                {group.inputType === "SINGLE" || group.inputType === "MULTI" ? (
                  <div className="mt-3 rounded-[var(--radius-sm)] border border-line bg-surface-sunk/50 p-3">
                    <ul className="flex flex-wrap gap-1.5">
                      {group.options.map((option) => (
                        <li key={option.id}>
                          <button
                            type="button"
                            onClick={() => setOptionTarget({ group, option })}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-[0.8rem] transition-colors hover:border-ink"
                          >
                            {option.swatchColor ? (
                              <span
                                aria-hidden="true"
                                className="size-3.5 rounded-full border border-line"
                                style={{ background: option.swatchColor }}
                              />
                            ) : null}
                            {option.label}
                            {option.priceModifierCents ? (
                              <span className="text-ink-faint">
                                +{formatPrice(option.priceModifierCents)}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                      <li>
                        <button
                          type="button"
                          onClick={() => setOptionTarget({ group, option: null })}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[0.8rem] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                        >
                          <Plus size={12} aria-hidden="true" />
                          Опция
                        </button>
                      </li>
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* -------------------------------------------------- Group dialog */}
      <Modal
        open={creatingGroup || editingGroup !== null}
        onClose={closeGroup}
        title={editingGroup ? "Редактиране на група" : "Нова група"}
      >
        <ActionForm
          action={saveCustomizationGroup}
          onSuccess={closeGroup}
          className="space-y-4"
        >
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="dessertTypeId" value={dessertTypeId} />
              {editingGroup ? (
                <input type="hidden" name="id" value={editingGroup.id} />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Заглавие"
                  required
                  error={fieldErrors.label}
                  htmlFor="g-label"
                >
                  <Input
                    id="g-label"
                    name="label"
                    defaultValue={editingGroup?.label ?? ""}
                    required
                    maxLength={80}
                  />
                </Field>

                <Field
                  label="Ключ"
                  required
                  hint="Латиница, без интервали. Не се променя след като има поръчки."
                  error={fieldErrors.key}
                  htmlFor="g-key"
                >
                  <Input
                    id="g-key"
                    name="key"
                    defaultValue={editingGroup?.key ?? ""}
                    required
                    maxLength={48}
                    className="font-mono"
                  />
                </Field>

                <Field label="Тип" htmlFor="g-type">
                  <Select
                    id="g-type"
                    name="inputType"
                    defaultValue={editingGroup?.inputType ?? "SINGLE"}
                  >
                    {Object.entries(INPUT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Връзка с визуализацията"
                  hint="Кой слой от картинката управлява тази група."
                  htmlFor="g-channel"
                >
                  <Select
                    id="g-channel"
                    name="previewChannel"
                    defaultValue={editingGroup?.previewChannel ?? ""}
                  >
                    {CHANNELS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Стъпка" htmlFor="g-step">
                  <Input
                    id="g-step"
                    name="step"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={editingGroup?.step ?? 1}
                  />
                </Field>

                <Field label="Ред в стъпката" htmlFor="g-order">
                  <Input
                    id="g-order"
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={editingGroup?.sortOrder ?? 0}
                  />
                </Field>

                <Field label="Мин. избора" htmlFor="g-min">
                  <Input
                    id="g-min"
                    name="minSelect"
                    type="number"
                    min={0}
                    max={12}
                    defaultValue={editingGroup?.minSelect ?? 0}
                  />
                </Field>

                <Field label="Макс. избора" htmlFor="g-max">
                  <Input
                    id="g-max"
                    name="maxSelect"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={editingGroup?.maxSelect ?? 1}
                  />
                </Field>

                <Field
                  label="Макс. знаци"
                  hint="Само за текстови полета."
                  htmlFor="g-maxlen"
                >
                  <Input
                    id="g-maxlen"
                    name="maxLength"
                    type="number"
                    min={1}
                    max={400}
                    defaultValue={editingGroup?.maxLength ?? ""}
                  />
                </Field>

                <Field label="Примерен текст" htmlFor="g-placeholder">
                  <Input
                    id="g-placeholder"
                    name="placeholder"
                    defaultValue={editingGroup?.placeholder ?? ""}
                    maxLength={120}
                  />
                </Field>

                <Field
                  label="Пояснение под въпроса"
                  htmlFor="g-help"
                  className="sm:col-span-2"
                >
                  <Input
                    id="g-help"
                    name="helpText"
                    defaultValue={editingGroup?.helpText ?? ""}
                    maxLength={240}
                  />
                </Field>
              </div>

              <div className="space-y-2.5">
                <Checkbox
                  name="isRequired"
                  defaultChecked={editingGroup?.isRequired ?? false}
                  label="Задължителен избор"
                />
                <Checkbox
                  name="isActive"
                  defaultChecked
                  label="Показвай в конфигуратора"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={closeGroup}
                  className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[0.86rem] font-semibold transition-colors hover:bg-surface-sunk"
                >
                  Отказ
                </button>
                <SubmitButton pending={pending}>Запази</SubmitButton>
              </div>
            </>
          )}
        </ActionForm>
      </Modal>

      {/* ------------------------------------------------- Option dialog */}
      <Modal
        open={optionTarget !== null}
        onClose={() => setOptionTarget(null)}
        title={optionTarget?.option ? "Редактиране на опция" : "Нова опция"}
        description={optionTarget ? `Група: ${optionTarget.group.label}` : undefined}
      >
        {optionTarget ? (
          <ActionForm
            action={saveCustomizationOption}
            onSuccess={() => setOptionTarget(null)}
            className="space-y-4"
          >
            {({ pending, fieldErrors }) => (
              <>
                <input
                  type="hidden"
                  name="groupId"
                  value={optionTarget.group.id}
                />
                {optionTarget.option ? (
                  <input type="hidden" name="id" value={optionTarget.option.id} />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Име"
                    required
                    error={fieldErrors.label}
                    htmlFor="o-label"
                  >
                    <Input
                      id="o-label"
                      name="label"
                      defaultValue={optionTarget.option?.label ?? ""}
                      required
                      maxLength={80}
                    />
                  </Field>

                  <Field
                    label="Ключ"
                    required
                    hint="Латиница/цифри."
                    error={fieldErrors.key}
                    htmlFor="o-key"
                  >
                    <Input
                      id="o-key"
                      name="key"
                      defaultValue={optionTarget.option?.key ?? ""}
                      required
                      maxLength={48}
                      className="font-mono"
                    />
                  </Field>

                  <Field
                    label="Добавка към цената (EUR)"
                    hint="Празно = без промяна в цената."
                    htmlFor="o-price"
                  >
                    <Input
                      id="o-price"
                      name="price"
                      inputMode="decimal"
                      defaultValue={
                        optionTarget.option?.priceModifierCents == null
                          ? ""
                          : (
                              optionTarget.option.priceModifierCents / 100
                            ).toFixed(2)
                      }
                    />
                  </Field>

                  <Field
                    label="Цвят (HEX)"
                    hint="Показва се като кръгче за избор."
                    htmlFor="o-swatch"
                  >
                    <Input
                      id="o-swatch"
                      name="swatchColor"
                      defaultValue={optionTarget.option?.swatchColor ?? ""}
                      maxLength={9}
                      placeholder="#f2d7d7"
                      className="font-mono"
                    />
                  </Field>

                  <Field
                    label="Стойност за визуализацията"
                    hint="Напр. round, heart, strawberries. Празно = ползва цвета или ключа."
                    htmlFor="o-preview"
                    className="sm:col-span-2"
                  >
                    <Input
                      id="o-preview"
                      name="previewValue"
                      defaultValue={optionTarget.option?.previewValue ?? ""}
                      maxLength={48}
                      className="font-mono"
                    />
                  </Field>

                  <Field
                    label="Описание"
                    htmlFor="o-desc"
                    className="sm:col-span-2"
                  >
                    <Input
                      id="o-desc"
                      name="description"
                      defaultValue={optionTarget.option?.description ?? ""}
                      maxLength={240}
                    />
                  </Field>

                  <Field label="Ред" htmlFor="o-order">
                    <Input
                      id="o-order"
                      name="sortOrder"
                      type="number"
                      min={0}
                      defaultValue={optionTarget.option?.sortOrder ?? 0}
                    />
                  </Field>
                </div>

                <Checkbox name="isActive" defaultChecked label="Активна" />

                <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
                  {optionTarget.option ? (
                    <ConfirmAction
                      action={deleteCustomizationOption}
                      hiddenFields={{ id: optionTarget.option.id }}
                      label="Изтрий опцията"
                      title="Изтриване на опция"
                      message="Опцията ще бъде премахната от конфигуратора."
                      confirmLabel="Изтрий"
                    />
                  ) : (
                    <span />
                  )}
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOptionTarget(null)}
                      className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-[0.86rem] font-semibold transition-colors hover:bg-surface-sunk"
                    >
                      Отказ
                    </button>
                    <SubmitButton pending={pending}>Запази</SubmitButton>
                  </span>
                </div>
              </>
            )}
          </ActionForm>
        ) : null}
      </Modal>
    </>
  );
}
