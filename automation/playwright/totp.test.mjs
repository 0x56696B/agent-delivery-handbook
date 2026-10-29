import assert from "node:assert/strict";
import { test } from "node:test";
import { base32Decode, totp } from "./totp.mjs";

// ASCII "12345678901234567890" in base32 (RFC 6238 Appendix B SHA-1 seed).
const SEED = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("RFC 6238 Appendix B SHA-1 vectors", () => {
  const vectors = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  for (const [seconds, expected] of vectors) {
    assert.equal(totp(SEED, { time: seconds * 1000, digits: 8 }), expected, `t=${seconds}`);
  }
});

test("default is 6 digits", () => {
  assert.equal(totp(SEED, { time: 59000 }), "287082");
});

test("lowercase seed gives the same code", () => {
  assert.equal(totp(SEED.toLowerCase(), { time: 59000 }), totp(SEED, { time: 59000 }));
});

test("invalid base32 throws", () => {
  assert.throws(() => base32Decode("A1"), /invalid base32/);
});
