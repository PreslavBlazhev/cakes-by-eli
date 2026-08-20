import { env } from "@/lib/env";

/**
 * Transport-agnostic e-mail sending.
 *
 * Nothing in the application talks to a provider directly. When no provider is
 * configured the console adapter writes the full message to the server log and
 * reports `delivered: false` — the application then records the failure against
 * the order instead of pretending the message went out.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendResult =
  | { delivered: true; provider: string; id?: string }
  | { delivered: false; provider: string; error: string };

export interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

class ConsoleEmail implements EmailAdapter {
  readonly name = "console";

  async send(message: EmailMessage): Promise<SendResult> {
    console.info(
      [
        "",
        "──────── ИМЕЙЛ (режим console — НЕ е изпратен) ────────",
        `До:       ${message.to}`,
        `Тема:     ${message.subject}`,
        message.replyTo ? `Отговор:  ${message.replyTo}` : null,
        "",
        message.text,
        "───────────────────────────────────────────────────────",
        "",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    );

    return {
      delivered: false,
      provider: this.name,
      error:
        "EMAIL_PROVIDER е „console“ — писмото е записано в лога, но не е изпратено.",
    };
  }
}

class ResendEmail implements EmailAdapter {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<SendResult> {
    if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
      return {
        delivered: false,
        provider: this.name,
        error: "Липсва EMAIL_API_KEY или EMAIL_FROM.",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          delivered: false,
          provider: this.name,
          // Never echo the API key back into logs or the admin UI.
          error: `Resend отговори с ${response.status}: ${body.slice(0, 300)}`,
        };
      }

      const data = (await response.json()) as { id?: string };
      return { delivered: true, provider: this.name, id: data.id };
    } catch (error) {
      return {
        delivered: false,
        provider: this.name,
        error: error instanceof Error ? error.message : "Неизвестна грешка.",
      };
    }
  }
}

class SmtpEmail implements EmailAdapter {
  readonly name = "smtp";

  async send(): Promise<SendResult> {
    return {
      delivered: false,
      provider: this.name,
      error:
        "SMTP изпращането изисква инсталиране на nodemailer и попълване на SMTP_URL. " +
        "Виж README, раздел „Имейл“.",
    };
  }
}

let adapter: EmailAdapter | null = null;

export function emailAdapter(): EmailAdapter {
  if (adapter) return adapter;
  if (env.EMAIL_PROVIDER === "resend") adapter = new ResendEmail();
  else if (env.EMAIL_PROVIDER === "smtp") adapter = new SmtpEmail();
  else adapter = new ConsoleEmail();
  return adapter;
}
