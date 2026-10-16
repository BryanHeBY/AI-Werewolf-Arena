/**
 * 组件单元测试负责验证昵称在席位、时间线和帧投影中的一致展示与原文转义。
 * 输入为字面复盘、显式昵称和缺省玩家；预期来自手写标签、缺省字段及安全转义片段。
 * 不运行后端引擎、模型或浏览器，不修改输入档案；帧与时间线比较仅核展示一致性。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { PlayerSeats } from "../../../../src/replay/PlayerSeats";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
import { createReplayRenderInput } from "../../../../src/replay/replay-frame";
import { buildReplayFrame } from "../../../../src/replay/replay-frame";

test("公开昵称在 Web 与帧投影一致，缺省不补名字，事件 payload 保持 ID", () => {
  const speech = "2号、{actor}号和Player 2都是我的发言";
  const replay = readReplayDocument({
    schemaVersion: 2,
    sessionId: "names",
    perspective: "god",
    meta: { board: "test", startedAt: "2026-10-16T00:00:00Z", endedAt: "2026-10-16T00:01:00Z" },
    result: { winner: null, reason: null },
    players: [
      { player_id: 1, name: "茶<script>", role: "villager", camp: "good" },
      { player_id: 2, role: "wolf", camp: "wolf" },
    ],
    events: [
      {
        seq: 1,
        timestamp: "2026-10-16T00:00:01Z",
        day: 1,
        phase: "day",
        type: "day_speech",
        payload: { actorId: 1, text: speech },
      },
    ],
  });
  const players = [{ id: 1, name: "茶<script>" }, { id: 2 }],
    ids = [1, 2],
    before = JSON.stringify(replay);
  for (const locale of ["zh-CN", "en"] as const) {
    const label = eventLabel(replay.events[0]!, locale, ids, players);
    expect(label).toContain(locale === "zh-CN" ? "1号·茶<script>" : "Player 1·茶<script>");
    expect(label).toEndWith(speech);
    const frame = buildReplayFrame(createReplayRenderInput(replay, { locale, timeZone: "UTC" }), 0);
    expect(frame.label).toBe(label);
    expect(frame.snapshot.players[1]!.name).toBeUndefined();
    const html = renderToStaticMarkup(
      <>
        <PlayerSeats
          players={buildReplaySnapshot(replay, 0).players}
          locale={locale}
          focusedPlayerId={null}
          onToggleFocus={() => {}}
        />
        <EventTimeline
          players={players}
          events={replay.events}
          locale={locale}
          playerIds={ids}
          activeEventSeq={1}
          focusedPlayerId={null}
          onJumpTo={() => {}}
          onClearFocus={() => {}}
        />
      </>,
    );
    expect(html).toContain("茶&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("玩家2");
  }
  expect(JSON.stringify(replay)).toBe(before);
});
