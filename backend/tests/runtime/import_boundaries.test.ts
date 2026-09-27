import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createTestTempDirectory } from "../support/temp_directory";

test("boundary checker rejects illegal game engine imports", async () => {
  const root = await createTestTempDirectory("awa-boundary-");
  await fs.mkdir(path.join(root, "game", "engine"), { recursive: true });
  await fs.mkdir(path.join(root, "runtime"), { recursive: true });
  await fs.writeFile(path.join(root, "runtime", "forbidden.ts"), "export const forbidden = true;\n");
  await fs.writeFile(
    path.join(root, "game", "engine", "illegal.ts"),
    'import { forbidden } from "../../runtime/forbidden";\nexport { forbidden };\n',
  );

  const checker = path.resolve(import.meta.dir, "../../scripts/check_import_boundaries.mjs");
  const result = Bun.spawnSync([process.execPath, checker, root], { stdout: "pipe", stderr: "pipe" });

  expect(result.exitCode).toBe(1);
  expect(new TextDecoder().decode(result.stderr)).toContain('game/engine imports forbidden layer "runtime"');
});
