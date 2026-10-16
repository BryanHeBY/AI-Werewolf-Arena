/**
 * 原生 CLI 集成测试以原 getter／Proxy 诊断探针、临时错误 providers 文件及真实 run_game 子参数为输入，核对非法 provider JSON 被安全拒绝，不暴露不透明值或重复未捕获错误。精确安全码／状态及零 getter 读取为预期；命令路径仍指向原同一文件。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

const secret = "synthetic-private-transport-canary";

test("game CLI rejects invalid provider configuration without exposing JSON or a second uncaught exception", async () => {
  const { configDiagnostic } = await import("../../../src/app/cli/check-config");
  let reads = 0;
  const foreign = Object.defineProperty(new Error(), "message", {
    get() {
      reads++;
      throw new Error(secret);
    },
  });
  expect(configDiagnostic(foreign)).toEqual({ code: "config_check_failed" });
  expect(reads).toBe(0);
  const { BoardConfigurationError } = await import("../../../src/app/config/board-definition");
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
  await fs.writeFile(path.join(root, "runtime/backends.json"), `{"key":"${secret}",INVALID}`);
  const command = path.resolve(import.meta.dir, "../../../src/app/cli/run-game.ts");
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
