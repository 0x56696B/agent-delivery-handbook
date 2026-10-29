#!/usr/bin/env node
// TOTP (RFC 6238) generator for the web-app test user.
// CLI: prints one 6-digit code for TEST_USER_TOTP_SECRET from ../../.ai-secrets.
// Accepts no arguments. Never prints the seed.
import { createHmac } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[\s=]/g, "");
  if (clean.length === 0) throw new Error("invalid base32");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(out);
}

export function totp(base32Secret, { time = Date.now(), step = 30, digits = 6 } = {}) {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(time / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

function parseDotenv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (val.length >= 2 && (val[0] === '"' || val[0] === "'") && val.at(-1) === val[0]) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

async function main() {
  let text;
  try {
    text = readFileSync(new URL("../../.ai-secrets", import.meta.url), "utf8");
  } catch {
    fail("totp: secrets file not found", 2);
  }
  const seed = parseDotenv(text).TEST_USER_TOTP_SECRET;
  if (!seed) fail("totp: TEST_USER_TOTP_SECRET is not set", 3);
  try {
    base32Decode(seed);
  } catch {
    fail("totp: TEST_USER_TOTP_SECRET is not valid base32", 4);
  }
  const remaining = 30000 - (Date.now() % 30000);
  if (remaining < 5000) await new Promise((r) => setTimeout(r, remaining + 50));
  process.stdout.write(`${totp(seed)}\n`);
}

let isMain = false;
try {
  isMain = realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
} catch {
  isMain = false;
}
if (isMain) await main();
