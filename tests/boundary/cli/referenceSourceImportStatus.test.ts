import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect } from "vitest";

import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { cliTest } from "../../support/cli/cliFixture.js";
import { noFollowOpenSupported } from "../../../src/reference/ReferenceSourceReaderValidate.js";

const invalidRootOutput = {
  error: "Import failed",
  category: "invalid_input",
  message:
    "Reference source directory could not be opened. Check that the path exists, is readable, and points to a directory.",
};

describe("compiled reference-source import preflight failures", () => {
  for (const rootKind of ["missing", "regular-file"] as const) {
    for (const fullOutput of [false, true]) {
      for (const logging of [false, true]) {
        cliTest(
          `${rootKind} root, ${fullOutput ? "full-output" : "JSON"}, logging ${String(logging)}`,
          async ({ cli }) => {
            const directory = await createTestTempDirectory(
              "rea-reference-cli-status-",
            );
            const root = join(directory, "input");
            if (rootKind === "regular-file")
              await writeFile(root, "inert input\n");
            const result = await cli.run({
              arguments: [
                "import-reference-source",
                root,
                "--json",
                ...(fullOutput ? ["--full-output"] : []),
              ],
              cwd: directory,
              environment: {
                HOME: directory,
                USERPROFILE: directory,
                XDG_CONFIG_HOME: directory,
                XDG_CACHE_HOME: directory,
                ...(logging ? { REA_LOG_LEVEL: "info" } : {}),
              },
            });
            if (fullOutput) {
              // Incur's legacy wrapper remains unchanged; operation status is
              // conveyed by the exit code and command log, not this `ok` field.
              expect(result.json).toMatchObject({
                ok: true,
                data: invalidRootOutput,
              });
              expect(result.json).toHaveProperty("data", invalidRootOutput);
            } else {
              expect(result.json).toEqual(invalidRootOutput);
            }
            expect.soft(result.exitCode).toBe(1);
            if (logging) {
              const records: unknown[] = result.stderr
                .trim()
                .split("\n")
                .map((line) => JSON.parse(line) as unknown);
              expect(records).toEqual([
                expect.objectContaining({
                  command: "import-reference-source",
                  status: "error",
                  level: 50,
                  msg: "CLI command failed",
                }),
              ]);
            } else {
              expect(result.stderr).toBe("");
            }
          },
        );
      }
    }
  }
});

describe("compiled reference-source import reader capability", () => {
  for (const fullOutput of [false, true]) {
    for (const logging of [false, true]) {
      cliTest.skipIf(noFollowOpenSupported())(
        `unsupported reader, ${fullOutput ? "full-output" : "JSON"}, logging ${String(logging)}`,
        async ({ cli }) => {
          const directory = await createTestTempDirectory(
            "rea-reference-cli-unsupported-",
          );
          await writeFile(
            join(directory, "main.js"),
            "export const value = 1;\n",
          );
          const result = await cli.run({
            arguments: [
              "import-reference-source",
              directory,
              "--json",
              ...(fullOutput ? ["--full-output"] : []),
            ],
            cwd: directory,
            environment: logging ? { REA_LOG_LEVEL: "info" } : {},
          });
          const failure = {
            error: "Import failed",
            category: "unsupported_provider",
            message:
              "Reference source import is unavailable: Safe no-follow file opens are unavailable. Run the import on Linux or macOS, or in WSL with access to the source tree, then supply the resulting HistoricalSourceGraph.",
          };
          expect(result.json).toEqual(
            fullOutput ? expect.objectContaining({ data: failure }) : failure,
          );
          expect(result.exitCode).toBe(1);
          if (logging)
            expect(JSON.parse(result.stderr.trim())).toMatchObject({
              command: "import-reference-source",
              status: "error",
              level: 50,
            });
          else expect(result.stderr).toBe("");
        },
      );
    }
  }

  cliTest.skipIf(!noFollowOpenSupported())(
    "keeps a supported readable source import successful",
    async ({ cli }) => {
      const directory = await createTestTempDirectory(
        "rea-reference-cli-supported-",
      );
      await writeFile(join(directory, "main.js"), "export const value = 1;\n");
      const result = await cli.run({
        arguments: ["import-reference-source", directory, "--json"],
        cwd: directory,
      });
      expect(result.exitCode).toBe(0);
      expect(result.json).toMatchObject({
        schema: "HistoricalSourceGraph",
        entries: expect.arrayContaining([
          expect.objectContaining({ path: "main.js", content_state: "hashed" }),
        ]),
      });
      expect(result.stderr).toBe("");
    },
  );
});
