import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader for the standalone CLI scripts.
 *
 * Next.js loads .env files itself at runtime; the migrate/seed scripts run
 * outside Next, so they need this. Values already present in the real
 * environment always win.
 */
function loadEnvFile(file: string) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return;

  for (const rawLine of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
