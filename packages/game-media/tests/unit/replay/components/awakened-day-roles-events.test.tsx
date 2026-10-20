/**
 * 单元测试负责全天保护／决斗事实的双语Web时间线与逐帧投影。输入十一类字面事实，输出席位关系和真实生命变化。
 * 亮牌、技能声明、God阻挡及尝试均不推定死亡；仅独立实际结算death数组更新Alive。
 */
import { PROJECT_ROOT } from "@ai-werewolf-arena/project-paths";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AWAKENED_GUARD_POLICY as gp } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { AWAKENED_DUEL_POLICY as kp } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
function doc(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "day_roles_literal",
    meta: { board: "literal", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, i) => ({
      player_id: i + 1,
      seat: i + 1,
      role: "villager",
      camp: "good",
    })),
    events: [
      {
        type: "awakened_guard_cycle_started",
        phase: "night",
        payload: { policy: gp, day: 1, actorId: 11 },
      },
      {
        type: "awakened_protection_chosen",
        phase: "day",
        payload: {
          policy: gp,
          day: 1,
          actorId: 11,
          timing: "day",
          mode: "protect",
          targetId: 8,
          outcome: "protected",
        },
      },
      {
        type: "awakened_protection_revealed",
        phase: "day",
        payload: { policy: gp, day: 1, actorId: 11, targetId: 8 },
      },
      {
        type: "awakened_protection_block_detail",
        phase: "day",
        payload: {
          policy: gp,
          day: 1,
          actorId: 11,
          targetId: 8,
          phase: "day",
          rootPhase: "day",
          causes: ["awakened_duel"],
        },
      },
      {
        type: "awakened_protection_blocked",
        phase: "day",
        payload: { policy: gp, day: 1, targetId: 8 },
      },
      {
        type: "awakened_self_destruct_declared",
        phase: "day",
        payload: { policy: gp, day: 1, actorId: 3, window: "on_pre_vote" },
      },
      {
        type: "awakened_self_destruct_resolved",
        phase: "day",
        payload: { policy: gp, day: 1, actorId: 3, window: "on_pre_vote", deaths: [] },
      },
      {
        type: "awakened_duel_committed",
        phase: "day",
        payload: { policy: kp, day: 1, actorId: 12, chain: 1, targetId: 8, branch: "wolf" },
      },
      {
        type: "awakened_duel_resolved",
        phase: "day",
        payload: { policy: kp, day: 1, actorId: 12, chain: 1, targetId: 8, deaths: [] },
      },
      {
        type: "awakened_duel_chain_ended",
        phase: "day",
        payload: { policy: kp, day: 1, actorId: 12, chain: 1, reason: "ended" },
      },
      {
        type: "awakened_protection_expired",
        phase: "day",
        payload: { policy: gp, day: 1, actorId: 11 },
      },
      {
        type: "awakened_duel_committed",
        phase: "day",
        payload: { policy: kp, day: 1, actorId: 12, chain: 2, targetId: 7, branch: "good" },
      },
      {
        type: "awakened_duel_resolved",
        phase: "day",
        payload: { policy: kp, day: 1, actorId: 12, chain: 2, targetId: 7, deaths: [12, 7] },
      },
    ].map((e, i) => ({
      ...e,
      seq: i + 1,
      day: 1,
      timestamp: `2026-10-16T00:00:${String(i).padStart(2, "0")}Z`,
    })),
  } as ReplayDocument;
}
for (const locale of ["zh-CN", "en"] as const)
  test(`原始事实两语时间线/死亡不提前/${locale}`, () => {
    const r = doc(),
      ids = r.players.map((p) => p.player_id);
    for (const [i, e] of r.events.entries()) {
      const p = readReplayEvent(e, ids);
      expect(p).not.toBeNull();
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/undefined|NaN|policy|targetId/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(readReplayEvent({ ...e, day: 2 }, ids)).toBeNull();
      expect(readReplayEvent({ ...e, payload: { ...e.payload, secret: true } }, ids)).toBeNull();
      if (i < 12) expect(buildReplaySnapshot(r, i).players.every((p) => p.alive)).toBe(true);
    }
    expect(readReplayEvent(r.events[8]!, ids)!.effects).toEqual([]);
    const final = buildReplaySnapshot(r, 12);
    expect(
      final.players
        .filter((p) => !p.alive)
        .map((p) => p.playerId)
        .sort((a, b) => a - b),
    ).toEqual([7, 12]);
    const html = renderToStaticMarkup(
      <EventTimeline
        events={r.events}
        locale={locale}
        playerIds={ids}
        activeEventSeq={1}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(html).not.toMatch(/undefined|NaN/);
    expect(html).toContain(locale === "en" ? "protection" : "保护");
  });
test("拒绝不存在目标、错阶段和将尝试payload添死亡字段", () => {
  const r = doc(),
    ids = r.players.map((p) => p.player_id);
  expect(readReplayEvent({ ...r.events[0]!, phase: "day" }, ids)).toBeNull();
  expect(
    readReplayEvent({ ...r.events[7]!, payload: { ...r.events[7]!.payload, deaths: [8] } }, ids),
  ).toBeNull();
  expect(
    readReplayEvent({ ...r.events[12]!, payload: { ...r.events[12]!.payload, deaths: [99] } }, ids),
  ).toBeNull();
});
for (const mode of ["body", "substitute"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`真实SDK教学档关键帧与逆向seek/${mode}/${locale}`, async () => {
      const { readFileSync } = await import("node:fs");
      const { readReplayDocument } = await import("@ai-werewolf-arena/replay-contract");
      const { createReplayRenderInput, buildReplayFrame } =
        await import("../../../../src/replay/replay-frame");
      const r = readReplayDocument(
          JSON.parse(
            readFileSync(
              join(PROJECT_ROOT, `docs/examples/awakened-knight/${mode}-${locale}.replay.json`),
              "utf8",
            ),
          ),
        ),
        ids = r.players.map((p) => p.player_id);
      const first = r.events.findIndex((e) => e.type === "awakened_duel_committed"),
        resolved = r.events.findIndex((e) => e.type === "awakened_duel_resolved"),
        end = r.events.findIndex((e) => e.type === "awakened_duel_chain_ended");
      expect(first).toBeGreaterThan(0);
      expect(resolved).toBeGreaterThan(first);
      expect(end).toBeGreaterThan(resolved);
      expect(buildReplaySnapshot(r, first).players.find((p) => p.playerId === 10)!.alive).toBe(
        true,
      );
      expect(buildReplaySnapshot(r, resolved).players.find((p) => p.playerId === 10)!.alive).toBe(
        true,
      );
      expect(buildReplaySnapshot(r, resolved).players.find((p) => p.playerId === 2)!.alive).toBe(
        true,
      );
      if (mode === "substitute")
        expect(
          r.events.some(
            (e) => e.type === "awakened_beauty_replaced" && e.payload.targetDied === false,
          ),
        ).toBe(true);
      const targets = r.events
        .filter((e) => e.type === "awakened_duel_resolved")
        .flatMap((e) => e.payload.deaths as number[]);
      expect(targets).toEqual([8, 9, 12]);
      expect(
        buildReplaySnapshot(r, end)
          .players.filter((p) => !p.alive)
          .map((p) => p.playerId),
      ).toEqual([1, 8, 9, 12]);
      const words = r.events
        .filter(
          (e) =>
            e.type === "last_words_spoken" && [8, 9, 12].includes(e.payload.playerId as number),
        )
        .map((e) => e.payload.playerId);
      expect(words).toEqual([8, 9, 12]);
      for (const e of r.events) {
        expect(readReplayEvent(e, ids)).not.toBeNull();
        const label = eventLabel(e, locale, ids);
        expect(label).not.toMatch(/undefined|NaN/);
        if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      }
      const input = createReplayRenderInput(r, { locale, timeZone: "UTC" }),
        later = buildReplayFrame(input, resolved * 90),
        back = buildReplayFrame(input, Math.max(0, first - 1) * 90),
        again = buildReplayFrame(input, resolved * 90);
      expect(again).toEqual(later);
      expect(back).not.toEqual(later);
    });
