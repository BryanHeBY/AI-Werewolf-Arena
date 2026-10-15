/**
 * 单元组件测试验证两种赠予来源在时间线和视频中的中性行动阶段。输入为真实赠予归档及字面历史事件变体；
 * 输出检查 abilityId、原事件／stage 身份、保留提示与字幕一致性，原生行动仍用归档阶段；不改变库存或从 actor 角色猜来源。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { eventLabel } from "../../../../src/replay/event-labels";
import { eventStageName, stageName } from "../../../../src/replay/replay-localization";
import {
  buildReplayFrame,
  createReplayRenderInput,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
import merchant from "../../../fixtures/twelve-player-merchant-twelve/merchant-twelve/en/god.replay.json";
import blackMarket from "../../../fixtures/six-black-late-hold/black-market-late-hold/en/god.replay.json";
import blackCheck from "../../../fixtures/six-black-check-duplicate/black-market-check-duplicate/en/god.replay.json";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: both gift origins use neutral action stages in timeline and video while preserving archived event IDs`, () => {
    for (const fixture of [merchant, blackMarket, blackCheck]) {
      const before = structuredClone(fixture);
      const replay = readReplayDocument(fixture);
      const ids = replay.players.map((player) => player.player_id);
      const events = replay.events.filter(
        (event) =>
          ["seer_checked", "witch_potion_used", "guard_applied"].includes(event.type) &&
          typeof event.payload.abilityId === "string" &&
          event.payload.abilityId.startsWith("gift:"),
      );
      expect(events.length).toBeGreaterThan(0);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      for (const event of events) {
        const stage = locale === "en" ? "Gifted ability action" : "受赠能力行动";
        expect(eventStageName(event, locale, ids)).toBe(stage);
        const frame = buildReplayFrame(
          input,
          input.replay.events.findIndex((item) => item.seq === event.seq) * FRAMES_PER_EVENT,
        );
        expect(frame.stage).toBe(stage);
        expect(frame.label).toBe(eventLabel(event, locale, ids));
        const markup = renderToStaticMarkup(
          <EventTimeline
            events={[event]}
            locale={locale}
            playerIds={ids}
            activeEventSeq={event.seq}
            focusedPlayerId={null}
            onJumpTo={() => {}}
            onClearFocus={() => {}}
          />,
        );
        expect(markup).toContain(stage);
        // 原生行动仍使用归档 stage 名，不从 actor 的角色猜测阶段。
        const native: ReplayEvent = {
          ...event,
          payload: { ...event.payload, abilityId: "native:seer" },
        };
        expect(eventStageName(native, locale, ids)).toBe(
          stageName(event.stage ?? event.type, locale),
        );
      }
      expect(fixture).toEqual(before);
    }
  });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: the historical lucky skip event describes a held gift neutrally for either origin`, () => {
    const replay = readReplayDocument(blackMarket);
    const original = replay.events.find((event) => event.type === "lucky_ability_skipped")!;
    for (const abilityId of ["gift:black-market", "gift:miracle"]) {
      const event = { ...original, payload: { ...original.payload, abilityId } };
      expect(eventLabel(event, locale)).toBe(
        text(locale, "replay.gift_ability_skipped", {
          actor: original.payload.actorId as number,
          day: original.payload.day as number,
          ability: abilityId,
        }),
      );
      expect(eventLabel(event, locale)).not.toMatch(/幸运|Lucky/);
      expect(eventStageName(event, locale)).toBe(
        locale === "en" ? "Gifted ability held" : "保留受赠技能",
      );
      expect(event.type).toBe("lucky_ability_skipped");
    }
    expect(stageName("lucky", locale)).toBe(
      locale === "en" ? "Gifted ability action" : "受赠能力行动",
    );
    expect(stageName("black_market_recipient", locale)).not.toMatch(/幸运|Lucky/);
  });
