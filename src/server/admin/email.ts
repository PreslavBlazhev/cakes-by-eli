"use server";

import { emailAdapter } from "@/lib/email/provider";
import { env } from "@/lib/env";
import { requireAdmin } from "@/server/auth/session";
import { describeError, FAIL, OK } from "./types";
import type { ActionResult } from "./types";

/**
 * Sends one message to OWNER_NOTIFICATION_EMAIL — the owner's own inbox, never
 * a customer — to prove the provider, key and sender domain work end to end.
 *
 * Deliberately not recorded against any order and never replays earlier
 * failed messages: old customer e-mails stay unsent unless handled by hand.
 */
export async function sendTestEmail(): Promise<ActionResult> {
  try {
    await requireAdmin();

    const to = env.OWNER_NOTIFICATION_EMAIL;
    if (!to) return FAIL("OWNER_NOTIFICATION_EMAIL не е зададен.");
    if (env.EMAIL_PROVIDER === "console") {
      return FAIL("EMAIL_PROVIDER е „console“ — реално изпращане не е настроено.");
    }

    const sentAt = new Date().toLocaleString("bg-BG", { timeZone: "Europe/Sofia" });
    const result = await emailAdapter().send({
      to,
      subject: "Тестов имейл от сайта на Cakes by ELI",
      text: `Това е тестово съобщение, изпратено от админ панела на ${sentAt}.\nАко го виждате, известията за нови поръчки ще пристигат тук.`,
      html: `<p>Това е тестово съобщение, изпратено от админ панела на ${sentAt}.</p><p>Ако го виждате, известията за нови поръчки ще пристигат тук.</p>`,
    });

    return result.delivered
      ? OK(`Тестовият имейл е изпратен до ${to}. Проверете пощата (и папка „Спам“).`)
      : FAIL(`Тестовият имейл не беше изпратен: ${result.error}`);
  } catch (error) {
    return FAIL(describeError(error));
  }
}
