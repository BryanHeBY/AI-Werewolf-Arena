/**
 * 单元组件测试用手写狼王→猎人→终局链验证展示。输入为固定角色、事件前缀和两语帧号；
 * 输出以独立字幕、死亡数组和角色预期核对不同枪击及纯帧／markup，原数据不变，不执行死亡 hook 或真实判胜。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: wolf-king and Hunter shots have distinct labels and shared actual-death projection`, () => {
    const decision = {
      winner: "good",
      reason: "all_wolves_eliminated",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] },
        additional: [],
        winningPlayerIds: [2, 3, 4, 5, 6],
      },
      decidedAt: { day: 1, phase: "voting", checkpoint: "exile_settled" },
    };
    const raw = {
      schemaVersion: 2,
      sessionId: "wolf-king-display",
      perspective: "god",
      meta: {
        board: "six_player_wolf_king",
        locale,
        startedAt: "2026-10-08T00:00:00.000Z",
        endedAt: "2026-10-08T00:01:00.000Z",
      },
      result: { winner: "good", reason: "all_wolves_eliminated", decision },
      players: ["wolf_king", "hunter", "seer", "villager", "villager", "villager"].map(
        (role, index) => ({ player_id: index + 1, role, camp: index === 0 ? "wolf" : "good" }),
      ),
      events: [
        { type: "voted_out", payload: { target: 1 } },
        { type: "wolf_king_shot", payload: { actorId: 1, targetId: 2 } },
        { type: "hunter_shot", payload: { hunterId: 2, targetId: 3 } },
        { type: "game_over", payload: decision },
      ].map((event, index) => ({
        ...event,
        seq: index + 1,
        day: 1,
        phase: "voting",
        timestamp: "2026-10-08T00:01:00.000Z",
      })),
    };
    const original = structuredClone(raw),
      replay = readReplayDocument(raw),
      roster = [1, 2, 3, 4, 5, 6];
    expect(eventLabel(replay.events[1], locale, roster)).toBe(
      locale === "en" ? "Wolf King 1 shoots player 2" : "1号狼王开枪带走2号",
    );
    expect(eventLabel(replay.events[2], locale, roster)).toBe(
      locale === "en" ? "Hunter 2 shoots player 3" : "2号猎人开枪带走3号",
    );
    expect(
      buildReplaySnapshot(replay, 0)
        .players.filter((player) => !player.alive)
        .map((player) => player.playerId),
    ).toEqual([1]);
    expect(
      buildReplaySnapshot(replay, 1)
        .players.filter((player) => !player.alive)
        .map((player) => player.playerId),
    ).toEqual([1, 2]);
    expect(
      buildReplaySnapshot(replay, 2)
        .players.filter((player) => !player.alive)
        .map((player) => player.playerId),
    ).toEqual([1, 2, 3]);
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      view = buildReplayFrame(input, 100);
    expect(view.label).toBe(eventLabel(replay.events[1], locale, roster));
    expect(view.players[0].roleLabel).toBe(locale === "en" ? "Wolf King" : "狼王");
    const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={100} />);
    expect(markup).toContain(view.label);
    expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={100} />));
    expect(raw).toEqual(original);
  });
