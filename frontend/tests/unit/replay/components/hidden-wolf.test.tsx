/**
 * 单元组件测试验证隐狼继承归档。输入为六／十二人 fixture 和两语帧号；
 * 输出以字面继承事实及胜者名单检查继承不改身份／生命、后续真实死亡独立发生，并核纯帧与数据不变，不运行继承规则。
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
import king from "../../../fixtures/six-player-hidden-wolf-king-link/hidden-wolf-king-link/zh-CN/god.replay.json";
import twelve from "../../../fixtures/twelve-player-hidden-wolf-twelve/hidden-wolf-twelve/zh-CN/god.replay.json";
for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: actual Hidden Wolf inheritance changes no seat/identity and the later real death preserves membership and pure frames`, () => {
      const raw = structuredClone(large ? twelve : king);
      raw.meta.locale = locale;
      const before = structuredClone(raw),
        replay = readReplayDocument(raw),
        index = replay.events.findIndex((e) => e.type === "hidden_wolf_awakened"),
        event = replay.events[index],
        previous = buildReplaySnapshot(replay, index - 1),
        snapshot = buildReplaySnapshot(replay, index);
      expect(event.payload).toEqual({ actorId: 1, day: large ? 2 : 1 });
      expect(snapshot.players).toEqual(previous.players);
      expect(snapshot.players.find((p) => p.playerId === 1)!.alive).toBe(true);
      expect(snapshot.decision).toBeNull();
      const label =
        locale === "en"
          ? `Hidden Wolf 1 inherits the knife on day ${large ? 2 : 1}`
          : `1号隐狼在第${large ? 2 : 1}天获得刀权`;
      expect(eventLabel(event, locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
      expect(buildReplayFrame(input, frame).label).toBe(label);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(label);
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      const final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(final.players.find((p) => p.playerId === 1)!.alive).toBe(false);
      expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual(
        large ? [5, 6, 7, 8, 9, 10, 11, 12] : [3, 4, 5, 6],
      );
      expect(raw).toEqual(before);
    });
