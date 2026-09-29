"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { Checkbox, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import {
  CUSTOMER_NOTIFIABLE_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
} from "@/lib/labels";
import type { OrderStatus } from "@/lib/labels";
import { updateOrderStatus } from "@/server/admin/orders";

/** Statuses the owner reaches most often, offered as one-tap shortcuts. */
const QUICK: OrderStatus[] = [
  "REVIEWING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY",
  "COMPLETED",
];

export function StatusControl({
  orderId,
  currentStatus,
  customerEmail,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  customerEmail: string;
}) {
  const [status, setStatus] = useState<OrderStatus>(
    currentStatus === "NEW" ? "REVIEWING" : currentStatus,
  );

  const canNotify = CUSTOMER_NOTIFIABLE_STATUSES.includes(status);

  return (
    <ActionForm action={updateOrderStatus} resetOnSuccess className="space-y-4">
      {({ pending }) => (
        <>
          <input type="hidden" name="orderId" value={orderId} />

          <div className="flex flex-wrap gap-1.5">
            {QUICK.filter((option) => option !== currentStatus).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-[3px] border px-3 text-[0.78rem] font-semibold transition-colors",
                  status === option
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper text-ink-soft hover:border-ink hover:text-ink",
                )}
              >
                {ORDER_STATUS_LABELS[option]}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
              Нов статус
            </span>
            <Select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus)}
            >
              {ORDER_STATUS_ORDER.map((option) => (
                <option key={option} value={option}>
                  {ORDER_STATUS_LABELS[option]}
                  {option === currentStatus ? " (текущ)" : ""}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[0.74rem] font-extrabold text-ink-soft">
              Бележка към промяната
            </span>
            <Textarea
              name="note"
              rows={2}
              maxLength={1000}
              placeholder="Незадължително — виждат я и клиентът, ако изпратите известие."
              className="min-h-20"
            />
          </label>

          <Checkbox
            name="notifyCustomer"
            disabled={!canNotify}
            label="Изпрати известие на клиента"
            description={
              canNotify
                ? `Ще получи имейл на ${customerEmail}.`
                : "За този статус не се изпраща автоматично известие."
            }
          />

          <SubmitButton pending={pending}>Запази статуса</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
