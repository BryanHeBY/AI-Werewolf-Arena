/**
 * 定向核对新建预算、缺省编辑和更换板子的保护语义；使用手写目录与真实解析器，不创建文件或调用模型。
 * 渲染断言检查用户实际看到的值和来源，避免只证明 helper 与自己的常量相等。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseRuntimeConfig } from "@ai-werewolf-arena/game-runtime/config/parse";
import { resolveGameSetup } from "@ai-werewolf-arena/game-runtime/config/resolve";
import type { BoardCard, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { workbenchText } from "@ai-werewolf-arena/game-text/workbench";
import type { Catalog, Translator } from "../../src/client/types";
import { GameForm } from "../../src/client/GameForm";
import { GameSummary } from "../../src/client/GameSummary";
import {
  createGameDraft,
  effectiveGameSettings,
  inapplicableGameBindings,
  removeInapplicableGameBindings,
  updateGameField,
} from "../../src/client/game-config";

const board: BoardCard = {
  id: "six_player_mvp",
  size: 6,
  source: "local",
  supported: true,
  roles: [
    { role: "wolf", count: 2 },
    { role: "villager", count: 2 },
    { role: "seer", count: 1 },
    { role: "witch", count: 1 },
  ],
};
const catalog: Catalog = {
  boards: [board],
  games: [],
  backends: [],
  defaultAgent: "synthetic",
  agents: [{ name: "synthetic", backend: "synthetic", kind: "llm", model: "synthetic" }],
};
const t: Translator = (key) => workbenchText("zh-CN", key);
const runtime = {
  backends: {
    schemaVersion: 2,
    items: { synthetic: { kind: "llm", config: { type: "openai", apiKey: "synthetic-only" } } },
  },
  agents: {
    schemaVersion: 2,
    default: "synthetic",
    items: { synthetic: { backend: "synthetic", options: { model: "synthetic" } } },
  },
};

test("new games explicitly save a complete-game budget and ignore stale board selections", () => {
  const raw = createGameDraft(catalog, "removed_board");
  expect(raw).toMatchObject({
    board: "six_player_mvp",
    agent: "synthetic",
    maxDays: 10,
    maxRuntimeMs: 7_200_000,
    llmTimeoutMs: 180_000,
    streamEvents: true,
    printThinking: true,
    printPrivateEvents: false,
  });
  const html = renderToStaticMarkup(
    <GameForm raw={raw} change={() => {}} catalog={catalog} t={t} locale="zh-CN" />,
  );
  expect(html).toContain('aria-label="最多天数" type="number" min="1" step="1" value="10"');
  expect(html).toMatch(/aria-label="整局时限（分钟）"[^>]*value="120"/);
  expect(html).toMatch(/aria-label="单次玩家行动时限（秒）"[^>]*value="180"/);
  expect(html).toContain("适用于 LLM、Pi 和 ACP");
});

test("omitted fields render exactly the real resolver defaults without writing them into the draft", () => {
  const raw = { board: "six_player_mvp" },
    before = structuredClone(raw);
  const setup = resolveGameSetup(parseRuntimeConfig({ ...runtime, game: raw }));
  const effective = effectiveGameSettings(raw);
  for (const field of [
    "maxDays",
    "maxRuntimeMs",
    "llmTimeoutMs",
    "streamEvents",
    "printThinking",
    "printPrivateEvents",
  ] as const)
    expect(effective[field]).toBe(setup.options[field]);
  const html = renderToStaticMarkup(
    <GameForm raw={raw} change={() => {}} catalog={catalog} t={t} locale="zh-CN" />,
  );
  expect(html).toMatch(/aria-label="整局时限（分钟）"[^>]*value="0.5"/);
  expect(html).toMatch(/aria-label="单次玩家行动时限（秒）"[^>]*value="30"/);
  expect(html).toMatch(/type="checkbox" aria-label="实时事件"[^>]*checked=""/);
  expect(html).toMatch(/type="checkbox" aria-label="显示上帝私有事件"[^>]*checked=""/);
  expect(html).not.toMatch(/type="checkbox" aria-label="显示思考"[^>]*checked=""/);
  expect(html).toContain("使用全局默认 Agent: synthetic");
  expect(raw).toEqual(before);
});

test("switching boards preserves unsupported entries visibly until an explicit cleanup", () => {
  const raw: JsonObject = {
    board: "six_player_mvp",
    agent: "synthetic",
    roles: {
      knight: { agent: "synthetic", customInstructions: { text: "Keep this until confirmed" } },
      seer: { customInstructions: { text: "Check carefully" } },
    },
    players: {
      "12": { name: "Outside", customInstructions: { mode: "clear" } },
      "2": { name: "Inside" },
    },
    extension: { keep: true },
  };
  const before = structuredClone(raw);
  expect(inapplicableGameBindings(raw, board)).toEqual({ roles: ["knight"], players: ["12"] });
  const html = renderToStaticMarkup(
    <GameForm raw={raw} change={() => {}} catalog={catalog} t={t} locale="zh-CN" />,
  );
  expect(html).toContain("存在不适用于当前板子的设置");
  expect(html).toContain("骑士");
  expect(html).toContain("12");
  expect(html).toContain("清理这些不适用设置");
  expect(raw).toEqual(before);
  expect(removeInapplicableGameBindings(raw, board)).toEqual({
    ...raw,
    roles: { seer: { customInstructions: { text: "Check carefully" } } },
    players: { "2": { name: "Inside" } },
  });
  expect(() =>
    resolveGameSetup(
      parseRuntimeConfig({ ...runtime, game: removeInapplicableGameBindings(raw, board) }),
    ),
  ).toThrow("runtime_config_unknown_field");
  // 未展示扩展仍保留，是否支持交由真实 parser 判断；去掉扩展后，绑定清理的结果可正常解析。
  const cleaned = removeInapplicableGameBindings(raw, board);
  delete cleaned.extension;
  expect(() => resolveGameSetup(parseRuntimeConfig({ ...runtime, game: cleaned }))).not.toThrow();
});

test("restoring a binding removes only its empty shell and preserves other player settings", () => {
  expect(
    updateGameField(
      { roles: { knight: { agent: "synthetic" } }, players: { "1": { name: "Miao" } } },
      "roles.knight.agent",
      undefined,
    ),
  ).toEqual({ players: { "1": { name: "Miao" } } });
  expect(
    updateGameField(
      { players: { "1": { name: "Miao", agent: "synthetic" } } },
      "players.1.agent",
      undefined,
    ),
  ).toEqual({ players: { "1": { name: "Miao" } } });
});

test("saved details expose budgets, names, instruction modes, language and effective log switches", () => {
  const html = renderToStaticMarkup(
    <GameSummary
      raw={{
        ...createGameDraft(catalog),
        locale: "en",
        customInstructions: { text: "Have fun" },
        players: { "1": { name: "Miao", customInstructions: { mode: "clear" } } },
      }}
      catalog={catalog}
      locale="zh-CN"
      t={t}
    />,
  );
  for (const text of [
    "最多天数",
    "120",
    "180",
    "Miao",
    "Have fun",
    "清空上级附加指令",
    "en",
    "显示思考",
    "显示上帝私有事件",
    "关闭",
  ])
    expect(html).toContain(text);
});

test("English fields explain inheritance and missing agent references explicitly", () => {
  const html = renderToStaticMarkup(
    <GameForm
      raw={{ ...createGameDraft(catalog), agent: "removed_agent" }}
      change={() => {}}
      catalog={catalog}
      locale="en"
      t={(key) => workbenchText("en", key)}
    />,
  );
  expect(html).toContain("Missing agent reference");
  expect(html).toContain("removed_agent");
  expect(html).toContain("Applies to LLM, Pi and ACP");
  expect(html).toContain("Custom instructions have separate append, replace and clear rules");
  expect(html).toContain("Use the dealt role&#x27;s agent, otherwise the game default");
});
