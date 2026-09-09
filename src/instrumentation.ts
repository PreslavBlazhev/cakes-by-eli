/**
 * Observability entry point.
 *
 * Next calls `register` once per server instance, in **every** runtime — so the
 * Node-only memory sampler is imported from here rather than declared here.
 * A static import of `process.memoryUsage` or `node:v8` at the top of this file
 * ends up in the Edge bundle, which has neither.
 *
 * Off unless `MEMLOG=1`, so it costs nothing until someone is looking.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MEMLOG !== "1") return;

  const { startMemoryLog } = await import("./instrumentation-node");
  await startMemoryLog();
}
