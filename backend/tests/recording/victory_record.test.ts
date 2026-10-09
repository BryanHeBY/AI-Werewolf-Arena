import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { ReplaySessionAggregate } from "../../src/recording/session_aggregate";
import { createReplayDocument } from "../../src/recording/replay_document";
import { readReplayDocument, readVictoryResult } from "@ai-werewolf-arena/replay-contract";
import { Camp, Phase, type GameResult } from "../../src/core";
import { outcomeLabel, outcomeWinnersLabel, victoryPointLabel } from "@ai-werewolf-arena/game-text";
import { getDefaultScriptEventRenderRegistry } from "../../src/game";
import { auditSummaryHeader } from "../../src/audit/summary_format";
import { createTestTempDirectory } from "../support/temp_directory";

const players = [1, 2, 3, 4, 5, 6].map(id => ({ player_id: id, role: id === 1 || id === 4 ? "wolf" : "villager", camp: id === 1 || id === 4 ? "wolf" : "good", alive: id !== 3, name: `Raw name ${id}` }));
const decision = (kind: "faction" | "individual" | "relationship" | "multiple" | "no_winner"): GameResult => ({
  winner: kind === "faction" ? Camp.Good : null, reason: kind === "no_winner" ? "max_days_reached" : "scenario_win",
  outcome: kind === "no_winner" ? { kind } : { kind: "victory", primary: kind === "faction" ? { kind, faction: "good", winningPlayerIds: [2, 3, 5, 6] } : kind === "relationship" ? { kind, groupId: "scenario_pair", winningPlayerIds: [2, 3] } : { kind: "individual", playerId: 5, goalId: "scenario_solo", winningPlayerIds: [5] }, additional: kind === "multiple" ? [{ kind: "faction", faction: "wolf", winningPlayerIds: [1, 4] }] : [], winningPlayerIds: kind === "faction" ? [2, 3, 5, 6] : kind === "relationship" ? [2, 3] : kind === "multiple" ? [1, 4, 5] : [5] },
  decidedAt: { day: 2, phase: kind === "no_winner" ? Phase.Night : Phase.Voting, checkpoint: kind === "no_winner" ? "max_days_reached" : "exile_settled" },
});

for (const locale of ["zh-CN", "en"] as const) for (const kind of ["faction", "individual", "relationship", "multiple", "no_winner"] as const) test(`${locale}/${kind}: actual manifest and public replay preserve a sealed decision independently of cleanup failure`, async () => {
  const root = await createTestTempDirectory("awa-victory-record-"), result = decision(kind), original = structuredClone(result);
  const manager = await SessionRecordManager.create({ sessionId: `victory-${locale}-${kind}`, board: "scenario_victory", locale, startedAtIso: "2026-10-08T00:00:00.000Z" }, root);
  manager.recordPublicEvent({ type: "game_over", timestampMs: 1, phase: Phase.GameOver, day: 2, payload: result as unknown as Record<string, unknown> });
  const summary = await manager.finalize({ endedAtIso: "2026-10-08T00:01:00.000Z", winner: result.winner, finishReason: "runtime_error", gameResult: result, players });
  const manifest = JSON.parse(await readFile(path.join(manager.sessionDir, "manifest.json"), "utf8")), replay = readReplayDocument(JSON.parse(await readFile(path.join(manager.sessionDir, "replay.json"), "utf8")));
  expect(manifest.game_result).toEqual(original); expect(manifest.finish_reason).toBe("runtime_error");
  expect(replay.result).toEqual({ winner: original.winner, reason: "runtime_error", decision: original });
  expect(replay.events[0].payload).toEqual({ ...original });
  const label = outcomeLabel(original.outcome, locale), winners = outcomeWinnersLabel(original.outcome, locale), point = victoryPointLabel(original.decidedAt, locale);
  const rendered = getDefaultScriptEventRenderRegistry().toLiveRender({ type: "game_over", timestamp: 1, payload: original }, false, locale).map(item => item.text).join(" ");
  expect(rendered).toContain(label); expect(rendered).toContain(winners); expect(rendered).toContain(point);
  const audit = auditSummaryHeader(summary.manifest, [], locale).join("\n"); expect(audit).toContain(label); expect(audit).toContain(winners);
  if (kind === "individual" || kind === "relationship" || kind === "multiple") expect(label).not.toBe(locale === "en" ? "No winner" : "无获胜方");
  if (original.outcome.kind === "victory") original.outcome.winningPlayerIds.length = 0;
  expect(replay.result.decision).toEqual({ ...result }); // Detached from other copies.
});

