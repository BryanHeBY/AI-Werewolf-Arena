/**
 * Unit tests: Console rendering uses literal Hidden Wolf, Bear and public/private facts;
 * explicit bilingual lines and scalar-field assertions check privacy flags and neutral
 * announcements. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { fixtureResult } from "../../support/builders/recording/result";
import { TextLocalizationRegistry } from "../../../src/game/mechanisms/shared/text_localization_registry";
import { expect, test } from "bun:test";
import { Camp, Phase, PotionType, ActionWindow, type GameEvent } from "../../../src/domain";
import { getDefaultScriptEventRenderRegistry } from "../../../src/game/mechanisms";
import { presentStreamEvents, toChatLines } from "../../../src/runtime/console_presenter";
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";

const event = <K extends GameEvent["type"]>(
  type: K,
  payload: Extract<GameEvent, { type: K }>["payload"],
): Extract<GameEvent, { type: K }> =>
  ({ timestamp: 1, type, payload }) as Extract<GameEvent, { type: K }>;
const events: GameEvent[] = [
  event("hidden_wolf_awakened", { actorId: 1, day: 2 }),
  event("bear_roared", { day: 1, roared: true }),
  event("bear_roared", { day: 2, roared: false }),
  event("charm_applied", { actorId: 1, targetId: 2, day: 1 }),
  event("charm_applied", { actorId: 1, targetId: null, day: 2 }),
  event("charm_death", { actorId: 1, targetId: 2 }),
  event("charm_blocked", { actorId: 1, targetId: 2, reason: "night_protection" }),
  event("gravekeeper_reported", {
    actorId: 3,
    targetId: 1,
    exileDay: 1,
    receivedDay: 2,
    result: { kind: "camp", camp: "wolf" },
  }),
  event("knight_duel", { actorId: 1, targetId: 2, result: "wolf" }),
  event("knight_duel", { actorId: 1, targetId: 2, result: "not_wolf" }),
  event("god_private_game_info", {
    boardSize: 2,
    players: [
      { id: 1, seat: 1, name: "One", role: "wolf", camp: "wolf" },
      { id: 2, seat: 2, name: "Two", role: "seer", camp: "good" },
    ],
  }),
  ...[Phase.Night, Phase.Day, Phase.Voting].map((phase) =>
    event("phase_changed", { phase, day: 1 }),
  ),
  event("phase_changed", {
    phase: Phase.GameOver,
    day: 2,
    winner: Camp.Good,
    reason: "all_wolves_eliminated",
  }),
  event("night_resolved", { deaths: [] }),
  event("night_resolved", { deaths: [1, 2] }),
  event("day_speech", { actorId: 1, text: "Original speech" }),
  event("wolf_tactical_order", { order: [1, 2] }),
  event("wolf_discussion", { actorId: 1, text: "Original chat", round: 1, endChat: false }),
  event("wolf_discussion_ended", { actorId: 1, reason: "Original reason", round: 1 }),
  event("wolf_kill_vote_cast", { actorId: 1, targetId: 2, abstain: false }),
  event("wolf_kill_vote_cast", { actorId: 1, targetId: null, abstain: true }),
  event("wolf_kill_vote_cast", { actorId: 1, targetId: null, abstain: false }),
  event("guard_applied", { actorId: 1, targetId: 2, abstain: false }),
  event("guard_applied", { actorId: 1, targetId: null, abstain: true }),
  event("seer_checked", {
    actorId: 1,
    targetId: 2,
    isWerewolf: false,
    result: { kind: "camp", camp: "good" },
  }),
  event("seer_checked", {
    actorId: 1,
    targetId: 2,
    isWerewolf: true,
    result: { kind: "camp", camp: "wolf" },
  }),
  event("witch_potion_used", { actorId: 1, targetId: 2, potionType: PotionType.Heal }),
  event("witch_potion_used", { actorId: 1, targetId: 2, potionType: PotionType.Poison }),
  event("witch_potion_skipped", { actorId: 1, targetId: null, potionType: PotionType.None }),
  event("hunter_shot", { hunterId: 1, targetId: 2 }),
  event("idiot_revealed", { targetId: 1 }),
  event("last_words_granted", { playerId: 1, phase: Phase.Day, day: 1 }),
  event("last_words_spoken", {
    playerId: 1,
    phase: Phase.Day,
    day: 1,
    text: "Original last words",
  }),
  event("vote_summary", {
    votes: [
      { actorId: 1, targetId: 2, abstain: false, weight: 2 },
      { actorId: 2, targetId: null, abstain: true, weight: 0.5 },
    ],
    tally: { 2: 2 },
    target: 2,
  }),
  event("voted_out", { target: 2 }),
  event("wolf_self_destruct", { wolfId: 1, window: ActionWindow.OnPreVote }),
  event("sheriff_nomination_summary", { candidates: [1, 2] }),
  event("sheriff_nomination_summary", { candidates: [] }),
  event("sheriff_withdraw_summary", { withdrawn: [1] }),
  event("sheriff_withdraw_summary", { withdrawn: [] }),
  event("sheriff_candidates_finalized", { candidates: [2] }),
  event("sheriff_vote_cast", { actorId: 1, targetId: 2, abstain: false }),
  event("sheriff_vote_cast", { actorId: 1, targetId: null, abstain: true }),
  event("sheriff_vote_summary", {
    votes: [{ actorId: 1, targetId: 2, abstain: false }],
    winnerId: 2,
  }),
  event("sheriff_vote_summary", { votes: [], winnerId: null }),
  event("sheriff_badge_transferred", { fromId: 1, toId: 2, reason: "transfer" }),
  event("sheriff_badge_destroyed", { targetId: 1, reason: "destroyed" }),
  event("sheriff_direction_chosen", { sheriffId: 1, direction: "clockwise" }),
  event("sheriff_direction_chosen", { sheriffId: 1, direction: "counter_clockwise" }),
  event("game_over", fixtureResult(Camp.Good, "all_wolves_eliminated")),
  event("game_over", fixtureResult(null, "runtime_timeout")),
];

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Hidden Wolf acquisition remains private terminal information with scalar fields and a stable recording stage`, () => {
    const registry = getDefaultScriptEventRenderRegistry(),
      item = event("hidden_wolf_awakened", { actorId: 1, day: 2 }),
      label =
        locale === "en" ? "Hidden Wolf 1 inherits the knife on day 2" : "1号隐狼在第2天获得刀权";
    expect(registry.toJudgeLine(item, locale)).toBe(label);
    expect(registry.toLiveRender(item, true, locale)).toEqual([{ kind: "private", text: label }]);
    expect(registry.toLiveRender(item, false, locale)).toEqual([]);
    expect(registry.toReplayStage(item)).toBe("hidden_wolf_awakened");
    expect(toChatLines([item], locale)).toEqual([]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Bear positive/quiet announcements are public anonymous facts in both private flag modes`, () => {
    const registry = getDefaultScriptEventRenderRegistry(),
      rows = events.filter((e) => e.type === "bear_roared"),
      labels =
        locale === "en"
          ? ["Day 1: Bear roared", "Day 2: Bear did not roar"]
          : ["第1天：熊咆哮了", "第2天：熊没有咆哮"];
    for (const [index, row] of rows.entries()) {
      expect(registry.toJudgeLine(row, locale)).toBe(labels[index]);
      expect(registry.toLiveRender(row, false, locale)).toEqual([
        { kind: "system", text: labels[index] },
      ]);
      expect(registry.toLiveRender(row, true, locale)).toEqual([
        { kind: "system", text: labels[index] },
      ]);
      expect(registry.toReplayStage(row)).toBe("bear_roared");
    }
    expect(toChatLines(rows, locale)).toEqual([]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Beauty choice, death and protection remain explicit private terminal diagnostics with stable replay stages`, () => {
    const registry = getDefaultScriptEventRenderRegistry(),
      rows = events.filter((item) => item.type.startsWith("charm_")),
      expected =
        locale === "en"
          ? [
              "Wolf Beauty 1 chooses charm target 2 on night 1",
              "Wolf Beauty 1 chooses charm target None on night 2",
              "Player 2 dies through Wolf Beauty 1's charm",
              "Dream protection blocks Wolf Beauty 1's night charm death of player 2",
            ]
          : [
              "1号狼美人本夜魅惑目标：2（第1夜）",
              "1号狼美人本夜魅惑目标：无（第2夜）",
              "2号被1号狼美人牵连出局",
              "1号对2号的夜间魅惑牵连被梦保护阻止",
            ];
    for (const [idx, item] of rows.entries()) {
      expect(registry.toJudgeLine(item, locale)).toBe(expected[idx]);
      expect(registry.toLiveRender(item, true, locale)).toEqual([
        { kind: "private", text: expected[idx] },
      ]);
      expect(registry.toLiveRender(item, false, locale)).toEqual([]);
      expect(registry.toReplayStage(item)).toBe(item.type);
    }
    const lines: string[] = [];
    presentStreamEvents(rows, false, (line) => lines.push(line), locale);
    expect(lines).toEqual([]);
    expect(toChatLines(rows, locale)).toEqual([]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: passive Gravekeeper information is absent from public terminal/chat and only appears as an explicit private camp label`, () => {
    const report = event("gravekeeper_reported", {
        actorId: 3,
        targetId: 1,
        exileDay: 1,
        receivedDay: 2,
        result: { kind: "camp", camp: "wolf" },
      }),
      registry = getDefaultScriptEventRenderRegistry();
    const expected =
      locale === "en"
        ? "Gravekeeper 3 learns on night 2 that player 1, exiled on day 1, has camp label Werewolves"
        : "3号守墓人在第2夜获知第1日放逐1号的阵营标签：狼人";
    expect(registry.toJudgeLine(report, locale)).toBe(expected);
    expect(registry.toLiveRender(report, true, locale)).toEqual([
      { kind: "private", text: expected },
    ]);
    expect(registry.toLiveRender(report, false, locale)).toEqual([]);
    expect(toChatLines([report], locale)).toEqual([]);
    const lines: string[] = [];
    presentStreamEvents([report], false, (line) => lines.push(line), locale);
    expect(lines).toEqual([]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Knight terminal judge/live text declares exactly the duel loser without reclassifying a non-wolf`, () => {
    const registry = getDefaultScriptEventRenderRegistry();
    const hit =
      locale === "en"
        ? "Knight 1 duels player 2; the wolf target dies"
        : "1号骑士决斗2号，目标为狼并出局";
    const miss =
      locale === "en"
        ? "Knight 1 duels player 2; the non-wolf target survives and the Knight dies"
        : "1号骑士决斗2号，目标非狼存活，骑士出局";
    for (const [result, expected] of [
      ["wolf", hit],
      ["not_wolf", miss],
    ] as const) {
      const item = event("knight_duel", { actorId: 1, targetId: 2, result });
      expect(registry.toJudgeLine(item, locale)).toBe(expected);
      expect(registry.toLiveRender(item, false, locale)).toEqual([
        { kind: "system", text: expected },
      ]);
      expect(registry.toReplayStage(item)).toBe("knight_duel");
    }
  });

test("all existing console branches render English without changing event facts, stages or output kinds", () => {
  const registry = getDefaultScriptEventRenderRegistry();
  const before = structuredClone(events);
  for (const item of events) {
    const en = registry.toLiveRender(item, true, "en");
    const zh = registry.toLiveRender(item, true, "zh-CN");
    expect(en.map((line) => line.kind)).toEqual(zh.map((line) => line.kind));
    expect(JSON.stringify(en)).not.toMatch(/[\u4e00-\u9fff]/);
    const judge = registry.toJudgeLine(item, "en");
    const chat = registry.toChatLine(item, "en");
    if (judge) expect(judge).not.toMatch(/[\u4e00-\u9fff]/);
    if (chat) expect(chat).not.toMatch(/[\u4e00-\u9fff]/);
    expect(registry.toLiveRender(item, false, "en").map((line) => line.kind)).toEqual(
      registry.toLiveRender(item, false, "zh-CN").map((line) => line.kind),
    );
  }
  expect(events).toEqual(before);
  expect(registry.toReplayStage(event("day_speech", { actorId: 1, text: "raw" }))).toBe(
    "day_speech",
  );
  expect(
    registry.toReplayStage(
      event("wolf_kill_vote_cast", { actorId: 1, targetId: 2, abstain: false }),
    ),
  ).toBe("wolf_discussion"); // Existing recording mapping; I03 handles versioned IDs.
  expect(
    registry.toJudgeLine(
      events.find((item) => item.type === "vote_summary")!,
      "en",
    ),
  ).toContain("1->2(w=2)");
  expect(registry.toLiveRender(events.at(-1)!, true, "en")[0].text).toContain("No winner");
});

test("terminal wrappers honor their locale while speech, last words and wolf closing reason remain original", () => {
  const originals: GameEvent[] = [
    event("day_speech", { actorId: 1, text: "绿茶：人家觉得60% {id}" }),
    event("last_words_spoken", { playerId: 2, phase: Phase.Day, day: 1, text: "遗言原文" }),
    event("wolf_discussion_ended", { actorId: 1, reason: "我结束夜聊", round: 1 }),
  ];
  const before = structuredClone(originals);
  const lines: string[] = [];
  presentStreamEvents(originals, true, (line) => lines.push(line), "en");
  expect(lines).toEqual([
    "[live][Day][1] 绿茶：人家觉得60% {id}",
    "[live][Last words][2] 遗言原文",
    "[live][Wolf chat][End][1] 我结束夜聊",
  ]);
  expect(toChatLines(originals, "en")).toEqual([
    "[Day][1] 绿茶：人家觉得60% {id}",
    "[Wolf chat][End][1] 我结束夜聊",
  ]);
  expect(originals).toEqual(before);
});

test("broadcast queries use all shared role names, preserve explicit overrides and keep unknown IDs", () => {
  const registry = new TextLocalizationRegistry();
  for (const role of ROLE_DEFINITIONS) {
    expect(registry.roleName(role.id, "en")).toBe(role.names.en);
    expect(registry.roleName(role.id)).toBe(role.names["zh-CN"]);
  }
  expect(registry.roleName("historical_role", "en")).toBe("historical_role");
  expect(registry.gameOverReason("historical_reason", "en")).toBe("historical_reason");
  const custom = new TextLocalizationRegistry([
    { roleNames: { wolf: "专属名字" }, winnerNames: { wolf: "自定阵营" } },
  ]);
  expect(custom.roleName("wolf", "en")).toBe("专属名字");
  expect(custom.winnerName("wolf", "en")).toBe("自定阵营");
  expect(registry.roleName("wolf", "en")).toBe("Werewolf");
  expect(registry.roleName("wolf")).toBe("狼人");
});
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Gargoyle role inspection and inheritance stay private terminal diagnostics with stable recording stages`, () => {
    const registry = getDefaultScriptEventRenderRegistry(),
      rows = [
        event("role_inspected", {
          actorId: 1,
          targetId: 5,
          day: 1,
          result: { kind: "role", role: "seer" },
        }),
        event("gargoyle_awakened", { actorId: 1, day: 2 }),
      ],
      labels =
        locale === "en"
          ? ["Player 1 inspects player 5's role: Seer", "Gargoyle 1 inherits the knife on day 2"]
          : ["1号查验5号的具体角色：预言家", "1号石像鬼在第2天获得刀权"];
    for (const [index, row] of rows.entries()) {
      expect(registry.toJudgeLine(row, locale)).toBe(labels[index]);
      expect(registry.toLiveRender(row, false, locale)).toEqual([]);
      expect(registry.toLiveRender(row, true, locale)).toEqual([
        { kind: "private", text: labels[index] },
      ]);
      expect(registry.toReplayStage(row)).toBe(row.type);
    }
    expect(toChatLines(rows, locale)).toEqual([]);
    const lines: string[] = [];
    presentStreamEvents(rows, false, (line) => lines.push(line), locale);
    expect(lines).toEqual([]);
  });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: Spirit Seer passed/no-target diagnostics remain actor-private and do not enter public chat`, () => {
    const registry = getDefaultScriptEventRenderRegistry();
    for (const reason of ["passed", "no_targets"] as const) {
      const item = event("role_inspection_skipped", { actorId: 3, day: 2, reason }),
        label =
          locale === "en"
            ? `Player 3 ends the inspection opportunity on night 2: ${reason === "passed" ? "Passed" : "No eligible living targets"}`
            : `3号在第2夜结束查验机会：${reason === "passed" ? "主动跳过" : "没有可查验的存活目标"}`;
      expect(registry.toJudgeLine(item, locale)).toBe(label);
      expect(registry.toLiveRender(item, true, locale)).toEqual([{ kind: "private", text: label }]);
      expect(registry.toLiveRender(item, false, locale)).toEqual([]);
      expect(registry.toReplayStage(item)).toBe("role_inspection_skipped");
      expect(toChatLines([item], locale)).toEqual([]);
    }
  });
