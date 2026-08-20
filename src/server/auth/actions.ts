"use server";

import { redirect } from "next/navigation";

import { loginSchema } from "@/lib/validation";
import { login, logout } from "./session";

export type LoginState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Моля, попълнете имейл и парола." };
  }

  const result = await login(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}
