/**
 * Native CLI integration test verifies invalid provider JSON is rejected without opaque values or duplicate uncaught errors.
 * Input: Original getter/proxy diagnostic probes, temporary synthetic malformed providers file and real run_game child arguments.
 * Output and oracle: Exact safe code/status and zero getter reads preserve assertions; the source command path changes only to the same original file.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

const secret = "synthetic-private-transport-canary";

test("game CLI rejects invalid provider configuration without exposing JSON or a second uncaught exception", async () => {
  const { configDiagnostic } = await import("../../../src/runtime/cli/check_config");
  let reads = 0;
  const foreign = Object.defineProperty(new Error(), "message", {
    get() {
      reads++;
      throw new Error(secret);
    },
  });
  expect(configDiagnostic(foreign)).toEqual({ code: "config_check_failed" });
  expect(reads).toBe(0);
  const { BoardConfigurationError } = await import("../../../src/runtime/config/board_definition");
  const typed = Object.defineProperty(
    new BoardConfigurationError("board_config_invalid_field", "roles.witch"),
    "fieldPath",
    {
      get() {
        reads++;
        throw new Error(secret);
      },
    },
  );
  expect(configDiagnostic(typed)).toEqual({ code: "board_config_invalid_field" });
  expect(reads).toBe(0);
  expect(
    configDiagnostic(
      new Proxy(new Error(secret), {
        getPrototypeOf() {
          throw new Error(secret);
        },
      }),
    ),
  ).toEqual({ code: "config_check_failed" });
  expect(configDiagnostic(new Error(`runtime_config_${secret.replaceAll("-", "_")}`))).toEqual({
    code: "config_check_failed",
  });
  const root = await createTestTempDirectory("awa-diagnostic-cli-");
  await fs.mkdir(path.join(root, "runtime"));
  await fs.writeFile(path.join(root, "runtime/providers.json"), `{"key":"${secret}",INVALID}`);
  const command = path.resolve(import.meta.dir, "../../../src/runtime/cli/run_game.ts");
  const child = Bun.spawn(
    [Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun", command, "--configs-dir", root],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code).toBe(1);
  expect(stdout + stderr).not.toContain(secret);
  expect(stderr).toContain("runtime_config_json_invalid");
  expect(stderr).not.toContain(" at ");
});
