import pino from "pino";
import { describe, expect, it } from "vitest";

import {
  projectReferenceSourceImportError,
  type ReferenceSourceImportError,
} from "./application/ReferenceSourceImportTypes.js";
import { isReferenceSourceImportCliFailure } from "./cli/referenceSourceImportStatus.js";
import { isCliOperationFailure, logCliCommand } from "./cliLogging.js";
import { ConfigurationError } from "./domain/configurationErrors.js";
import { projectAnalysisError } from "./domain/analysisErrorProjection.js";

const importFailure = (code: ReferenceSourceImportError["code"]) => ({
  error: "Import failed",
  ...projectReferenceSourceImportError({
    tag: "reference-source-import",
    code,
    message: "Internal import diagnostic",
  }),
});

const configurationFailure = {
  error: "Import failed",
  ...projectAnalysisError(new ConfigurationError("Invalid import setting")),
};

const invalidRootFailure = importFailure("invalid-root");
const unsupportedFailure = {
  error: "Import failed",
  category: "unsupported_provider",
  message:
    "Safe no-follow file opens are unavailable. Run the import on Linux or macOS.",
};

const successfulValues: readonly (readonly [string, unknown])[] = [
  ["undefined", undefined],
  ["null", null],
  ["array", [invalidRootFailure]],
  ["string", "Import failed"],
  ["missing error label", { category: "invalid_input", message: "failure" }],
  ["missing category", { error: "Import failed", message: "failure" }],
  ["missing message", { error: "Import failed", category: "invalid_input" }],
  ["empty message", { ...invalidRootFailure, message: "" }],
  ["non-string message", { ...invalidRootFailure, message: 1 }],
  ["null message", { ...invalidRootFailure, message: null }],
  ["empty category", { ...invalidRootFailure, category: "" }],
  ["non-string category", { ...invalidRootFailure, category: 1 }],
  ["near category", { ...invalidRootFailure, category: "invalid-root" }],
  ["foreign category", { ...invalidRootFailure, category: "timeout" }],
  ["near error label", { ...invalidRootFailure, error: "Import failure" }],
  ["label suffix", { ...invalidRootFailure, error: "Import failed " }],
  ["empty error label", { ...invalidRootFailure, error: "" }],
  ["non-string error label", { ...invalidRootFailure, error: true }],
  ["extra field", { ...invalidRootFailure, source: "ordinary data" }],
  ["extra undefined field", { ...invalidRootFailure, source: undefined }],
  ["nested legacy error", { error: invalidRootFailure }],
  ["ordinary error-like data", { error: "source error", message: "data" }],
  [
    "ordinary code and message",
    { code: "configuration_invalid", message: "data" },
  ],
  ["nested evidence", { result: invalidRootFailure }],
  ["partial result", { status: "partial" }],
  ["unsupported result", { status: "unsupported" }],
  ["successful result", { status: "complete", entries: [] }],
];

describe("reference-source import CLI failure classification", () => {
  it.each(["cancelled", "invalid-root", "io", "parse", "unsupported"] as const)(
    "recognizes the projected %s failure only at this command boundary",
    (code) => {
      const value = importFailure(code);
      expect(isCliOperationFailure(value)).toBe(false);
      expect(isReferenceSourceImportCliFailure(value)).toBe(true);
    },
  );

  it("recognizes an unsupported-reader failure without accepting nearby shapes", () => {
    expect(isCliOperationFailure(unsupportedFailure)).toBe(false);
    expect(isReferenceSourceImportCliFailure(unsupportedFailure)).toBe(true);
    for (const value of [
      { ...unsupportedFailure, category: "unsupported" },
      { ...unsupportedFailure, error: "Other failure" },
      { ...unsupportedFailure, message: "" },
      { ...unsupportedFailure, extra: true },
    ])
      expect(isReferenceSourceImportCliFailure(value)).toBe(false);
  });

  it("projects unavailable no-follow support with actionable recovery", () => {
    const value = importFailure("unsupported");
    expect(value.category).toBe("unsupported_provider");
    expect(value.message).toContain("Internal import diagnostic");
    expect(value.message).toContain("Linux or macOS");
    expect(value.message).toContain("WSL");
    expect(value.message).not.toMatch(/permissions|reinstall/iu);
  });

  it("retains canonical configuration failure classification", () => {
    expect(isReferenceSourceImportCliFailure(configurationFailure)).toBe(true);
  });

  it.each(successfulValues)("keeps %s successful", (_label, value) => {
    expect(isReferenceSourceImportCliFailure(value)).toBe(false);
  });
});

describe("reference-source import CLI logging seam", () => {
  it.each([
    ["cancelled", importFailure("cancelled"), true],
    ["invalid-root", invalidRootFailure, true],
    ["io", importFailure("io"), true],
    ["parse", importFailure("parse"), true],
    ["unsupported", unsupportedFailure, true],
    ["configuration", configurationFailure, true],
    ["success", { status: "complete", entries: [] }, false],
  ] as const)(
    "preserves %s output and logs its status",
    async (_label, value, failed) => {
      const records: unknown[] = [];
      const logger = pino(
        { level: "info" },
        {
          write: (message) => {
            records.push(JSON.parse(message) as unknown);
          },
        },
      );
      const previousExitCode = process.exitCode;
      try {
        process.exitCode = undefined;
        const output = await logCliCommand(
          logger,
          "import-reference-source",
          async () => value,
          isReferenceSourceImportCliFailure,
        );
        expect(output).toBe(value);
        expect.soft(process.exitCode).toBe(failed ? 1 : undefined);
        expect(records).toEqual([
          expect.objectContaining({
            command: "import-reference-source",
            status: failed ? "error" : "ok",
            level: failed ? 50 : 30,
            msg: failed ? "CLI command failed" : "CLI command completed",
          }),
        ]);
      } finally {
        process.exitCode = previousExitCode;
      }
    },
  );
});
