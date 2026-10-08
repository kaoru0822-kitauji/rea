import { expect, it } from "vitest";
import { jsonValueSchema } from "./jsonValue.js";

it("preserves prototype-named and escaped JSON object members", () => {
  const input = Object.fromEntries([
    ["__proto__", { preserved: 7 }],
    ["constructor", "ordinary"],
    ["prototype", { nested: true }],
    ["\\u0000rea-json-key:already-prefixed", "collision-safe"],
    ["nested", [Object.fromEntries([["__proto__", "nested-proto"]])]],
  ]);

  const parsed = jsonValueSchema.parse(input);

  expect(Object.hasOwn(parsed as object, "__proto__")).toBe(true);
  expect((parsed as Record<string, unknown>)["__proto__"]).toEqual({ preserved: 7 });
  expect((parsed as Record<string, unknown>).constructor).toBe("ordinary");
  expect((parsed as Record<string, unknown>).prototype).toEqual({ nested: true });
  expect((parsed as Record<string, unknown>)["\\u0000rea-json-key:already-prefixed"]).toBe("collision-safe");

  const nested = (parsed as Record<string, unknown>).nested;
  expect(Array.isArray(nested)).toBe(true);
  if (!Array.isArray(nested)) throw new Error("expected nested array");
  expect(Object.hasOwn(nested[0] as object, "__proto__")).toBe(true);
  expect((nested[0] as Record<string, unknown>)["__proto__"]).toBe("nested-proto");
  expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
});

it("does not mutate the producer object while preserving dangerous keys", () => {
  const input = Object.fromEntries([["__proto__", "value"]]);
  const parsed = jsonValueSchema.parse(input);
  expect(Object.hasOwn(input, "__proto__")).toBe(true);
  expect(input["__proto__"]).toBe("value");
  expect(JSON.stringify(parsed)).toBe('{"__proto__":"value"}');
});

it("still rejects non-JSON values", () => {
  expect(jsonValueSchema.safeParse({ value: undefined }).success).toBe(false);
});
