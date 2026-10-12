/**
 * Native CLI integration tests verify actual configuration commands keep safe bilingual failure and prompt fallback reports.
 * Input: Original finite command/argument matrix, temporary synthetic config files and public example copy.
 * Output and oracle: Exact process status, redacted structured reports, locale fallback and no stack assertions retain original subprocess behavior; no billed model or private credential is used.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { type Locale } from "@ai-werewolf-arena/game-text";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

async function command(file: string, args: string[]) {
  const child = Bun.spawn(
    [
      Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun",
      path.resolve(import.meta.dir, `../../../src/runtime/cli/${file}`),
      ...args,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

async function configFixture(locale: Locale) {
  const root = await createTestTempDirectory("awa-cli-locale-");
  await fs.mkdir(path.join(root, "runtime"));
  await fs.mkdir(path.join(root, "games"));
  await fs.mkdir(path.join(root, "boards"));
  await fs.writeFile(
    path.join(root, "runtime/providers.json"),
    JSON.stringify({
      default: "test",
      items: { test: { type: "openai", apiKey: "credential-canary" } },
    }),
  );
  await fs.writeFile(
    path.join(root, "runtime/agents.json"),
    JSON.stringify({
      default: "test",
      items: { test: { kind: "llm", provider: "test", model: "synthetic" } },
    }),
  );
  await fs.writeFile(
    path.join(root, "games/default.json"),
    JSON.stringify({
      board: "six_player_mvp",
      locale,
      players: {
        "1": {
          name: "Original 原名",
          personalityPrompt: { [locale === "en" ? "zh-CN" : "en"]: "private-persona-canary" },
        },
      },
    }),
  );
  await fs.copyFile(
    path.resolve(process.cwd(), "../configs.example/boards/six_player_mvp.json"),
    path.join(root, "boards/six_player_mvp.json"),
  );
  return root;
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual config CLI displays structured prompt fallback and keeps private values out`, async () => {
    const root = await configFixture(locale);
    const result = await command("check_config.ts", ["--configs-dir", root]);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.context.locale).toBe(locale);
    expect(report.players["1"].name).toBe("Original 原名");
    expect(report.warnings).toEqual([
      {
        code: "locale_prompt_fallback",
        path: "players.1.personalityPrompt",
        requestedLocale: locale,
        fallbackLocale: locale === "en" ? "zh-CN" : "en",
      },
    ]);
    expect(report.warningMessages[0]).toContain(locale === "en" ? "using zh-CN" : "已回退到 en");
    expect(result.stdout).not.toContain("credential-canary");
    expect(result.stdout).not.toContain("private-persona-canary");
    const opposite = locale === "en" ? "zh-CN" : "en";
    const displayed = await command("check_config.ts", [
      "--configs-dir",
      root,
      "--display-locale",
      opposite,
    ]);
    const other = JSON.parse(displayed.stdout);
    expect(other.context.locale).toBe(locale);
    expect(other.warnings).toEqual(report.warnings);
    expect(other.message).toBe(
      opposite === "en" ? "Configuration validation completed." : "配置检查完成。",
    );
  });

test("actual command parse/load failures are bilingual safe JSON without uncaught stacks", async () => {
  for (const [file, args, expected] of [
    ["run_game.ts", ["--unknown", "private-token-canary"], "runtime_cli_option_unknown"],
    ["check_config.ts", ["--unknown", "private-token-canary"], "config_check_usage"],
    ["migrate_configs.ts", ["--unknown", "private-token-canary"], "config_migration_usage"],
    ["replay_actions.ts", [], "reproduction_cli_usage"],
    ["simulate.ts", ["--count", "0"], "simulation_count_invalid"],
    ["../../replay/export_replay_bundle.ts", [], "replay_export_usage"],
    [
      "../../run-game-smoke.ts",
      ["--unknown", "private-token-canary"],
      "runtime_cli_option_unknown",
    ],
  ] as const)
    for (const locale of ["zh-CN", "en"] as const) {
      const result = await command(file, [...args, "--display-locale", locale]);
      expect(result.code).toBe(1);
      const report = JSON.parse(result.stderr);
      expect(report.code).toBe(expected);
      expect(report.message).toBeTruthy();
      if (locale === "en") expect(report.message).not.toMatch(/[\u4e00-\u9fff]/);
      expect(result.stderr).not.toContain("private-token-canary");
      expect(result.stderr).not.toContain(" at ");
    }
});
