/**
 * 浏览器集成测试支持层负责验证分页舞台字幕仍完整覆盖原全文。输入为原复盘、独立 expected seq／全文及显示选项，输出实际 DOM 断言。
 * 当前全文区域保留严格原文预期；视频发言正文来自独立归档原话，其他说明沿用调用方字面全文。长文只读取帧区间和页数作导航，逐页读取真实中央场景 DOM 后拼接。
 * 本层不拿编译字幕页生成 expected，不改变存活／身份／胜者预期；采样后恢复原帧，后续边界与逆向断言不受影响。
 */
import { expect, type Locator, type Page } from "@playwright/test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { ReplayDisplayOptions } from "../../src/replay/replay-display";
import { replayBrowserPlan } from "./replay-browser-frame";

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
  await expect(page.locator(".current-event > p")).toHaveText(expected.text);
  await expect(marker).toHaveAttribute("data-event-seq", String(expected.seq));
  const shot = replayBrowserPlan(replay, display).shots.find(
    (item) => item.kind === "event" && item.eventSeq === expected.seq,
  );
  if (!shot) throw new Error(`browser_caption_event_missing:${expected.seq}`);
  const event = replay.events.find((item) => item.seq === expected.seq)!;
  const expectedBody =
    ["day_speech", "last_words_spoken", "wolf_discussion"].includes(event.type) &&
    typeof event.payload.text === "string"
      ? event.payload.text
      : expected.text;
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
        shot.from +
          Math.max(
            shot.scene.cues.impact,
            Math.ceil((index * shot.durationFrames) / shot.captionPages.length),
          ),
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
