/**
 * Unit tests: CLI config-directory resolution uses literal cwd/environment/argument paths;
 * exact precedence and project-root assertions check pure path selection without loading
 * private configuration. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { resolveCliConfigDirectory } from "../../../src/app/cli/config-directory";
import { parseRunGameArgs } from "../../../src/app/cli/run-game";

test("the default config directory is the project directory from root and backend cwd", () => {
  const root = path.resolve(__dirname, "../../../..");
  const helper = path.join(root, "backend/src/app/cli/config-directory.ts");
  for (const cwd of [root, path.join(root, "backend")]) {
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
  expect(resolveCliConfigDirectory(undefined, environment)).toBe("environment-configs");
  expect(resolveCliConfigDirectory("../explicit-configs", environment)).toBe("../explicit-configs");
  expect(parseRunGameArgs([], environment)).toMatchObject({
    configDir: "environment-configs",
    gameName: "environment-game",
  });
  expect(
    parseRunGameArgs(
      ["--configs-dir", "../explicit-configs", "--game-config-name", "six_player_mvp"],
      environment,
    ),
  ).toMatchObject({ configDir: "../explicit-configs", gameName: "six_player_mvp" });
  // Empty explicit/environment values must reach the loader's existing validation.
  expect(resolveCliConfigDirectory("", environment)).toBe("");
  expect(resolveCliConfigDirectory(undefined, { GAME_CONFIGS_DIR: "" })).toBe("");
});
