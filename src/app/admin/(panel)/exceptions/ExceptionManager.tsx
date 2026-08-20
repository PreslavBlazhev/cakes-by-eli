"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import {
  ActionForm,
  ConfirmAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { AdminEmpty, Card } from "@/components/admin/ui";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { formatDate, shortTime, todayInSofia } from "@/lib/format";
import type { ScheduleExceptionRow } from "@/lib/schedule";
import {
  deleteScheduleException,
  saveScheduleException,
} from "@/server/admin/site";

type Exception = ScheduleExceptionRow & { id: string };

export function ExceptionManager({ exceptions }: { exceptions: Exception[] }) {
  const [isClosed, setIsClosed] = useState(true);
  const today = todayInSofia();

  const upcoming = exceptions.filter((item) => item.date >= today);
  const past = exceptions.filter((item) => item.date < today);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <Card title="Добави изключение">
        <ActionForm
          action={saveScheduleException}
          resetOnSuccess
          className="space-y-4"
        >
          {({ pending, fieldErrors }) => (
            <>
              <Field
                label="Дата"
                required
                error={fieldErrors.date}
                htmlFor="ex-date"
              >
                <Input id="ex-date" name="date" type="date" required />
              </Field>

              <Checkbox
                name="isClosed"
                checked={isClosed}
                onChange={(event) => setIsClosed(event.target.checked)}
                label="Затворено през целия ден"
              />

              {!isClosed ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Отваря в"
                    error={fieldErrors.opensAt}
                    htmlFor="ex-open"
                  >
                    <Input
                      id="ex-open"
                      name="opensAt"
                      type="time"
                      defaultValue="09:00"
                    />
                  </Field>
                  <Field
                    label="Затваря в"
                    error={fieldErrors.closesAt}
                    htmlFor="ex-close"
                  >
                    <Input
                      id="ex-close"
                      name="closesAt"
                      type="time"
                      defaultValue="14:00"
                    />
                  </Field>
                </div>
              ) : null}

              <Checkbox
                name="blocksOrders"
                label="Не приемам поръчки за тази дата"
                description="Клиентите няма да могат да изберат тази дата във формата за поръчка."
              />

              <Field
                label="Кратко пояснение"
                hint="Показва се на клиентите, ако е попълнено."
                htmlFor="ex-note"
              >
                <Input
                  id="ex-note"
                  name="note"
                  maxLength={200}
                  placeholder="напр. Коледна почивка"
                />
              </Field>

              <SubmitButton pending={pending}>
                <CalendarPlus size={15} aria-hidden="true" />
                Добави
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>

      <div className="space-y-4">
        <Card title="Предстоящи" padded={false}>
          {upcoming.length === 0 ? (
            <div className="p-5">
              <AdminEmpty title="Няма предстоящи изключения." />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((item) => (
                <ExceptionRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Card>

        {past.length > 0 ? (
          <Card title="Отминали" padded={false}>
            <ul className="divide-y divide-line opacity-70">
              {past.slice(-10).reverse().map((item) => (
                <ExceptionRow key={item.id} item={item} />
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ExceptionRow({ item }: { item: Exception }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{formatDate(item.date)}</p>
          {item.isClosed ? (
            <Badge tone="danger">Затворено</Badge>
          ) : (
            <Badge tone="warning">
              {shortTime(item.opensAt)} – {shortTime(item.closesAt)}
            </Badge>
          )}
          {item.blocksOrders ? (
            <Badge tone="info">Без поръчки</Badge>
          ) : null}
        </div>
        {item.note ? (
          <p className="mt-0.5 text-[0.82rem] text-ink-soft">{item.note}</p>
        ) : null}
      </div>

      <ConfirmAction
        action={deleteScheduleException}
        hiddenFields={{ id: item.id }}
        label="Премахни"
        title="Премахване на изключение"
        message={`Изключението за ${formatDate(item.date)} ще бъде премахнато и денят ще следва обичайното работно време.`}
        confirmLabel="Премахни"
      />
    </li>
  );
}
