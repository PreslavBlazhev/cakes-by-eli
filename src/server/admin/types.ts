export type ActionResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export const OK = (message: string, id?: string): ActionResult => ({
  ok: true,
  message,
  id,
});

export const FAIL = (
  message: string,
  fieldErrors?: Record<string, string>,
): ActionResult => ({ ok: false, message, fieldErrors });

/** Turns an unexpected throw into a message the owner can act on. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return "Сесията е изтекла. Моля, влезте отново.";
    }
    return error.message;
  }
  return "Възникна неочаквана грешка.";
}
