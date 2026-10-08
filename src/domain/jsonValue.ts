import { z } from "zod";

const JSON_OBJECT_KEY_PREFIX = "\u0000rea-json-key:";

const encodeJsonKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(encodeJsonKeys);
  if (value === null || typeof value !== "object") return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      JSON_OBJECT_KEY_PREFIX + key,
      encodeJsonKeys(child),
    ]),
  );
};

const restoreJsonKeys = (value: unknown): void => {
  if (Array.isArray(value)) {
    for (const child of value) restoreJsonKeys(child);
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const key of Object.keys(value)) {
    const child = value[key];
    restoreJsonKeys(child);
    if (!key.startsWith(JSON_OBJECT_KEY_PREFIX)) continue;

    const restoredKey = key.slice(JSON_OBJECT_KEY_PREFIX.length);
    delete value[key];
    Object.defineProperty(value, restoredKey, {
      value: child,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
};

/**
 * Zod 4.4.3 builds z.json() objects through z.record(), which skips an own
 * __proto__ key before materializing the parsed record. Encode object keys before
 * that boundary and restore them on the parsed JSON value so validation keeps
 * the full JSON member set without invoking prototype setters.
 */
export const jsonValueSchema = z
  .preprocess(encodeJsonKeys, z.json())
  .check(z.check(({ value }) => restoreJsonKeys(value)));

/** JSON object boundary for caller-visible parameter maps. */
export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

export type JsonValue = z.infer<typeof jsonValueSchema>;
