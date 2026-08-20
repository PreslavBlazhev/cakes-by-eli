"use client";

import { Megaphone } from "lucide-react";

import {
  ActionForm,
  ConfirmAction,
  SubmitButton,
} from "@/components/admin/ActionForm";
import { AdminEmpty, Card } from "@/components/admin/ui";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { deleteAnnouncement, saveAnnouncement } from "@/server/admin/site";

type Announcement = {
  id: string;
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

export function AnnouncementManager({
  announcements,
}: {
  announcements: Announcement[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <Card title="Ново съобщение">
        <ActionForm action={saveAnnouncement} resetOnSuccess className="space-y-4">
          {({ pending, fieldErrors }) => (
            <>
              <Field
                label="Текст"
                required
                error={fieldErrors.text}
                htmlFor="a-text"
              >
                <Textarea
                  id="a-text"
                  name="text"
                  required
                  maxLength={240}
                  className="min-h-20"
                  placeholder="напр. Поръчките за Великден са отворени."
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Връзка"
                  hint="Вътрешен адрес като /menu или пълен https:// адрес."
                  htmlFor="a-url"
                >
                  <Input id="a-url" name="linkUrl" maxLength={500} />
                </Field>
                <Field label="Текст на връзката" htmlFor="a-label">
                  <Input id="a-label" name="linkLabel" maxLength={60} />
                </Field>
                <Field label="Показвай от" htmlFor="a-from">
                  <Input id="a-from" name="startsAt" type="date" />
                </Field>
                <Field label="Показвай до" htmlFor="a-to">
                  <Input id="a-to" name="endsAt" type="date" />
                </Field>
              </div>

              <Checkbox name="isActive" defaultChecked label="Активно" />

              <SubmitButton pending={pending}>
                <Megaphone size={15} aria-hidden="true" />
                Публикувай
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>

      <Card title="Всички съобщения" padded={false}>
        {announcements.length === 0 ? (
          <div className="p-5">
            <AdminEmpty title="Няма съобщения." />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {announcements.map((item) => (
              <li key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.text}</p>
                      {item.isActive ? (
                        <Badge tone="positive">Активно</Badge>
                      ) : (
                        <Badge tone="muted">Изключено</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[0.8rem] text-ink-soft">
                      {item.startsAt ? `от ${formatDate(item.startsAt)}` : "без начална дата"}
                      {" · "}
                      {item.endsAt ? `до ${formatDate(item.endsAt)}` : "без крайна дата"}
                      {item.linkUrl ? ` · връзка: ${item.linkUrl}` : ""}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <ActionForm action={saveAnnouncement} className="inline-block">
                      {({ pending }) => (
                        <>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="text" value={item.text} />
                          <input
                            type="hidden"
                            name="linkUrl"
                            value={item.linkUrl ?? ""}
                          />
                          <input
                            type="hidden"
                            name="linkLabel"
                            value={item.linkLabel ?? ""}
                          />
                          <input
                            type="hidden"
                            name="startsAt"
                            value={item.startsAt}
                          />
                          <input type="hidden" name="endsAt" value={item.endsAt} />
                          {item.isActive ? null : (
                            <input type="hidden" name="isActive" value="on" />
                          )}
                          <SubmitButton pending={pending} variant="secondary">
                            {item.isActive ? "Изключи" : "Включи"}
                          </SubmitButton>
                        </>
                      )}
                    </ActionForm>

                    <ConfirmAction
                      action={deleteAnnouncement}
                      hiddenFields={{ id: item.id }}
                      label="Изтрий"
                      title="Изтриване на съобщение"
                      message="Съобщението ще бъде премахнато окончателно."
                      confirmLabel="Изтрий"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
