/**
 * 单元投影测试验证纯白之女／狼巫归档；输入为 God、checkpoint 和十二份玩家档。
 * 输出比对终局生命／胜者及每位仅见本人查验，归档对照与原每人次数断言分别保留；只读取 fixture，不执行后端查验或重新生成预期。
 */
import { expect, test } from "bun:test";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import wolf from "../../../fixtures/pure-white-transport-wolf/pure-white-wolf/zh-CN/god.replay.json";
import good from "../../../fixtures/pure-white-transport-good/pure-white-good/zh-CN/god.replay.json";
import wolfCheckpoint from "../../../fixtures/pure-white-transport-wolf/pure-white-wolf/zh-CN/checkpoint.json";
import goodCheckpoint from "../../../fixtures/pure-white-transport-good/pure-white-good/zh-CN/checkpoint.json";
import wolfViews from "../../../fixtures/pure-white-transport-wolf/pure-white-wolf/zh-CN/players/all.player-views.json";
import goodViews from "../../../fixtures/pure-white-transport-good/pure-white-good/zh-CN/players/all.player-views.json";
for (const kind of ["wolf", "good"] as const)
  test(`${kind}: frontend projection matches actual engine checkpoint and each owner sees only their inspection`, () => {
    const replay = readReplayDocument(kind === "wolf" ? wolf : good);
    const checkpoint = kind === "wolf" ? wolfCheckpoint : goodCheckpoint;
    const rawViews = kind === "wolf" ? wolfViews : goodViews;
    const snapshot = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(checkpoint.complete).toBe(true);
    expect(snapshot.players.map((p) => ({ id: p.playerId, alive: p.alive }))).toEqual(
      checkpoint.players.map((p) => ({ id: p.id, alive: p.alive })),
    );
    expect(rawViews).toHaveLength(12);
    expect(rawViews.map((v) => v.player_id).sort((a, b) => a - b)).toEqual(
      checkpoint.players.map((p) => p.id).sort((a, b) => a - b),
    );
    expect(
      snapshot.players
        .filter((p) => p.isWinner)
        .map((p) => p.playerId)
        .sort((a, b) => a - b),
    ).toEqual([...checkpoint.snapshot.result.outcome.winningPlayerIds].sort((a, b) => a - b));
    const reports = replay.events.filter((e) => e.type === "role_inspected");
    for (const raw of rawViews) {
      const view = readReplayPlayerView(raw);
      const own = view.timeline.flatMap((row) =>
        row.kind === "event" && row.event.type === "role_inspected" ? [row.event.payload] : [],
      );
      const expected = reports.filter((e) => e.payload.actorId === view.player_id);
      expect(own).toHaveLength(expected.length);
      expect(own).toHaveLength(["pure_white_girl", "wolf_witch"].includes(view.role) ? 2 : 0);
      own.forEach((payload, index) => {
        expect(payload.actorId).toBe(view.player_id);
        expect(payload.targetId).toBe(expected[index]!.payload.targetId);
        expect(payload.result).toEqual(expected[index]!.payload.result);
      });
    }
  });
