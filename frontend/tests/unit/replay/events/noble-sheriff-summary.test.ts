/**
 * 单元事件测试验证夜之贵族归档画面中的警长摘要。输入为原归档外壳和手写首轮平票／PK／重复发表事实；
 * 输出按独立持徽者与倒看预期检查徽章幂等、未知身份保留及畸形 winner 拒绝，不调用生产计票或选举生成预期。
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { buildReplayFrame, createReplayRenderInput } from "../../../../src/replay/replay-frame";

// 手写选举事实：首轮汇总平票，随后 PK 汇总产生胜者。
// 胜者和效果预期不由生产计票／选举函数生成。
function summary(seq: number, winnerId: unknown, round: number): ReplayEvent {
  return {
    seq,
    timestamp: `2026-10-12T00:00:0${seq}.000Z`,
    day: 1,
    phase: "day",
    stage: "sheriff_vote_summary",
    type: "sheriff_vote_summary",
    payload: {
      votes: [
        { actorId: 1, targetId: 4, weight: 1 },
        { actorId: 2, targetId: round === 1 ? 6 : 4, weight: 1 },
      ],
      winnerId,
      round,
    },
  };
}
function input(locale: "en" | "zh-CN", events: ReplayEvent[]) {
  const base = readReplayDocument(
    JSON.parse(
      readFileSync(
        frontendFixtureURL(`frontend/tests/fixtures/noble-badge_reveal-${locale}.replay.json`),
        "utf8",
      ),
    ),
  );
  return createReplayRenderInput(
    readReplayDocument({
      ...base,
      result: { winner: null, reason: "literal_projection_test" },
      players: base.players.map((p) => ({ ...p, role: "unknown", camp: "unknown" })),
      events,
    }),
    { locale, timeZone: "UTC" },
  );
}
for (const locale of ["en", "zh-CN"] as const) {
  test(`PK null before winner; repeated elected idempotent; rewind clears/${locale}`, () => {
    const replay = input(locale, [
      summary(1, null, 1),
      summary(2, 4, 2),
      {
        seq: 3,
        timestamp: "2026-10-12T00:00:03.000Z",
        day: 1,
        phase: "day",
        stage: "sheriff",
        type: "sheriff_elected",
        payload: { winnerId: 4, candidates: [4, 6], tally: { "4": 2 } },
      },
    ]);
    const sheriffs = (frame: number) =>
      buildReplayFrame(replay, frame)
        .players.filter((p) => p.isSheriff)
        .map((p) => p.playerId);
    expect(sheriffs(0)).toEqual([]);
    expect(sheriffs(89)).toEqual([]);
    expect(sheriffs(90)).toEqual([4]);
    expect(sheriffs(135)).toEqual([4]);
    expect(sheriffs(225)).toEqual([4]);
    expect(buildReplayFrame(replay, 225).players.every((p) => p.alive)).toBe(true);
    expect(
      buildReplayFrame(replay, 225).players.every(
        (p) => p.role === "unknown" && p.camp === "unknown",
      ),
    ).toBe(true);
    expect(sheriffs(89)).toEqual([]);
    expect(sheriffs(0)).toEqual([]);
  });
  test(`invalid winner creates no badge and cannot replace a legitimate winner/${locale}`, () => {
    for (const invalid of [99, 4.5, 0, -1, "6"]) {
      const isolated = input(locale, [summary(1, invalid, 2)]);
      expect(buildReplayFrame(isolated, 45).players.filter((p) => p.isSheriff)).toEqual([]);
      const afterWinner = input(locale, [summary(1, 4, 2), summary(2, invalid, 2)]);
      expect(
        buildReplayFrame(afterWinner, 135)
          .players.filter((p) => p.isSheriff)
          .map((p) => p.playerId),
      ).toEqual([4]);
    }
    const missing = summary(1, null, 2);
    delete missing.payload.winnerId;
    expect(
      buildReplayFrame(input(locale, [missing]), 45).players.filter((p) => p.isSheriff),
    ).toEqual([]);
  });
}
