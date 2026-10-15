/**
 * Architecture tests verify the actual import-boundary checker rejects forbidden engine-to-runtime dependencies.
 * Input: An isolated synthetic source tree and the existing checker CLI in a child process.
 * Output and oracle: Literal failure status and diagnostics identify the forbidden edge; no application source tree or game is mutated.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createTestTempDirectory } from "../support/drivers/temp-directories";

test("boundary checker rejects illegal game engine imports", async () => {
  const root = await createTestTempDirectory("awa-boundary-");
  await fs.mkdir(path.join(root, "game", "engine"), { recursive: true });
  await fs.mkdir(path.join(root, "runtime"), { recursive: true });
  await fs.writeFile(
    path.join(root, "runtime", "forbidden.ts"),
    "export const forbidden = true;\n",
  );
  await fs.writeFile(
    path.join(root, "game", "engine", "illegal.ts"),
    'import { forbidden } from "../../runtime/forbidden";\nexport { forbidden };\n',
  );

  const checker = path.resolve(import.meta.dir, "../../scripts/check-import-boundaries.mjs");
  const result = Bun.spawnSync([process.execPath, checker, root], {
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(1);
  expect(new TextDecoder().decode(result.stderr)).toContain(
    'game/engine imports forbidden layer "runtime"',
  );
});
