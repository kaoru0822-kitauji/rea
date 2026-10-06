import { describe, expect, it } from "vitest";

import { referenceSourceImportReadError } from "./ReferenceSourceImport.js";
import { projectReferenceSourceImportError } from "./ReferenceSourceImportTypes.js";
import type { ReferenceSourceReaderError } from "../reference/ReferenceSourceReaderTypes.js";

const readerFailure = (
  code: ReferenceSourceReaderError["code"],
): ReferenceSourceReaderError => ({
  tag: "reference-source-reader",
  code,
  message: "Observed reader diagnostic",
});

describe("historical-source reader error mapping", () => {
  it("retains unavailable no-follow support instead of inventing an I/O failure", () => {
    const error = referenceSourceImportReadError({
      ...readerFailure("unsupported"),
      message: "Safe no-follow file opens are unavailable",
    });
    expect(error).toEqual({
      tag: "reference-source-import",
      code: "unsupported",
      message: "Safe no-follow file opens are unavailable",
    });
    expect(projectReferenceSourceImportError(error)).toEqual({
      category: "unsupported_provider",
      message:
        "Reference source import is unavailable: Safe no-follow file opens are unavailable. Run the import on Linux or macOS, or in WSL with access to the source tree, then supply the resulting HistoricalSourceGraph.",
    });
  });

  it.each(["io", "invalid-root"] as const)(
    "keeps the existing reader %s mapping after root preflight",
    (code) => {
      const error = referenceSourceImportReadError(readerFailure(code));
      expect(error).toEqual({
        tag: "reference-source-import",
        code: "io",
        message: "Observed reader diagnostic",
      });
      expect(projectReferenceSourceImportError(error)).toEqual({
        category: "execution_failure",
        message:
          "Reference source files could not be read. Check directory permissions and try again.",
      });
    },
  );

  it("keeps cancellation distinct with the existing import message", () => {
    const error = referenceSourceImportReadError(readerFailure("cancelled"));
    expect(error).toEqual({
      tag: "reference-source-import",
      code: "cancelled",
      message: "Reference source import cancelled",
    });
    expect(projectReferenceSourceImportError(error)).toEqual({
      category: "cancelled",
      message:
        "Reference source import was cancelled. Start it again when ready.",
    });
  });
});
