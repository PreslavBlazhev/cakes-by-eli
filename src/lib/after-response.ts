/**
 * Background work that runs after the response, and cannot crash the server.
 *
 * Node terminates the process on an unhandled rejection, so anything scheduled
 * here has to be airtight. Two things were wrong with doing it inline:
 *
 *  - the work was started *before* `after()` was handed anything to hold, so a
 *    rejection during `await import("next/server")` had no handler at all;
 *  - nothing caught a failure even once it was registered, which turned a
 *    momentarily unreachable e-mail provider into a dead service.
 *
 * Both are fixed by taking a factory instead of a promise and wrapping every
 * path in {@link runSafely}.
 */

/**
 * Runs `work`, turning any failure into one structured log line.
 *
 * `context` is merged into that line — use it for things like which
 * notification failed. Only literal values a log may carry: never an address,
 * a message body or a credential.
 */
export async function runSafely(
  work: () => Promise<void>,
  tag = "AFTER_RESPONSE_FAILED",
  context: Record<string, string> = {},
): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(
      JSON.stringify({
        tag,
        ...context,
        message: error instanceof Error ? error.message : "неизвестна грешка",
      }),
    );
  }
}

/**
 * Hands work to Next's post-response hook so the customer is not kept waiting
 * for an e-mail provider, while the platform keeps the process alive until it
 * finishes. Outside a request — scripts, tests — it simply awaits.
 *
 * `work` is invoked exactly once. On the `after` path it runs inside the
 * callback; `after()` throws before it ever calls that callback when there is
 * no request scope, so the fallback cannot double-run it.
 */
export async function scheduleAfterResponse(
  work: () => Promise<void>,
): Promise<void> {
  let after: (typeof import("next/server"))["after"];

  try {
    ({ after } = await import("next/server"));
  } catch {
    // No Next server runtime available at all.
    await runSafely(work);
    return;
  }

  try {
    after(() => runSafely(work));
  } catch {
    // `after()` refuses to schedule outside a request scope.
    await runSafely(work);
  }
}
