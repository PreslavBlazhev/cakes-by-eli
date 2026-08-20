"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Card } from "@/components/admin/ui";
import { Checkbox, Input } from "@/components/ui/form";
import { shortTime } from "@/lib/format";
import { WEEKDAY_LABELS } from "@/lib/labels";
import type { WorkingHourRow } from "@/lib/schedule";
import { saveWorkingHours } from "@/server/admin/site";

export function HoursForm({ hours }: { hours: WorkingHourRow[] }) {
  const [closed, setClosed] = useState<Record<number, boolean>>(
    Object.fromEntries(hours.map((row) => [row.weekday, row.isClosed])),
  );

  return (
    <ActionForm action={saveWorkingHours}>
      {({ pending }) => (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
              const row = hours.find((h) => h.weekday === weekday);
              const isClosed = closed[weekday] ?? row?.isClosed ?? false;

              return (
                <li
                  key={weekday}
                  className="flex flex-wrap items-center gap-4 px-5 py-4"
                >
                  <p className="w-[110px] font-bold">{WEEKDAY_LABELS[weekday]}</p>

                  <label className="flex items-center gap-2 text-[0.85rem]">
                    <span className="text-ink-soft">от</span>
                    <Input
                      name={`opens-${weekday}`}
                      type="time"
                      disabled={isClosed}
                      defaultValue={shortTime(row?.opensAt) || "09:00"}
                      className="w-[130px]"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-[0.85rem]">
                    <span className="text-ink-soft">до</span>
                    <Input
                      name={`closes-${weekday}`}
                      type="time"
                      disabled={isClosed}
                      defaultValue={shortTime(row?.closesAt) || "18:00"}
                      className="w-[130px]"
                    />
                  </label>

                  <Checkbox
                    name={`closed-${weekday}`}
                    checked={isClosed}
                    onChange={(event) =>
                      setClosed((current) => ({
                        ...current,
                        [weekday]: event.target.checked,
                      }))
                    }
                    label="Почивен ден"
                    className="ml-auto"
                  />
                </li>
              );
            })}
          </ul>

          <div className="flex justify-end border-t border-line px-5 py-4">
            <SubmitButton pending={pending}>Запази работното време</SubmitButton>
          </div>
        </Card>
      )}
    </ActionForm>
  );
}
