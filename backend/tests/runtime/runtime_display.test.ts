import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { cliFailure, takeDisplayArguments } from "../../src/runtime/cli/display";
import { LlmObserver } from "../../src/ai/agents/llm/llm_observer";
import { createAcpConsoleLogger } from "../../src/runtime/console_presenter";
import { BaselineBotActionProvider } from "../../src/ai/agents/providers/action_providers";
import { bootstrapGame } from "../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { Phase, Role, type ActionRequest } from "../../src/core";
import { createTestTempDirectory } from "../support/temp_directory";
import { migrateBoardSource, migrateBoards } from "../../src/runtime/cli/migrate_configs";
import { MIGRATION_WARNING_CODES } from "../../src/runtime/config/migrate_board";

const speech = "Original 原话 {role} <b>quoted</b>";
const request: ActionRequest = { actorId: 1, phase: Phase.Day, allowedTools: ["speak"], context: { day: 1, stage: "day_speech", visible_events: [] } };
async function command(file: string, args: string[]) {
  const child = Bun.spawn([Bun.env.BUN_RUNTIME_EXECUTABLE ?? "bun", path.resolve(import.meta.dir, `../../src/runtime/cli/${file}`), ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, code };
}
async function configFixture(locale: Locale) {
  const root = await createTestTempDirectory("awa-cli-locale-");
  await fs.mkdir(path.join(root, "runtime")); await fs.mkdir(path.join(root, "games")); await fs.mkdir(path.join(root, "boards"));
  await fs.writeFile(path.join(root, "runtime/providers.json"), JSON.stringify({ default: "test", items: { test: { type: "openai", apiKey: "credential-canary" } } }));
  await fs.writeFile(path.join(root, "runtime/agents.json"), JSON.stringify({ default: "test", items: { test: { kind: "llm", provider: "test", model: "synthetic" } } }));
  await fs.writeFile(path.join(root, "games/default.json"), JSON.stringify({ board: "six_player_mvp", locale, players: { "1": { name: "Original 原名", personalityPrompt: { [locale === "en" ? "zh-CN" : "en"]: "private-persona-canary" } } } }));
  await fs.copyFile(path.resolve(process.cwd(), "../configs.example/boards/six_player_mvp.json"), path.join(root, "boards/six_player_mvp.json"));
  return root;
}

test("each CLI invocation owns display selection and safe failure explanation", () => {
  const first = { locale: "zh-CN" as Locale, explicit: false }, second = { locale: "zh-CN" as Locale, explicit: false };
  expect(takeDisplayArguments(["--display-locale", "en", "--board", "six"], first)).toEqual(["--board", "six"]);
  expect(first).toEqual({ locale: "en", explicit: true }); expect(second.locale).toBe("zh-CN");
  expect(() => takeDisplayArguments(["--display-locale", "credential-canary"], second)).toThrow("runtime_cli_locale_invalid");
  for (const locale of ["zh-CN", "en"] as const) {
    for (const code of ["reproduction_schema_not_supported", "reproduction_record_invalid"]) {
      const failure = cliFailure(new Error(code), locale); expect(failure.code).toBe(code);
      expect(failure.message).toContain(locale === "en" ? "Action reproduction failed" : "动作回放失败");
    }
    const foreign = Object.defineProperty(new Error(), "message", { get() { throw new Error("credential-canary"); } });
    expect(JSON.stringify(cliFailure(foreign, locale))).not.toContain("credential-canary");
    expect(cliFailure(new Error("reproduction_credential_canary"), locale).code).toBe("command_failed");
  }
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: observation labels preserve message roles, tools and original content`, () => {
  const lines: string[] = [], before = console.log; console.log = (...values) => { lines.push(values.join(" ")); };
  const observer = new LlmObserver({ trace: true, locale, printLlmIo: true, printThinking: true, colorizeLogs: false });
  try {
    observer.prompt([{ role: "system", content: speech }, { role: "tool", content: speech }, { role: "developer", content: speech } as never], request);
    observer.trace("request_start player=1 phase=day");
    observer.rawResponse(speech, request);
    observer.thinking([{ assistantText: speech, toolCalls: [{ id: "c1", name: "submit_action", rawArgs: JSON.stringify({ text: speech }), toolResult: "{\"ok\":true}" }] }], request);
    const acp = createAcpConsoleLogger(1, line => lines.push(line), locale);
    acp({ sessionUpdate: "agent_thought_chunk", content: { text: speech } });
    acp({ sessionUpdate: "tool_call", toolCallId: "c1", title: "submit_action" });
    acp({ sessionUpdate: "tool_call_update", toolCallId: "c1", status: "completed" }); acp.flush();
  } finally { console.log = before; }
  expect(lines.join("\n")).toContain(speech); expect(lines.join("\n")).toContain("prompt_tool");
  expect(lines.join("\n")).toContain("prompt_developer · developer");
  expect(lines.join("\n")).toContain("phase=day"); expect(lines.join("\n")).toContain("submit_action");
  expect(lines.join("\n")).toContain(locale === "en" ? "Tool feedback" : "工具反馈");
  expect(lines.join("\n")).toContain(locale === "en" ? "Tool call completed" : "工具调用完成");
});

test("baseline builtin speech follows game locale while targets and skill decisions stay equivalent", async () => {
  const options = { fixedRoles: [Role.Wolf, Role.Seer, Role.Wolf, Role.Guard, Role.Villager, Role.Villager] };
  const zh = new BaselineBotActionProvider(bootstrapGame(sixPlayerMvpConfig, { ...options, locale: "zh-CN" }).world);
  const en = new BaselineBotActionProvider(bootstrapGame(sixPlayerMvpConfig, { ...options, locale: "en" }).world);
  expect(await zh.getAction(request)).toEqual({ name: "speak", args: { text: "我是1号，先听后位发言再判断。" } });
  expect(await en.getAction(request)).toEqual({ name: "speak", args: { text: "I am player 1; I will listen to the remaining speakers before deciding." } });
  expect(await en.getAction({ ...request, context: { ...request.context, trigger: "last_words" } })).toEqual({ name: "speak", args: { text: "Last words: I am player 1; use my final information as a reference." } });
  const chat = { ...request, phase: Phase.Night, allowedTools: ["speak_to_wolves"] as const };
  expect(await en.getAction({ ...chat, allowedTools: [...chat.allowedTools] })).toEqual({ name: "speak_to_wolves", args: { text: "Prioritize an information role for tonight’s kill.", end_chat: false } });
  for (const allowedTools of [["kill_vote"], ["choose_direction"], ["run_for_sheriff"], ["vote"]] as const) {
    const turn = { ...request, phase: allowedTools[0] === "vote" ? Phase.Voting : Phase.Night, allowedTools: [...allowedTools] };
    expect(await zh.getAction(turn)).toEqual(await en.getAction(turn));
  }
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: actual config CLI displays structured prompt fallback and keeps private values out`, async () => {
  const root = await configFixture(locale);
  const result = await command("check_config.ts", ["--configs-dir", root]); expect(result.code).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.context.locale).toBe(locale); expect(report.players["1"].name).toBe("Original 原名");
  expect(report.warnings).toEqual([{ code: "locale_prompt_fallback", path: "players.1.personalityPrompt", requestedLocale: locale, fallbackLocale: locale === "en" ? "zh-CN" : "en" }]);
  expect(report.warningMessages[0]).toContain(locale === "en" ? "using zh-CN" : "已回退到 en");
  expect(result.stdout).not.toContain("credential-canary"); expect(result.stdout).not.toContain("private-persona-canary");
  const opposite = locale === "en" ? "zh-CN" : "en";
  const displayed = await command("check_config.ts", ["--configs-dir", root, "--display-locale", opposite]);
  const other = JSON.parse(displayed.stdout); expect(other.context.locale).toBe(locale); expect(other.warnings).toEqual(report.warnings);
  expect(other.message).toBe(opposite === "en" ? "Configuration validation completed." : "配置检查完成。");
});

test("actual command parse/load failures are bilingual safe JSON without uncaught stacks", async () => {
  for (const [file, args, expected] of [
    ["run_game.ts", ["--unknown", "private-token-canary"], "runtime_cli_option_unknown"],
    ["check_config.ts", ["--unknown", "private-token-canary"], "config_check_usage"],
    ["migrate_configs.ts", ["--unknown", "private-token-canary"], "config_migration_usage"],
    ["replay_actions.ts", [], "reproduction_cli_usage"],
    ["simulate.ts", ["--count", "0"], "simulation_count_invalid"],
    ["../../replay/export_replay_bundle.ts", [], "replay_export_usage"],
    ["../../run-game-smoke.ts", ["--unknown", "private-token-canary"], "runtime_cli_option_unknown"],
  ] as const) for (const locale of ["zh-CN", "en"] as const) {
    const result = await command(file, [...args, "--display-locale", locale]); expect(result.code).toBe(1);
    const report = JSON.parse(result.stderr); expect(report.code).toBe(expected); expect(report.message).toBeTruthy();
    if (locale === "en") expect(report.message).not.toMatch(/[\u4e00-\u9fff]/);
    expect(result.stderr).not.toContain("private-token-canary"); expect(result.stderr).not.toContain(" at ");
  }
});

test("all migration warning keys are bilingual and valid preview/apply reports are built before publication", async () => {
  for (const locale of ["zh-CN", "en"] as const) {
    for (const code of MIGRATION_WARNING_CODES) expect(text(locale, `config.warning.${code}`)).toBeTruthy();
    const root = await createTestTempDirectory("awa-migration-display-");
    const source = path.join(root, "old.json"), original = '{"enableSheriff":false}'; await fs.writeFile(source, original);
    const lines: string[] = [], before = console.log; console.log = value => { lines.push(String(value)); };
    try {
      await migrateBoardSource(root, "six_player_mvp", source, undefined, false, locale);
      expect(await fs.readFile(source, "utf8")).toBe(original); expect(await Bun.file(`${source}.v1.bak`).exists()).toBe(false);
      const preview = JSON.parse(lines[0]); expect(preview.mode).toBe("preview"); expect(preview.warningMessages).toHaveLength(1);
      await migrateBoardSource(root, "six_player_mvp", source, undefined, true, locale);
      expect(JSON.parse(await fs.readFile(path.join(root, "boards/six_player_mvp.json"), "utf8")).version).toBe(2);
      expect(await fs.readFile(`${source}.v1.bak`, "utf8")).toBe(original); expect(JSON.parse(lines[1]).mode).toBe("apply");
      await migrateBoards(root, false, locale); expect(JSON.parse(lines[2]).changes).toEqual([]);
      const badRoot = await createTestTempDirectory("awa-migration-display-fail-"); const badSource = path.join(badRoot, "old.json"); await fs.writeFile(badSource, original);
      await expect(migrateBoardSource(badRoot, "six_player_mvp", badSource, undefined, true, "invalid" as Locale)).rejects.toThrow("i18n_locale_invalid");
      expect(await Bun.file(path.join(badRoot, "boards/six_player_mvp.json")).exists()).toBe(false);
      expect(await Bun.file(`${badSource}.v1.bak`).exists()).toBe(false); expect(await fs.readFile(badSource, "utf8")).toBe(original);
      await fs.mkdir(path.join(badRoot, "boards")); const bulkSource = path.join(badRoot, "boards/six_player_mvp.json"); await fs.writeFile(bulkSource, original);
      await expect(migrateBoards(badRoot, true, "invalid" as Locale)).rejects.toThrow("i18n_locale_invalid");
      expect(await fs.readFile(bulkSource, "utf8")).toBe(original); expect(await Bun.file(`${bulkSource}.v1.bak`).exists()).toBe(false);
    } finally { console.log = before; }
  }
});

test("bilingual party example resolves every named seat without missing-language fallback", async () => {
  const { parseRuntimeConfig } = await import("../../src/runtime/config/parse_config");
  const { resolveGameSetup } = await import("../../src/runtime/config/resolve_game_setup");
  const game = JSON.parse(await fs.readFile(path.resolve(process.cwd(), "../configs.example/games/twelve_player_fun.json"), "utf8"));
  for (const locale of ["zh-CN", "en"] as const) {
    const setup = resolveGameSetup(parseRuntimeConfig({
      providers: { default: "synthetic", items: { synthetic: { type: "acp", transport: "stdio", command: "synthetic-adapter" } } },
      agents: { default: "acp_default", items: { acp_default: { kind: "acp", provider: "synthetic" } } },
      game: { ...game, locale },
    }));
    expect(setup.warnings).toEqual([]); expect(Object.keys(setup.players)).toHaveLength(12);
    for (const [seat, entry] of Object.entries(setup.players)) {
      expect(entry.name).toBe(game.players[seat].name); expect(entry.personalityPrompt).toBe(game.players[seat].personalityPrompt[locale]);
      expect(entry.personalityPrompt).toContain(locale === "en" ? "playful game" : "欢乐局");
    }
    expect(new Set(Object.values(setup.players).map(entry => entry.personalityPrompt)).size).toBe(12);
  }
});
