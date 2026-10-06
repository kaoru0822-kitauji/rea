import { describe, expect, it } from "vitest";

import { importReferenceSource } from "../../../src/application/ReferenceSourceImport.js";
import { projectReferenceSourceImportError } from "../../../src/application/ReferenceSourceImportTypes.js";
import { err } from "../../../src/domain/result.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";

describe("reference source unsupported host projection", () => {
  it("preserves unavailable safe no-follow support with host recovery", async () => {
    const root = await createTestTempDirectory("rea-reference-unsupported-");
    const imported = await importReferenceSource(
      {
        root,
        caller: "unsupported-host-test",
        policy: { secretPatterns: [] },
      },
      async () =>
        err({
          tag: "reference-source-reader",
          code: "unsupported",
          message: "Safe no-follow file opens are unavailable",
        }),
    );

    expect(imported).toEqual({
      ok: false,
      error: {
        tag: "reference-source-import",
        code: "unsupported",
        message: "Safe no-follow file opens are unavailable",
      },
    });
    if (imported.ok) return;
    expect(projectReferenceSourceImportError(imported.error)).toEqual({
      category: "unsupported_provider",
      message:
        "Safe historical-source import requires no-follow file opens, which are unavailable on this host. Run the import on Linux or macOS; on Windows, use WSL when it can access the selected source tree.",
    });
  });
});
