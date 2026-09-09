/**
 * Memory telemetry — the Node-only half.
 *
 * Kept in its own module because Next calls `register` in every runtime and
 * compiles `instrumentation.ts` for the Edge bundle too. `process.memoryUsage`,
 * `process.getActiveResourcesInfo` and `node:v8` do not exist there, so the
 * gate in `src/instrumentation.ts` imports this file only under
 * `NEXT_RUNTIME === "nodejs"` — the pattern the Next instrumentation guide
 * documents for runtime-specific code.
 *
 * The service is capped at 512 MB, and the reason a crash there is hard to
 * explain is that Render only reports the kill, never what the process was
 * holding. One JSON line a minute is enough to tell the three cases apart:
 *
 *  - `heapUsed` climbing between restarts  → retained JavaScript objects;
 *  - `heapUsed` flat while `rss` climbs    → native memory (sharp/libvips);
 *  - `external`/`arrayBuffers` spiking     → a buffered response body;
 *  - `heapLimitMB` far above the plan      → V8 sizing its heap from the
 *    host's RAM instead of the container's, so it never collects under
 *    pressure before the cgroup killer arrives.
 *
 * Counters only. No URL, no request, no client address, no e-mail, no file
 * name, no environment value — nothing here reads anything but the process's
 * own memory accounting.
 */

const SAMPLE_INTERVAL_MS = 60_000;

declare global {
  var __cbeMemlogStarted: boolean | undefined;
}

const toMB = (bytes: number) => Math.round(bytes / 1_048_576);

type HeapStatistics = () => { heap_size_limit: number };

function sampleForever(getHeapStatistics: HeapStatistics): void {
  let peakRss = 0;

  const sample = () => {
    const memory = process.memoryUsage();
    if (memory.rss > peakRss) peakRss = memory.rss;

    // Grouped by resource *kind* — the strings Node returns are type names
    // such as "TCPSERVERWRAP" or "Timeout", never addresses or payloads.
    const resources: Record<string, number> = {};
    for (const kind of process.getActiveResourcesInfo()) {
      resources[kind] = (resources[kind] ?? 0) + 1;
    }

    console.info(
      JSON.stringify({
        tag: "MEM",
        uptimeS: Math.round(process.uptime()),
        rssMB: toMB(memory.rss),
        peakRssMB: toMB(peakRss),
        heapTotalMB: toMB(memory.heapTotal),
        heapUsedMB: toMB(memory.heapUsed),
        externalMB: toMB(memory.external),
        arrayBuffersMB: toMB(memory.arrayBuffers),
        heapLimitMB: toMB(getHeapStatistics().heap_size_limit),
        resources,
      }),
    );
  };

  // One line at boot, so the baseline is on record even if the process dies
  // before the first interval elapses.
  sample();

  const timer = setInterval(sample, SAMPLE_INTERVAL_MS);
  // Never a reason for the process to stay alive.
  timer.unref();
}

/**
 * Starts the sampler, at most once.
 *
 * The guard lives on `globalThis` rather than in module scope because a module
 * can be evaluated more than once — HMR in development, separate bundles for
 * separate runtimes — and a second interval would double every line.
 */
export async function startMemoryLog(): Promise<void> {
  if (globalThis.__cbeMemlogStarted) return;
  globalThis.__cbeMemlogStarted = true;

  const { getHeapStatistics } = await import("node:v8");
  sampleForever(getHeapStatistics);
}
