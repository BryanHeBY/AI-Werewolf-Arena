/**
 * 单元组件测试验证纯白之女／狼巫的真实查验归档。输入为好人／狼人目标样本和两语帧号；
 * 输出检查报告只增知识不提前死亡，按字面人数核对终局及已死阵营胜者，并核纯帧／markup 和数据不变，不执行查验规则。
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
import wolf from "../../../fixtures/pure-white-transport-wolf/pure-white-wolf/zh-CN/god.replay.json";
import good from "../../../fixtures/pure-white-transport-good/pure-white-good/zh-CN/god.replay.json";
for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["wolf", "good"] as const)
    test(`${locale}/${kind}: inspection is private knowledge, not premature death, and dead faction members win`, () => {
      const raw = structuredClone(kind === "wolf" ? wolf : good);
      raw.meta.locale = locale;
      const before = structuredClone(raw);
      const replay = readReplayDocument(raw);
      const reports = replay.events.filter((e) => e.type === "role_inspected");
      expect(reports).toHaveLength(4);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      for (const report of reports) {
        const index = replay.events.indexOf(report);
        const snapshot = buildReplaySnapshot(replay, index);
        expect(snapshot.players).toEqual(buildReplaySnapshot(replay, index - 1).players);
        expect(snapshot.decision).toBeNull();
        const label = eventLabel(report, locale);
        expect(label).not.toBe(locale === "en" ? "Unknown" : "未知");
        if (locale === "en") expect(label).not.toMatch(/[\u3400-\u9fff]/);
        const frame =
          input.replay.events.findIndex((e) => e.seq === report.seq) * FRAMES_PER_EVENT + 10;
        expect(buildReplayFrame(input, frame).label).toBe(label);
        const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
        expect(markup).toContain(label.replaceAll("'", "&#x27;"));
        expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      }
      const final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(final.players.filter((p) => p.isWinner)).toHaveLength(kind === "wolf" ? 4 : 8);
      expect(final.players.filter((p) => !p.alive)).toHaveLength(kind === "wolf" ? 6 : 7);
      const deadWinnerId = reports[kind === "wolf" ? 1 : 0]!.payload.actorId;
      const deadWinner = final.players.find((p) => p.playerId === deadWinnerId);
      expect(deadWinner?.alive).toBe(false);
      expect(deadWinner?.isWinner).toBe(true);
      expect(raw).toEqual(before);
    });
