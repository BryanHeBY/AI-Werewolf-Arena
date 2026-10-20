/**
 * 单元测试以字面 cwd／环境／参数路径为输入，用精确优先级及项目根断言核对 CLI 配置目录的纯路径选择，不加载私有配置。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { resolveCliConfigDirectory } from "../../../../../apps/game/src/cli/config-directory";
import { parseRunGameArgs } from "../../../../../apps/game/src/cli/run-game";

test("the default config directory is the project directory from root, application and external cwd", () => {
  const root = path.resolve(__dirname, "../../../../..");
  const helper = path.join(root, "apps/game/src/cli/config-directory.ts");
  for (const cwd of [root, path.join(root, "apps/game"), path.dirname(root)]) {
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `const { resolveCliConfigDirectory } = require(${JSON.stringify(helper)}); process.stdout.write(resolveCliConfigDirectory(undefined, {}));`,
      ],
      { cwd, encoding: "utf8" },
    );
    expect(child.status).toBe(0);
    expect(child.stdout).toBe(path.join(root, "configs"));
  }
});

test("explicit config paths override environment paths and preserve cwd-relative semantics", () => {
  const environment = {
    GAME_CONFIGS_DIR: "environment-configs",
    GAME_CONFIG_NAME: "environment-game",
  };
  expect(resolveCliConfigDirectory(undefined, environment)).toBe(
    path.resolve("environment-configs"),
  );
  expect(resolveCliConfigDirectory("../explicit-configs", environment)).toBe(
    path.resolve("../explicit-configs"),
  );
  expect(parseRunGameArgs([], environment)).toMatchObject({
    configDir: path.resolve("environment-configs"),
    gameName: "environment-game",
  });
  expect(
    parseRunGameArgs(
      ["--configs-dir", "../explicit-configs", "--game-config-name", "six_player_mvp"],
      environment,
    ),
  ).toMatchObject({ configDir: path.resolve("../explicit-configs"), gameName: "six_player_mvp" });
  // 显式参数或环境值为空时，仍应进入 loader 既有验证。
  expect(resolveCliConfigDirectory("", environment)).toBe("");
  expect(resolveCliConfigDirectory(undefined, { GAME_CONFIGS_DIR: "" })).toBe("");
});
