/**
 * 浏览器集成测试验证噩梦之影恐惧与猎人开枪的两语归档。
 * 输入为录制事件；输出以字面席位／胜者预期核对恐惧不直接杀人、终局枪击仍可见，只播放和跳转原复盘。
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const locale of ["zh-CN", "en"] as const)
  test(`nightmare fear is not a death and terminal Hunter shot remains visible/${locale}`, async ({
    page,
  }) => {
    const replay = readReplayDocument(
      JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/nightmare-${locale}.replay.json`),
          "utf8",
        ),
      ),
    );
    const fear = replay.events.find((e) => e.type === "nightmare_fear_committed")!;
    const label = eventLabel(fear, locale);
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    await page.locator(".timeline .event").filter({ hasText: label }).first().click();
    await expect(page.getByTestId("composition-event")).toHaveText(label);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
    await expect(page.getByTestId("composition-winner")).toHaveCount(0);
    await expect(page.locator("[data-composition-player]")).toHaveCount(12);
    await page.locator(".timeline .event").last().click();
    await expect(page.locator(".seat-grid .dead")).toHaveCount(6);
    await expect(page.getByTestId("composition-winner")).toHaveCount(8);
  });
