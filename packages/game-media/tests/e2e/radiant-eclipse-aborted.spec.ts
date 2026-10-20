/**
 * 浏览器集成测试验证光蚀已付款但中止的两语归档。输入为不完整事件前缀；
 * 输出以原字幕对照和字面缺席断言核对未发表第二夜夜报、未出现胜者；只渲染失败记录，不恢复对局。
 */
import { replayBrowserFrame } from "../support/replay-browser-frame";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput } from "../../src/replay/replay-frame";
import { eventLabel } from "../../src/replay/event-labels";
for (const locale of ["en", "zh-CN"] as const)
  test(`Radiant actual paid aborted archive never announces night two or a winner/${locale}`, async ({
    page,
  }) => {
    const replay = readReplayDocument(
      JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/radiant-failed-paid-potion-${locale}.replay.json`,
          ),
          "utf8",
        ),
      ),
    );
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
    for (const e of replay.events.filter(
      (e) =>
        e.day === 2 &&
        [
          "witch_potion_used",
          "eclipse_swallowed",
          "eclipse_native_suppressed",
          "eclipse_lease_closed",
        ].includes(e.type),
    )) {
      await page
        .locator(".timeline .event")
        .filter({ hasText: `#${e.seq} ·` })
        .click();
      await expect(page.locator(".current-event > p")).toHaveText(
        eventLabel(
          e,
          locale,
          replay.players.map((p: { player_id: number }) => p.player_id),
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        ),
      );
      expect(
        (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number),
      ).toEqual([10, 11]);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      const i = input.replay.events.findIndex((x) => x.seq === e.seq),
        slider = page.locator('.frame-control input[type="range"]');
      for (const frame of [i * 90 + 45, i * 90 - 1, 0]) {
        await slider.evaluate(
          (el, v) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
              el,
              String(v),
            );
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          },
          replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" }),
        );
        await expect(slider).toHaveValue(
          String(replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" })),
        );
        await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      }
    }
    expect(await page.locator(".seat-grid .dead .seat-number").allTextContents()).toEqual([]);
  });
