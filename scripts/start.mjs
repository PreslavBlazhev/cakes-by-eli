/**
 * Production entry point — what `npm start` runs.
 *
 * It exists for one reason: two settings that keep native memory inside the
 * 512 MB plan can only be given to a process *before* it starts, and the
 * service must not depend on someone remembering to type them into the
 * hosting dashboard.
 *
 *  - MALLOC_ARENA_MAX=2 — glibc gives every thread that allocates its own
 *    malloc arena, up to 8 × the core count it can *see*, which inside a
 *    container is the host's, not the plan's half core. libvips decodes each
 *    photo on a libuv worker thread, so pixel buffers land in a different
 *    arena almost every time, and freed arenas are not handed back to the OS.
 *    Measured on Node 26 in a 512 MB / 0.5 CPU container with nothing else
 *    changed: 8 590 sequential image requests left RSS at 458 MB with the JS
 *    heap at 60 MB; ten concurrent ones were OOM-killed. With two arenas the
 *    same runs peaked at 289 MB and 440 MB.
 *
 *  - UV_THREADPOOL_SIZE=2 — every image the optimizer has not cached yet is
 *    decoded on a libuv worker, and the default four workers mean four
 *    full-size rasters at once. Half a CPU cannot run them in parallel
 *    anyway, so the extra two only add memory: the cold-cache burst peaked at
 *    357 MB instead of 440 MB.
 *
 * Both are read by the C runtime and by libuv when the process starts, so
 * they cannot be set from JavaScript inside the server. On Linux this script
 * therefore *replaces itself* with `next start` through `process.execve` — the
 * same PID, no wrapper process left resident. A value already present in the
 * environment always wins, so either can be tuned from the dashboard without
 * a code change.
 *
 * Elsewhere (Windows, macOS — there is no glibc to tune) or on a Node without
 * `process.execve`, Next simply runs inside this process as it always did.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const nextArgs = [nextBin, "start", ...process.argv.slice(2)];

const RUNTIME_DEFAULTS = {
  MALLOC_ARENA_MAX: "2",
  UV_THREADPOOL_SIZE: "2",
};

const missing = Object.entries(RUNTIME_DEFAULTS).filter(
  ([name]) => process.env[name] === undefined,
);

if (
  process.platform === "linux" &&
  missing.length > 0 &&
  typeof process.execve === "function"
) {
  // Never returns on success. Flags such as --max-old-space-size given to
  // this script are carried over, and NODE_OPTIONS travels in the environment.
  process.execve(
    process.execPath,
    [process.execPath, ...process.execArgv, ...nextArgs],
    { ...process.env, ...Object.fromEntries(missing) },
  );
}

process.argv = [process.execPath, ...nextArgs];
await import(pathToFileURL(nextBin).href);
