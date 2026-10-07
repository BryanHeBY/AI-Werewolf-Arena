import { TextLocalizationRegistry } from "../../src/game/mechanisms/shared/text_localization_registry";
import { expect, test } from "bun:test";
import { Camp, Phase, PotionType, ActionWindow, type GameEvent } from "../../src/core";
import { getDefaultScriptEventRenderRegistry } from "../../src/game/mechanisms";
import { presentStreamEvents, toChatLines } from "../../src/runtime/console_presenter";
import { ROLE_DEFINITIONS } from "@ai-werewolf-arena/game-catalog";

const event = <K extends GameEvent["type"]>(type: K, payload: Extract<GameEvent, { type: K }>["payload"]): Extract<GameEvent, { type: K }> => ({ timestamp: 1, type, payload }) as Extract<GameEvent, { type: K }>;
const events: GameEvent[] = [
  event("god_private_game_info", { boardSize: 2, players: [{ id: 1, seat: 1, name: "One", role: "wolf", camp: "wolf" }, { id: 2, seat: 2, name: "Two", role: "seer", camp: "good" }] }),
  ...[Phase.Night, Phase.Day, Phase.Voting].map(phase => event("phase_changed", { phase, day: 1 })),
  event("phase_changed", { phase: Phase.GameOver, day: 2, winner: Camp.Good, reason: "all_wolves_eliminated" }),
  event("night_resolved", { deaths: [] }), event("night_resolved", { deaths: [1, 2] }),
  event("day_speech", { actorId: 1, text: "Original speech" }),
  event("wolf_tactical_order", { order: [1, 2] }), event("wolf_discussion", { actorId: 1, text: "Original chat", round: 1, endChat: false }),
  event("wolf_discussion_ended", { actorId: 1, reason: "Original reason", round: 1 }),
  event("wolf_kill_vote_cast", { actorId: 1, targetId: 2, abstain: false }), event("wolf_kill_vote_cast", { actorId: 1, targetId: null, abstain: true }), event("wolf_kill_vote_cast", { actorId: 1, targetId: null, abstain: false }),
  event("guard_applied", { actorId: 1, targetId: 2, abstain: false }), event("guard_applied", { actorId: 1, targetId: null, abstain: true }),
  event("seer_checked", { actorId: 1, targetId: 2, isWerewolf: false }), event("seer_checked", { actorId: 1, targetId: 2, isWerewolf: true }),
  event("witch_potion_used", { actorId: 1, targetId: 2, potionType: PotionType.Heal }), event("witch_potion_used", { actorId: 1, targetId: 2, potionType: PotionType.Poison }),
  event("witch_potion_skipped", { actorId: 1, targetId: null, potionType: PotionType.None }),
  event("hunter_shot", { hunterId: 1, targetId: 2 }), event("idiot_revealed", { targetId: 1 }),
  event("last_words_granted", { playerId: 1, phase: Phase.Day, day: 1 }), event("last_words_spoken", { playerId: 1, phase: Phase.Day, day: 1, text: "Original last words" }),
  event("vote_summary", { votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 2 }, { actorId: 2, targetId: null, abstain: true, weight: 0.5 }], tally: { 2: 2 }, target: 2 }),
  event("voted_out", { target: 2 }), event("wolf_self_destruct", { wolfId: 1, window: ActionWindow.OnPreVote }),
  event("sheriff_nomination_summary", { candidates: [1, 2] }), event("sheriff_nomination_summary", { candidates: [] }),
  event("sheriff_withdraw_summary", { withdrawn: [1] }), event("sheriff_withdraw_summary", { withdrawn: [] }), event("sheriff_candidates_finalized", { candidates: [2] }),
  event("sheriff_vote_cast", { actorId: 1, targetId: 2, abstain: false }), event("sheriff_vote_cast", { actorId: 1, targetId: null, abstain: true }),
  event("sheriff_vote_summary", { votes: [{ actorId: 1, targetId: 2, abstain: false }], winnerId: 2 }), event("sheriff_vote_summary", { votes: [], winnerId: null }),
  event("sheriff_badge_transferred", { fromId: 1, toId: 2, reason: "transfer" }), event("sheriff_badge_destroyed", { targetId: 1, reason: "destroyed" }),
  event("sheriff_direction_chosen", { sheriffId: 1, direction: "clockwise" }), event("sheriff_direction_chosen", { sheriffId: 1, direction: "counter_clockwise" }),
  event("game_over", { winner: Camp.Good, reason: "all_wolves_eliminated" }), event("game_over", { winner: null, reason: "runtime_timeout" }),
];

