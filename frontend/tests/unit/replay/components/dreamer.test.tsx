/**
 * 单元组件测试用手写逐事件复盘验证摄梦人保护、落空枪击和匿名追加死亡。
 * 输入为固定角色／事件和两语帧号；输出按字面死亡数组核对字幕、纯帧和静态 markup，保原数据不变，不执行保护或死亡规则。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a blocked death shot leaves the target alive and an anonymous actual additional death updates the same pure frame`, () => {
    const raw = {
      schemaVersion: 2,
      sessionId: "dream-display",
      perspective: "god",
      meta: {
        board: "dream_demo",
        locale,
        startedAt: "2026-10-08T00:00:00.000Z",
        endedAt: "2026-10-08T00:01:00.000Z",
      },
      result: { winner: null, reason: "in_progress" },
      players: [
        { player_id: 1, role: "dreamer", camp: "good" },
        { player_id: 2, role: "hunter", camp: "good" },
        { player_id: 3, role: "villager", camp: "good" },
      ],
      events: [
        {
          seq: 1,
          day: 1,
          phase: "night",
          timestamp: "2026-10-08T00:00:00.000Z",
          type: "dream_applied",
          payload: { actorId: 1, targetId: 3, day: 1, consecutive: false },
        },
        {
          seq: 2,
          day: 1,
          phase: "day",
          timestamp: "2026-10-08T00:00:00.000Z",
          type: "night_resolved",
          payload: { deaths: [2] },
        },
        {
          seq: 3,
          day: 1,
          phase: "day",
          timestamp: "2026-10-08T00:01:00.000Z",
          type: "death_shot_blocked",
          payload: { actorId: 2, targetId: 3, reason: "night_protection" },
        },
        {
          seq: 4,
          day: 1,
          phase: "day",
          timestamp: "2026-10-08T00:01:00.000Z",
          type: "additional_deaths",
          payload: { deaths: [3] },
        },
      ],
    };
    const before = structuredClone(raw),
      replay = readReplayDocument(raw);
    expect(
      buildReplaySnapshot(replay, 2)
        .players.filter((player) => !player.alive)
        .map((player) => player.playerId),
    ).toEqual([2]);
    expect(
      buildReplaySnapshot(replay, 3)
        .players.filter((player) => !player.alive)
        .map((player) => player.playerId),
    ).toEqual([2, 3]);
    const label =
      locale === "en"
        ? "Player 2 shoots at player 3; night protection blocks the shot"
        : "2号向3号开枪，夜间保护使枪击落空";
    expect(eventLabel(replay.events[2], locale)).toBe(label);
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      frame = 190;
    expect(buildReplayFrame(input, frame).label).toBe(label);
    const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
    expect(markup).toContain(label);
    expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
    expect(raw).toEqual(before);
    expect(
      eventLabel(
        { ...replay.events[2], payload: { actorId: 2, targetId: 3, reason: "unknown" } },
        locale,
      ),
    ).toBe(locale === "en" ? "Unknown" : "未知");
  });
