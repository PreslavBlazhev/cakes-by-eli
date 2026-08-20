"use client";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Card } from "@/components/admin/ui";
import { Textarea } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";
import { addOrderNote } from "@/server/admin/orders";

export function NotesPanel({
  orderId,
  notes,
}: {
  orderId: string;
  notes: { id: string; body: string; authorName: string; createdAt: string }[];
}) {
  return (
    <Card
      title="Вътрешни бележки"
      description="Виждат се само в администрацията."
    >
      <ActionForm action={addOrderNote} resetOnSuccess className="space-y-3">
        {({ pending }) => (
          <>
            <input type="hidden" name="orderId" value={orderId} />
            <Textarea
              name="body"
              rows={3}
              maxLength={4000}
              required
              placeholder="Напр. клиентът ще потвърди цвета до петък."
              className="min-h-24"
            />
            <SubmitButton pending={pending} variant="secondary">
              Добави бележка
            </SubmitButton>
          </>
        )}
      </ActionForm>

      {notes.length > 0 ? (
        <ul className="mt-5 space-y-3 border-t border-line pt-4">
          {notes.map((note) => (
            <li key={note.id}>
              <p className="whitespace-pre-line text-[0.88rem]">{note.body}</p>
              <p className="mt-1 text-[0.76rem] text-ink-faint">
                {note.authorName} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
