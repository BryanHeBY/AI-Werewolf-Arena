/**
 * Browser integration tests render the actual paid-but-aborted Radiant Eclipse
 * archive in both locales. Recorded events supply captions and literal absence
 * assertions check that neither night two nor a winner is announced. The test
 * only renders the incomplete record and does not resume its game.
 */
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
          frontendFixtureURL(`frontend/tests/fixtures/radiant-failed-paid-potion-${locale}.replay.json`),
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
      await expect(page.getByTestId("composition-event")).toHaveText(eventLabel(e, locale));
      expect(
        (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number),
      ).toEqual([10, 11]);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      const i = input.replay.events.findIndex((x) => x.seq === e.seq),
        slider = page.locator('.frame-control input[type="range"]');
      for (const frame of [i * 90 + 45, i * 90 - 1, 0]) {
        await slider.evaluate((el, v) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            el,
            String(v),
          );
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, frame);
        await expect(slider).toHaveValue(String(frame));
        await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      }
    }
    expect(await page.locator(".seat-grid .dead .seat-number").allTextContents()).toEqual([]);
  });
