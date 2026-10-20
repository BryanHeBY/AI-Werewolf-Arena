/**
 * 浏览器集成测试支持层负责验证分页舞台字幕仍完整覆盖原全文。输入为原复盘、独立 expected seq／全文及显示选项，输出实际 DOM 断言。
 * 当前全文区域保留严格原文预期；视频发言正文来自独立归档原话，警徽和终局逐字段核原记录，其他说明沿用调用方字面全文。长文只读取帧区间和页数作导航，逐页读取真实中央场景 DOM 后拼接。
 * 本层不拿编译字幕页生成 expected，不改变存活／身份／胜者预期；采样后恢复原帧，后续边界与逆向断言不受影响。
 */
import { currentEventSourceText } from "./replay-current-event";
import { expect, type Locator, type Page } from "@playwright/test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { text } from "@ai-werewolf-arena/game-text";
import type { ReplayDisplayOptions } from "../../src/replay/replay-display";
import { replayBrowserPlan, replayCaptionPageFrame } from "./replay-browser-frame";
import { replayOutcomeExpectation } from "./replay-outcome-expectation";

async function seek(slider: Locator, frame: number) {
  await slider.evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      element,
      String(value),
    );
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, frame);
  await expect(slider).toHaveValue(String(frame));
}

export async function expectReplayCaption(
  page: Page,
  replay: ReplayDocument,
  expected: { seq: number; text: string },
  display: ReplayDisplayOptions,
) {
  const marker = page.getByTestId("composition-event");
  await expect(currentEventSourceText(page)).toHaveText(expected.text);
  await expect(marker).toHaveAttribute("data-event-seq", String(expected.seq));
  const shot = replayBrowserPlan(replay, display).shots.find(
    (item) => item.kind === "event" && item.eventSeq === expected.seq,
  );
  if (!shot) throw new Error(`browser_caption_event_missing:${expected.seq}`);
  const event = replay.events.find((item) => item.seq === expected.seq)!;
  if (event.type === "sheriff_badge_transferred") {
    // 结构化警徽公告用原记录双方校验，不能拿生产 scene.content 或显示文本反推预期。
    const ids = [Number(event.payload.fromId), Number(event.payload.toId)];
    const badge = page.locator('[data-scene-announcement] [data-announcement-kind="badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("data-badge-operation", "transferred");
    await expect(badge.locator(":scope > div")).toHaveText(
      text(display.locale, "replay.stage.sheriff_badge_transferred"),
    );
    const players = badge.locator("[data-content-player]");
    await expect(players).toHaveText(
      ids.map((id) => {
        const player = replay.players.find((candidate) => candidate.player_id === id);
        const label = playerLabel(
          { id, ...(player?.seat === undefined ? {} : { seat: player.seat }) },
          display.locale,
        );
        return player?.name ? `${label} · ${player.name}` : label;
      }),
    );
    expect(
      await players.evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute("data-content-player"))),
      ),
    ).toEqual(ids);
    return;
  }
  if (event.type === "game_over") {
    const outcome = replayOutcomeExpectation(event, replay.players, display.locale);
    const block = page.locator('[data-end-fields] [data-content-block="outcome"]');
    await expect(block).toHaveCount(1);
    await expect(block.locator(":scope > strong")).toHaveText(outcome.primary);
    await expect(block.locator("[data-primary-result]")).toHaveCount(
      outcome.hasPrimaryClaim ? 1 : 0,
    );
    const additional = block.locator("[data-additional-result]");
    await expect(additional).toHaveCount(outcome.additional.length);
    for (const [index, claim] of outcome.additional.entries()) {
      await expect(additional.nth(index)).toHaveText(claim.text);
      expect(
        await additional
          .nth(index)
          .locator("[data-content-player]")
          .evaluateAll((nodes) =>
            nodes.map((node) => Number(node.getAttribute("data-content-player"))),
          ),
      ).toEqual(claim.ids);
    }
    const winners = block.locator(
      ":scope > div:not([data-additional-result]):not([data-outcome-reason])",
    );
    await expect(winners).toHaveCount(outcome.winnerIds === null ? 0 : 1);
    if (outcome.winnerIds !== null) {
      await expect(winners).toHaveText(outcome.winnersText!);
      await expect(winners.locator("[data-content-player]")).toHaveText(outcome.winnerLabels!);
      expect(
        await winners
          .locator("[data-content-player]")
          .evaluateAll((nodes) =>
            nodes.map((node) => Number(node.getAttribute("data-content-player"))),
          ),
      ).toEqual(outcome.winnerIds);
    }
    const reason = block.locator("[data-outcome-reason]");
    await expect(reason).toHaveCount(outcome.reason === null ? 0 : 1);
    if (outcome.reason !== null) await expect(reason).toHaveText(outcome.reason);
    return;
  }
  // 台词类型白名单直接取归档原文字段；不读取生产 scene.body 或字幕页来制造预期。
  const rawBody = [
    "day_speech",
    "last_words_spoken",
    "wolf_discussion",
    "debate_speech",
    "ghost_bride_partner_chat",
    "brew_discussion",
    "secret_body_reveal_speech",
    "silence_translated",
  ].includes(event.type)
    ? event.payload.text
    : event.type === "wolf_discussion_ended"
      ? event.payload.reason
      : event.type === "silence_gesture"
        ? event.payload.description
        : undefined;
  const expectedBody = typeof rawBody === "string" ? rawBody : expected.text;
  const caption = page.locator(
    "[data-scene-speech], [data-scene-announcement], [data-scene-result]",
  );
  if (shot.captionPages.length === 1) {
    await expect(caption).toHaveText(expectedBody);
    return;
  }
  const slider = page.locator('.frame-control input[type="range"]');
  const savedFrame = Number(await slider.inputValue());
  const texts: string[] = [];
  try {
    for (let index = 0; index < shot.captionPages.length; index++) {
      await seek(
        slider,
        replayCaptionPageFrame(shot, replayBrowserPlan(replay, display).layout, index),
      );
      await expect(marker).toHaveAttribute("data-event-seq", String(expected.seq));
      await expect(page.getByTestId("composition-caption")).toHaveAttribute(
        "data-caption-page",
        String(index),
      );
      const actual = await caption.textContent();
      expect(actual).not.toBeNull();
      expect(actual!.length).toBeGreaterThan(0);
      expect(expectedBody.startsWith(texts.join("") + actual!)).toBe(true);
      texts.push(actual!);
    }
    expect(texts.join("")).toBe(expectedBody);
  } finally {
    await seek(slider, savedFrame);
  }
  await expect(marker).toHaveAttribute("data-event-seq", String(expected.seq));
}
