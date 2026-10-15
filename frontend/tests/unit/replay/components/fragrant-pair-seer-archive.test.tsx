/**
 * 单元组件测试验证寻香双角色 God／玩家归档的因果帧。输入为既有 fixture 和两语游标；
 * 输出检查机制披露不直接杀人、真实死亡及终局 checkpoint 对照、倒看和授权事件范围。原断言保留，不用生产规则重新生成归档预期。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { fragrantNames, loadFragrant, fragrantPrivateReplay } from "../../../support/fragrant-replay";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { eventLabel } from "../../../../src/replay/event-labels";
const dead = (s: ReturnType<typeof buildReplaySnapshot>) =>
  s.players.filter((p) => !p.alive).map((p) => p.playerId);
for (const locale of ["zh-CN", "en"] as const)
  for (const name of fragrantNames) {
    const fixture = `fragrant-${name}-${locale}`;
    test(`actual Fragrant God seeks preserve public death boundary ${fixture}`, () => {
      const replay = readReplayDocument(loadFragrant(fixture, ".replay.json")),
        cp = loadFragrant(fixture, ".checkpoint.txt"),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        ids = replay.players.map((p) => p.player_id);
      for (const e of replay.events.filter(
        (e) =>
          e.type.startsWith("fragrant_") ||
          ["night_resolved", "additional_deaths", "hunter_shot", "game_over"].includes(e.type),
      )) {
        const j = input.replay.events.findIndex((x) => x.seq === e.seq);
        const i = replay.events.findIndex((x) => x.seq === e.seq),
          before = buildReplaySnapshot(replay, i - 1),
          after = buildReplaySnapshot(replay, i);
        if (e.type.startsWith("fragrant_")) {
          expect(readReplayEvent(e, ids)!.effects).toEqual([]);
          expect(after.players).toEqual(before.players);
        }
        for (const offset of [0, 45, 89])
          expect(buildReplayFrame(input, j * 90 + offset).snapshot).toEqual(after);
        if (i > 0)
          expect(buildReplayFrame(input, j * 90 - 1).snapshot.players).toEqual(before.players);
        const label = eventLabel(e, locale, ids);
        expect(label).not.toMatch(/undefined|NaN/);
        if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      }
      const last = buildReplayFrame(input, (replay.events.length - 1) * 90 + 89);
      expect(dead(last.snapshot)).toEqual(
        cp.players.filter((p: { alive: boolean }) => !p.alive).map((p: { id: number }) => p.id),
      );
      expect(last.snapshot.decision).toEqual(cp.snapshot.result);
      expect(dead(buildReplayFrame(input, 0).snapshot)).toEqual([]);
      expect(
        renderToStaticMarkup(<ReplayFrame input={input} frame={(replay.events.length - 1) * 90} />),
      ).not.toMatch(/undefined|NaN/);
    });
    for (const owner of ["phantom", "seer", "villager", "pack"] as const)
      test(`actual Fragrant authorized ${owner} frames ${fixture}`, () => {
        const replay = fragrantPrivateReplay(fixture, owner),
          input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
        expect(
          replay.events.some((e) =>
            [
              "fragrant_night_opened",
              "fragrant_wave_committed",
              "fragrant_link_triggered",
              "fragrant_binding_expired",
            ].includes(e.type),
          ),
        ).toBe(false);
        for (const e of replay.events.filter((e) => e.type.startsWith("fragrant_"))) {
          const i = input.replay.events.findIndex((x) => x.seq === e.seq);
          expect(e.payload.actorId).toBe(
            replay.players.find((p) => p.role !== "unknown")!.player_id,
          );
          expect(buildReplayFrame(input, i * 90).snapshot.players).toEqual(
            buildReplayFrame(input, i * 90 - 1).snapshot.players,
          );
        }
        const announced = replay.events.find((e) => e.type === "game_over");
        expect(
          buildReplayFrame(input, (replay.events.length - 1) * 90 + 89).snapshot
            .decision as unknown,
        ).toEqual(announced?.payload ?? null);
      });
  }
