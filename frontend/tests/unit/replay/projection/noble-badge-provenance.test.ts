/**
 * 单元投影测试验证普通玩家归档的公开身体翻牌及警徽来源。输入为真实后端玩家档、公开席位资料和帧号；
 * 输出按字面未知身份／存活／持徽预期核对翻牌仅在公开事实处可见及倒看恢复，不向私有电影输入 God 事件，不执行游戏。
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";

// 使用真实后端导出的玩家档；私有电影不输入 God 事件或未遮蔽角色，
// God 名单只提供公开席位／姓名字段。
for (const locale of ["en", "zh-CN"] as const) {
  test(`actual villager movie reveals the live Body only after public fact/${locale}`, () => {
    const god = readReplayDocument(
      JSON.parse(
        readFileSync(
          frontendFixtureURL(
            "frontend/tests/fixtures/" + `noble-badge_reveal-${locale}.replay.json`,
          ),
          "utf8",
        ),
      ),
    );
    const owner = readReplayPlayerView(
      JSON.parse(
        readFileSync(
          frontendFixtureURL(
            "frontend/tests/fixtures/" +
              `player-views/noble-badge_reveal-${locale}-villager.player.json`,
          ),
          "utf8",
        ),
      ),
    );
    const events = owner.timeline
      .flatMap((row) =>
        row.kind === "event"
          ? [
              {
                seq: row.seq,
                timestamp: row.timestamp!,
                day: row.day,
                phase: row.phase,
                type: row.event.type,
                payload: row.event.payload,
              },
            ]
          : [],
      )
      .map((e, i) => ({ ...e, seq: i + 1 }));
    const movie = readReplayDocument({
      ...god,
      result: { winner: null, reason: "private_render" },
      players: god.players.map((p) => ({
        ...p,
        role: p.player_id === owner.player_id ? owner.role : "unknown",
        camp: p.player_id === owner.player_id ? owner.camp : "unknown",
      })),
      events,
    });
    const reveal = events.find((e) => e.type === "secret_body_revealed")!;
    const bodyId = reveal.payload.actorId;
    expect(bodyId).not.toBe(owner.player_id);
    const input = createReplayRenderInput(movie, { locale, timeZone: "UTC" });
    const index = input.replay.events.findIndex((e) => e.seq === reveal.seq);
    expect(index).toBeGreaterThan(0);
    const at = (frame: number) =>
      buildReplayFrame(input, frame).players.find((p) => p.playerId === bodyId)!;
    const before = at(index * 90 - 1),
      shown = at(index * 90 + 45);
    expect(before.role).toBe("unknown");
    expect(before.publicRole).toBeUndefined();
    expect(before.roleLabel).toBe("unknown");
    expect(shown.publicRole).toBe("awakened_idiot");
    expect(shown.role).toBe("unknown");
    expect([shown.alive, shown.isSheriff, shown.camp]).toEqual([true, true, "unknown"]);
    expect(shown.roleLabel).toBe(locale === "en" ? "Awakened Village Idiot" : "觉醒愚者");
    expect(at(index * 90 - 1)).toEqual(before);
    expect(at(0).roleLabel).toBe("unknown");
  });
}
