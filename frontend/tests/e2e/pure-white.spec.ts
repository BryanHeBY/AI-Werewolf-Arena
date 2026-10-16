/**
 * 浏览器集成测试验证纯白之女／狼巫不同查验目标的两语归档。
 * 输入为原查验与死亡事件；输出按字面死亡／胜者数量核对同时死亡和终局时点，不执行查验或死亡结算。
 */
import { withPlayerNames } from "../support/named-label-expectation";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { eventLabel } from "../../src/replay/event-labels";
for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["wolf", "good"] as const)
    test(`${locale}/${kind}: inspection precedes simultaneous deaths and final faction winners`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/pure-white-${kind}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      const inspection = replay.events.filter((e: any) => e.type === "role_inspected")[2];
      const expectedRole =
        kind === "wolf"
          ? locale === "en"
            ? "Wolf Witch"
            : "狼巫"
          : locale === "en"
            ? "Werewolf"
            : "狼人";
      const label = withPlayerNames(
        locale === "en"
          ? `Player ${inspection.payload.actorId} inspects player ${inspection.payload.targetId}'s role: ${expectedRole}`
          : `${inspection.payload.actorId}号查验${inspection.payload.targetId}号的具体角色：${expectedRole}`,
        replay.players,
        locale,
      );
      expect(
        eventLabel(
          inspection,
          locale,
          replay.players.map((p: { player_id: number }) => p.player_id),
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        ),
      ).toBe(label);
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await page.locator(".timeline .event").filter({ hasText: label }).last().click();
      await expect(page.getByTestId("composition-event")).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(3);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      await expect(page.locator("[data-composition-player]")).toHaveCount(12);
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .dead")).toHaveCount(kind === "wolf" ? 6 : 7);
      await expect(page.getByTestId("composition-winner")).toHaveCount(kind === "wolf" ? 4 : 8);
    });
