type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializePrimitive(value: boolean | number | string | null): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Canonical JSON does not support non-finite numbers");
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Value could not be serialized as canonical JSON");
  }
  return serialized;
}

function serialize(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return serializePrimitive(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${serializePrimitive(key)}:${serialize(value[key])}`);
  return `{${entries.join(",")}}`;
}

function normalizeNfc(value: unknown): JsonValue {
  if (typeof value === "string") {
    return value.normalize("NFC");
  }
  if (typeof value === "boolean" || value === null || typeof value === "number") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeNfc);
  }
  if (!isObjectRecord(value)) {
    throw new Error("Canonical JSON only supports JSON values");
  }

  const normalized: Record<string, JsonValue> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.normalize("NFC");
    if (Object.hasOwn(normalized, normalizedKey)) {
      throw new Error(`Canonical JSON has duplicate keys after NFC normalization: ${key}`);
    }
    normalized[normalizedKey] = normalizeNfc(nestedValue);
  }
  return normalized;
}

export function canonicalJson(value: unknown): string {
  return `${serialize(normalizeNfc(value))}\n`;
}