test("public result validation rejects projections, unknown winners, malformed explicit decisions and accessors; old archives stay without inferred members", () => {
  const aggregate = new ReplaySessionAggregate({ sessionId: "victory-shape", board: "scenario", startedAtIso: "2026-10-08T00:00:00.000Z" });
  const result = decision("individual"), meta = { endedAtIso: "2026-10-08T00:01:00.000Z", winner: null, finishReason: "scenario_win", gameResult: result, players };
  expect(() => aggregate.buildManifest({ ...meta, winner: Camp.Good })).toThrow("replay_result_winner_mismatch");
  expect(() => aggregate.buildManifest({ ...meta, players: players.filter(player => player.player_id !== 5) })).toThrow();
  const good = createReplayDocument({ manifest: aggregate.buildManifest(meta), events: [] });
  expect(() => readReplayDocument({ ...good, result: { ...good.result, winner: "good" } })).toThrow();
  const bad = { ...good, result: { ...good.result, decision: { ...result, outcome: { kind: "unknown" } } } };
  expect(() => readReplayDocument(bad)).toThrow();
  let reads = 0; const accessor = { ...good.result }; Object.defineProperty(accessor, "decision", { enumerable: true, get() { reads++; return result; } });
  expect(() => readReplayDocument({ ...good, result: accessor })).toThrow(); expect(reads).toBe(0);
  const old = { ...good, schemaVersion: 1, result: { winner: "好人", reason: "狼人全灭" } };
  const preserved = readReplayDocument(old); expect(preserved.result).not.toHaveProperty("decision"); expect(preserved.result.winner).toBe("good");
  expect(old.result.winner).toBe("好人");
  expect(readVictoryResult(result, [1, 2, 3, 4, 5, 6])).toEqual({ ...result });
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: a decidedAt-only malformed explicit terminal fact stays unknown in console rather than becoming a faction win`, () => {
  const payload = { winner: Camp.Good, reason: "all_wolves_eliminated", decidedAt: { day: 1, phase: Phase.Day, checkpoint: "night_settled" } };
  const registry = getDefaultScriptEventRenderRegistry();
  const event = { type: "game_over" as const, timestamp: 1, payload } as unknown as import("../../src/core").GameEvent;
  expect(registry.toJudgeLine(event, locale)).toBe(locale === "en" ? "Unknown" : "未知");
  expect(registry.toLiveRender(event, false, locale).map(item => item.text)).toEqual([locale === "en" ? "Unknown" : "未知"]);
});

test("the returned replay snapshot is revalidated against getter-time mutation and explicit terminal conflicts", () => {
  const aggregate = new ReplaySessionAggregate({ sessionId: "victory-consistency", board: "scenario", startedAtIso: "2026-10-08T00:00:00.000Z" }), result = decision("individual");
  const manifest = aggregate.buildManifest({ endedAtIso: "2026-10-08T00:01:00.000Z", winner: null, finishReason: result.reason, gameResult: result, players });
  const event = { seq: 1, timestamp: "2026-10-08T00:01:00.000Z", day: 2, phase: "game_over", type: "game_over", payload: structuredClone(result) as unknown as Record<string, unknown> };
  const good = createReplayDocument({ manifest, events: [event] });
  const disagreement = structuredClone(good);
  disagreement.result.decision!.outcome = { kind: "victory", primary: { kind: "individual", playerId: 1, goalId: "scenario_other", winningPlayerIds: [1] }, additional: [], winningPlayerIds: [1] };
  expect(() => readReplayDocument(disagreement)).toThrow("decision_terminal_mismatch");
  const duplicates = structuredClone(good); duplicates.events.push({ ...structuredClone(event), seq: 2, payload: disagreement.result.decision! as unknown as Record<string, unknown> });
  expect(() => readReplayDocument(duplicates)).toThrow("decision_terminal_mismatch");
  const changed = structuredClone(good); changed.events = [];
  let reads = 0;
  Object.defineProperty(changed.result, "reason", { enumerable: true, get() {
    if (++reads === 3) changed.result.decision!.outcome = { kind: "victory", primary: { kind: "individual", playerId: 999, goalId: "scenario_other", winningPlayerIds: [999] }, additional: [], winningPlayerIds: [999] };
    return "scenario_win";
  } });
  expect(() => readReplayDocument(changed)).toThrow();
});

test("nonserialized explicit decisions cannot disappear or lose fields during replay cloning", () => {
  const aggregate = new ReplaySessionAggregate({ sessionId: "victory-enumerable", board: "scenario", startedAtIso: "2026-10-08T00:00:00.000Z" });
  const result = decision("individual");
  const good = createReplayDocument({ manifest: aggregate.buildManifest({ endedAtIso: "2026-10-08T00:01:00.000Z", winner: null, finishReason: result.reason, gameResult: result, players }), events: [] });
  const hiddenDecision = structuredClone(good);
  Object.defineProperty(hiddenDecision.result, "decision", { value: result, enumerable: false });
  expect(() => readReplayDocument(hiddenDecision)).toThrow();
  expect(Object.getOwnPropertyDescriptor(hiddenDecision.result, "decision")!.enumerable).toBe(false);
  const hiddenReason = structuredClone(good);
  Object.defineProperty(hiddenReason.result.decision!, "reason", { value: result.reason, enumerable: false });
  expect(() => readReplayDocument(hiddenReason)).toThrow();
  expect(() => readVictoryResult(hiddenReason.result.decision!)).toThrow();
  expect(Object.getOwnPropertyDescriptor(hiddenReason.result.decision!, "reason")!.enumerable).toBe(false);
});

test("explicit terminal getters cannot become sealed victories during cloning, while bad JSON facts stay unknown", () => {
  const aggregate = new ReplaySessionAggregate({ sessionId: "victory-terminal-accessor", board: "scenario", startedAtIso: "2026-10-08T00:00:00.000Z" });
  const good = createReplayDocument({ manifest: aggregate.buildManifest({ endedAtIso: "2026-10-08T00:01:00.000Z", winner: null, finishReason: "runtime_error", players }), events: [] });
  const result = decision("individual");
  const event = { seq: 1, timestamp: "2026-10-08T00:01:00.000Z", day: 2, phase: "game_over", type: "game_over", payload: result as unknown as Record<string, unknown> };
  for (const field of ["winner", "reason", "outcome", "decidedAt"] as const) {
    const payload = structuredClone(result); let reads = 0;
    Object.defineProperty(payload, field, { enumerable: true, get() { reads++; return result[field]; } });
    expect(() => readReplayDocument({ ...good, events: [{ ...event, payload }] })).toThrow();
    expect(reads).toBe(0);
  }
  const nested = structuredClone(result); let reads = 0;
  Object.defineProperty(nested.outcome, "kind", { enumerable: true, get() { reads++; return "victory"; } });
  expect(() => readReplayDocument({ ...good, events: [{ ...event, payload: nested }] })).toThrow(); expect(reads).toBe(0);
  const malformed = { ...good, events: [{ ...event, payload: { winner: "good", decidedAt: { day: 2 } } }] };
  expect(readReplayDocument(malformed).events[0].payload).toEqual(malformed.events[0].payload);
});
