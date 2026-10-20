/**
 * 实际本地协议产出的God示例验证典狱长四类秘密事实、关联席位、自然语言与帧回退。
 * 交易事实不是实际死亡提交，显示选择/决定/提案不能自行改生命或公开身份；逐玩家受众另由后端验收。
 * 验证层级为前端组件／纯投影单元；预期文字与本族事件数量独立写定，真实God样本不替代权限证明。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
for (const locale of ["zh-CN", "en"] as const)
  test(`真实Warden God归档两语时间线与倒看/${locale}`, () => {
    const replay = readReplayDocument(
        JSON.parse(
          readFileSync(
            new URL(
              `../../../../../../docs/examples/warden/${locale}.replay.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      ),
      ids = replay.players.map((p) => p.player_id),
      input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
    const family = replay.events.filter((e) => e.type.startsWith("warden_"));
    expect(family).toHaveLength(12);
    expect(new Set(family.map((e) => e.type)).size).toBe(4);
    for (const e of family) {
      const parsed = readReplayEvent(e, ids);
      expect(parsed).not.toBeNull();
      expect(parsed!.effects).toEqual([]);
      const i = replay.events.indexOf(e),
        before = buildReplaySnapshot(replay, i - 1),
        after = buildReplaySnapshot(replay, i);
      expect(after.players).toEqual(before.players);
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/undefined|NaN|actorId|policy|target_ids/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(readReplayEvent({ ...e, day: 1 }, ids)).toBeNull();
      expect(
        readReplayEvent({ ...e, payload: { ...e.payload, otherSecret: "forged" } }, ids),
      ).toBeNull();
      const seq = input.replay.events.findIndex((r) => r.seq === e.seq);
      expect(buildReplayFrame(input, seq * 90 + 45).snapshot).toEqual(after);
    }
    const timeline = renderToStaticMarkup(
      <EventTimeline
        events={replay.events}
        locale={locale}
        playerIds={ids}
        activeEventSeq={family[0]!.seq}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(timeline).toContain(locale === "en" ? "sealed" : "秘密");
    expect(timeline).not.toMatch(/undefined|NaN/);
    expect(renderToStaticMarkup(<ReplayFrame input={input} frame={450} />)).not.toMatch(
      /undefined|NaN/,
    );
    const final = buildReplaySnapshot(replay, replay.events.length - 1),
      rewound = buildReplaySnapshot(replay, 0);
    expect(final.players.filter((p) => !p.alive).length).toBeGreaterThan(0);
    expect(rewound.players.every((p) => p.alive)).toBe(true);
  });
