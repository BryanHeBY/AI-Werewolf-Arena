/**
 * 组件单元测试负责读取本轮真实合成传输导出的两语God教学归档并渲染时间线和帧。
 * 输入为公开示例、事件序号与帧号；独立预期是六个乌鸦事件合法、文案自然且不直接改变生命或公开身份。
 * 前后帧及反向跳转仅核展示边界，不运行游戏引擎重算规则，不把God样本当作玩家授权流。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
for (const locale of ["zh-CN", "en"] as const)
  test(`Crow真实God示例归档、时间线与frame/${locale}`, () => {
    const replay = readReplayDocument(
      JSON.parse(
        readFileSync(
          new URL(`../../../../../../docs/examples/crow/${locale}.replay.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      ids = replay.players.map((p) => p.player_id);
    const related = replay.events.filter((e) => e.type.startsWith("crow_"));
    expect(related).toHaveLength(6);
    for (const [index, e] of replay.events.entries())
      if (e.type.startsWith("crow_")) {
        const fact = readReplayEvent(e, ids);
        expect(fact).not.toBeNull();
        expect(fact!.effects).toEqual([]);
        const before = buildReplaySnapshot(replay, index - 1),
          after = buildReplaySnapshot(replay, index);
        expect(after.players).toEqual(before.players);
        const renderedIndex = input.replay.events.findIndex((row) => row.seq === e.seq);
        expect(buildReplayFrame(input, renderedIndex * 90 + 45).snapshot).toEqual(after);
        if (renderedIndex > 0)
          expect(buildReplayFrame(input, renderedIndex * 90 - 1).snapshot.players).toEqual(
            before.players,
          );
        const label = eventLabel(e, locale, ids);
        expect(label).not.toMatch(/[{}]|targetId|NaN|undefined/);
        if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
        expect(readReplayEvent({ ...e, day: e.day + 1 }, ids)).toBeNull();
        expect(
          readReplayEvent({ ...e, payload: { ...e.payload, actorCamp: "wolf" } }, ids),
        ).toBeNull();
      }
    const timeline = renderToStaticMarkup(
      <EventTimeline
        events={related as ReplayEvent[]}
        locale={locale}
        playerIds={ids}
        activeEventSeq={related[0]!.seq}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(timeline).toContain(locale === "en" ? "one extra vote" : "额外计1票");
    expect(timeline).not.toMatch(/undefined|NaN/);
    expect(renderToStaticMarkup(<ReplayFrame input={input} frame={0} />)).not.toMatch(
      /undefined|NaN/,
    );
  });
