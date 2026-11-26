import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Render runs `npm start`. On a 512 MB plan the process was OOM-killed with a
 * ~60 MB JS heap because glibc malloc arenas and four parallel libvips decodes
 * held native memory; `scripts/start.mjs` sets MALLOC_ARENA_MAX and
 * UV_THREADPOOL_SIZE before Next starts. These guard against the start command
 * quietly going back to a bare `next start`.
 */

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const launcher = fs.readFileSync(path.join(root, "scripts", "start.mjs"), "utf8");

describe("production start command", () => {
  it("goes through the launcher", () => {
    expect(pkg.scripts.start).toBe("node scripts/start.mjs");
  });

  it("sets both native-memory defaults", () => {
    expect(launcher).toMatch(/MALLOC_ARENA_MAX:\s*"2"/);
    expect(launcher).toMatch(/UV_THREADPOOL_SIZE:\s*"2"/);
  });

  it("lets a value from the environment win", () => {
    expect(launcher).toMatch(/process\.env\[name\] === undefined/);
  });

  it("starts Next in production mode", () => {
    expect(launcher).toMatch(/\[nextBin, "start"/);
  });
});