test("all existing console branches render English without changing event facts, stages or output kinds", () => {
  const registry = getDefaultScriptEventRenderRegistry(); const before = structuredClone(events);
  for (const item of events) {
    const en = registry.toLiveRender(item, true, "en"); const zh = registry.toLiveRender(item, true, "zh-CN");
    expect(en.map(line => line.kind)).toEqual(zh.map(line => line.kind));
    expect(JSON.stringify(en)).not.toMatch(/[\u4e00-\u9fff]/);
    const judge = registry.toJudgeLine(item, "en"); const chat = registry.toChatLine(item, "en");
    if (judge) expect(judge).not.toMatch(/[\u4e00-\u9fff]/); if (chat) expect(chat).not.toMatch(/[\u4e00-\u9fff]/);
    expect(registry.toLiveRender(item, false, "en").map(line => line.kind)).toEqual(registry.toLiveRender(item, false, "zh-CN").map(line => line.kind));
  }
  expect(events).toEqual(before);
  expect(registry.toReplayStage(event("day_speech", { actorId: 1, text: "raw" }))).toBe("day_speech");
  expect(registry.toReplayStage(event("wolf_kill_vote_cast", { actorId: 1, targetId: 2, abstain: false }))).toBe("wolf_discussion"); // Existing recording mapping; I03 handles versioned IDs.
  expect(registry.toJudgeLine(events.find(item => item.type === "vote_summary")!, "en")).toContain("1->2(w=2)");
  expect(registry.toLiveRender(events.at(-1)!, true, "en")[0].text).toContain("Winner=None");
});

test("terminal wrappers honor their locale while speech, last words and wolf closing reason remain original", () => {
  const originals: GameEvent[] = [event("day_speech", { actorId: 1, text: "绿茶：人家觉得60% {id}" }), event("last_words_spoken", { playerId: 2, phase: Phase.Day, day: 1, text: "遗言原文" }), event("wolf_discussion_ended", { actorId: 1, reason: "我结束夜聊", round: 1 })];
  const before = structuredClone(originals); const lines: string[] = [];
  presentStreamEvents(originals, true, line => lines.push(line), "en");
  expect(lines).toEqual(["[live][Day][1] 绿茶：人家觉得60% {id}", "[live][Last words][2] 遗言原文", "[live][Wolf chat][End][1] 我结束夜聊"]);
  expect(toChatLines(originals, "en")).toEqual(["[Day][1] 绿茶：人家觉得60% {id}", "[Wolf chat][End][1] 我结束夜聊"]);
  expect(originals).toEqual(before);
});

test("broadcast queries use all shared role names, preserve explicit overrides and keep unknown IDs", () => {
  const registry = new TextLocalizationRegistry();
  for (const role of ROLE_DEFINITIONS) { expect(registry.roleName(role.id, "en")).toBe(role.names.en); expect(registry.roleName(role.id)).toBe(role.names["zh-CN"]); }
  expect(registry.roleName("historical_role", "en")).toBe("historical_role");
  expect(registry.gameOverReason("historical_reason", "en")).toBe("historical_reason");
  const custom = new TextLocalizationRegistry([{ roleNames: { wolf: "专属名字" }, winnerNames: { wolf: "自定阵营" } }]);
  expect(custom.roleName("wolf", "en")).toBe("专属名字"); expect(custom.winnerName("wolf", "en")).toBe("自定阵营");
  expect(registry.roleName("wolf", "en")).toBe("Werewolf"); expect(registry.roleName("wolf")).toBe("狼人");
});
