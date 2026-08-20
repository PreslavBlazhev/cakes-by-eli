import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard and needs no native module, which keeps deployment
 * portable. Hashes are self-describing so parameters can be raised later
 * without invalidating existing accounts.
 *
 * Format: scrypt$N$r$p$<salt-b64>$<hash-b64>
 */

const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
const MAXMEM = 128 * PARAMS.N * PARAMS.r * 2;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) {
    throw new Error("Паролата трябва да е поне 10 знака.");
  }
  const salt = randomBytes(16);
  const derived = await scrypt(
    password.normalize("NFKC"),
    salt,
    PARAMS.keylen,
    { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: MAXMEM },
  );
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: 128 * N * r * 2,
  });

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
