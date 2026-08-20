import { db } from "@/db/client";
import { orderEmails } from "@/db/schema";
import { env } from "@/lib/env";
import { emailAdapter } from "./provider";
import type { EmailMessage } from "./provider";

/**
 * Application-level e-mail API.
 *
 * Every attempt is recorded against the order, including failures, so the
 * owner can see in the admin panel that a message did not go out rather than
 * assuming it did.
 */

export type EmailKind =
  | "OWNER_NEW_ORDER"
  | "CUSTOMER_RECEIVED"
  | "CUSTOMER_STATUS";

async function deliver(
  orderId: string,
  kind: EmailKind,
  message: EmailMessage,
): Promise<{ delivered: boolean; error?: string }> {
  let result: Awaited<ReturnType<ReturnType<typeof emailAdapter>["send"]>>;

  try {
    result = await emailAdapter().send(message);
  } catch (error) {
    result = {
      delivered: false,
      provider: emailAdapter().name,
      error: error instanceof Error ? error.message : "Неизвестна грешка.",
    };
  }

  try {
    await db.insert(orderEmails).values({
      orderId,
      kind,
      toAddress: message.to,
      subject: message.subject,
      status: result.delivered ? "SENT" : "FAILED",
      error: result.delivered ? null : result.error,
    });
  } catch (error) {
    // Logging the attempt must never take down the request that created the
    // order — the order itself is already committed by this point.
    console.error("Неуспешен запис на имейл лог:", error);
  }

  return result.delivered
    ? { delivered: true }
    : { delivered: false, error: result.error };
}

export async function sendNewOrderAdminEmail(
  orderId: string,
  message: Omit<EmailMessage, "to">,
): Promise<{ delivered: boolean; error?: string }> {
  const to = env.OWNER_NOTIFICATION_EMAIL;

  if (!to) {
    await db.insert(orderEmails).values({
      orderId,
      kind: "OWNER_NEW_ORDER",
      toAddress: "(не е зададен)",
      subject: message.subject,
      status: "SKIPPED",
      error:
        "OWNER_NOTIFICATION_EMAIL не е конфигуриран — известието не беше изпратено.",
    });
    return {
      delivered: false,
      error: "OWNER_NOTIFICATION_EMAIL не е конфигуриран.",
    };
  }

  return deliver(orderId, "OWNER_NEW_ORDER", { ...message, to });
}

export async function sendCustomerOrderReceivedEmail(
  orderId: string,
  message: EmailMessage,
): Promise<{ delivered: boolean; error?: string }> {
  return deliver(orderId, "CUSTOMER_RECEIVED", message);
}

export async function sendOrderStatusEmail(
  orderId: string,
  message: EmailMessage,
): Promise<{ delivered: boolean; error?: string }> {
  return deliver(orderId, "CUSTOMER_STATUS", message);
}

export function replyToAddress(): string | undefined {
  return env.OWNER_NOTIFICATION_EMAIL;
}
