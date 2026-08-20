"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";

import { Field, Input } from "@/components/ui/form";
import { ErrorNotice } from "@/components/ui/primitives";
import { loginAction } from "@/server/auth/actions";
import type { LoginState } from "@/server/auth/actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form
      action={action}
      className="rounded-[var(--radius-lg)] border border-line bg-paper p-6 shadow-[var(--shadow-soft)] sm:p-8"
    >
      <h1 className="font-[family-name:var(--font-display)] text-[1.7rem] leading-tight">
        Вход
      </h1>
      <p className="mt-1.5 text-[0.88rem] text-ink-soft">
        Въведете данните на администраторския акаунт.
      </p>

      {state.status === "error" ? (
        <ErrorNotice className="mt-5" title="Входът не е успешен">
          <p>{state.message}</p>
        </ErrorNotice>
      ) : null}

      <div className="mt-6 space-y-4">
        <Field label="Имейл" required htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
          />
        </Field>

        <Field label="Парола" required htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-paper transition-colors hover:bg-cocoa disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={17} aria-hidden="true" className="animate-spin" />
            Влизане…
          </>
        ) : (
          <>
            <LogIn size={17} aria-hidden="true" />
            Влез
          </>
        )}
      </button>
    </form>
  );
}
