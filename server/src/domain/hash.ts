import { createHash } from "node:crypto";

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalizeValue(record[key])]),
    );
  }

  if (value === undefined) {
    throw new TypeError("Undefined values cannot be hashed canonically");
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

export function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}
