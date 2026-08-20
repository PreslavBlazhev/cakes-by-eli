import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "./LoginForm";
import { currentAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const admin = await currentAdmin();
  if (admin) redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="relative grid size-11 place-items-center rounded-full bg-ink text-paper"
          >
            <span className="absolute inset-1 rounded-full border border-paper/45" />
            <span className="font-[family-name:var(--font-display)] text-[1.15rem] italic">
              CE
            </span>
          </span>
          <div>
            <p className="font-[family-name:var(--font-display)] text-[1.3rem] leading-none">
              Cakes by ELI
            </p>
            <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-ink-soft">
              административен панел
            </p>
          </div>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-[0.78rem] text-ink-faint">
          Тази страница е само за собственика на сайта.
        </p>
      </div>
    </main>
  );
}
