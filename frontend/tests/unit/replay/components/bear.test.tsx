/**
 * 单元组件测试验证熊的真实匿名播报归档。输入为邻座更新／狼王警徽样本和两语设置；
 * 输出以手写播报、存活及胜者预期检查席位不因熊信号改变，并核对字幕、纯帧和静态 markup；不运行熊规则或修改 fixture。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import update from "../../../fixtures/six-player-bear-neighbor-update/bear-neighbor-update/zh-CN/god.replay.json";
import king from "../../../fixtures/six-player-bear-king-badge/bear-king-badge/zh-CN/god.replay.json";
for (const locale of ["zh-CN", "en"] as const)
  for (const badge of [false, true])
    test(`${locale}/${badge}: actual anonymous Bear announcements never change life/badge state and remain identical in timeline and pure video frame`, () => {
      const raw = structuredClone(badge ? king : update);
      raw.meta.locale = locale;
      const before = structuredClone(raw),
        replay = readReplayDocument(raw),
        reports = replay.events.filter((e) => e.type === "bear_roared");
      expect(reports.map((e) => e.payload)).toEqual(
        badge
          ? [{ day: 1, roared: false }]
          : [
              { day: 1, roared: true },
              { day: 2, roared: false },
            ],
      );
      for (const report of reports) {
        const index = replay.events.indexOf(report),
          previous = buildReplaySnapshot(replay, index - 1),
          snapshot = buildReplaySnapshot(replay, index);
        expect(snapshot.players).toEqual(previous.players);
        expect(snapshot.decision).toBeNull();
        expect(Object.keys(report.payload).sort()).toEqual(["day", "roared"]);
        const label =
          locale === "en"
            ? `Day ${report.day}: Bear ${report.payload.roared ? "roared" : "did not roar"}`
            : `第${report.day}天：熊${report.payload.roared ? "咆哮了" : "没有咆哮"}`;
        expect(eventLabel(report, locale)).toBe(label);
        const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
          frame =
            input.replay.events.findIndex((e) => e.seq === report.seq) * FRAMES_PER_EVENT + 10;
        expect(buildReplayFrame(input, frame).label).toBe(label);
        const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
        expect(markup).toContain(label);
        expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
        expect(
          eventLabel({ ...report, payload: { day: report.day, roared: "false" } }, locale),
        ).toBe(locale === "en" ? "Unknown" : "未知");
      }
      const final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual(
        badge ? [1, 3, 4, 5, 6] : [1, 3, 5, 6],
      );
      expect(final.players.find((p) => p.playerId === 1)!.alive).toBe(!badge);
      if (badge) expect(final.players.find((p) => p.playerId === 3)!.isSheriff).toBe(true);
      expect(raw).toEqual(before);
    });
