/**
 * 浏览器集成测试负责读取猎魔人不同人数、胜利政策和语言的 God／本人归档。
 * 输入为既有 replay/checkpoint；输出检查选择时点的存活席位、他人身份遮蔽及终局猎人追加死亡链。
 * 字面胜者预期与归档对照分别保留；浏览器不执行决斗或游戏规则。
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { eventLabel } from "../../src/replay/event-labels";
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
const read = (name: string) =>
  JSON.parse(readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}`), "utf8"));
for (const size of [6, 12])
  for (const goal of ["slaughter_city", "slaughter_side"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${goal}/${locale}: actual God choice has no premature deaths and final native winners`, async ({
        page,
      }) => {
        const key = `demon-hunter-${size}-${goal}`,
          replay = read(`${key}.replay.json`),
          cp = read(`checkpoints/${key}.json`);
        replay.meta.locale = locale;
        const chosen = replay.events.find((e: any) => e.type === "demon_hunter_chosen"),
          label = eventLabel(
            chosen,
            locale,
            replay.players.map((p: { player_id: number }) => p.player_id),
            replay.players.map((p: { player_id: number; name?: string }) => ({
              id: p.player_id,
              name: p.name,
            })),
          );
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        await page.locator(".timeline .event").filter({ hasText: label }).click();
        await expect(page.locator(".current-event > p")).toHaveText(label);
        await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
        await expect(
          page.locator(`[data-composition-player="${chosen.payload.actorId}"]`),
        ).toContainText(locale === "en" ? "Demon Hunter" : "猎魔人");
        await page.locator(".timeline .event").last().click();
        await expect(page.locator(".seat-grid .dead")).toHaveCount(
          cp.players.filter((p: any) => !p.alive).length,
        );
        await expect(page.getByTestId("composition-winner")).toHaveCount(size === 6 ? 4 : 9);
        if (size === 12 && goal === "slaughter_city")
          await page.screenshot({
            path: `/tmp/awa-p9-demon-${locale}-browser.png`,
            fullPage: true,
          });
      });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual owner lean choice reveals no other role and no God toxin outcome`, async ({
    page,
  }) => {
    const god = read("demon-hunter-12-slaughter_city.replay.json"),
      view = readReplayPlayerView(read("player-views/demon-hunter-12-slaughter_city.player.json"));
    const own = view.timeline.find(
      (r) => r.kind === "event" && r.event.type === "demon_hunter_chosen",
    );
    if (!own || own.kind !== "event") throw new Error("missing_owner_choice");
    const event = {
      seq: 2,
      timestamp: own.timestamp!,
      phase: own.phase,
      day: own.day,
      type: own.event.type,
      payload: own.event.payload,
    };
    expect(event.payload).not.toHaveProperty("actorId");
    const replay = {
      ...god,
      meta: { ...god.meta, locale },
      players: god.players.map((p: any) => ({
        ...p,
        role: p.player_id === view.player_id ? view.role : "unknown",
        camp: p.player_id === view.player_id ? view.camp : "unknown",
      })),
      events: [
        {
          seq: 1,
          timestamp: event.timestamp,
          phase: "night",
          day: 2,
          type: "phase_changed",
          payload: { phase: "night", day: 2 },
        },
        event,
      ],
    };
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const label = eventLabel(
      event,
      locale,
      replay.players.map((p: { player_id: number }) => p.player_id),
      replay.players.map((p: { player_id: number; name?: string }) => ({
        id: p.player_id,
        name: p.name,
      })),
    );
    await page.locator(".timeline .event").filter({ hasText: label }).click();
    await expect(page.locator(".current-event > p")).toHaveText(label);
    for (const p of replay.players.filter((p: any) => p.player_id !== view.player_id))
      await expect(page.locator(`[data-composition-player="${p.player_id}"]`)).toContainText(
        "unknown",
      );
    await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
  });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: terminal Night includes Hunter extra death and dead Good winners before Day`, async ({
    page,
  }) => {
    const replay = read("demon-hunter-terminal.replay.json"),
      cp = read("checkpoints/demon-hunter-terminal.json");
    replay.meta.locale = locale;
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    await page.locator(".timeline .event").last().click();
    await expect(page.locator(".seat-grid .dead")).toHaveCount(4);
    await expect(page.getByTestId("composition-winner")).toHaveCount(9);
    const deadIds = await page.locator(".seat-grid .dead .seat-number").allTextContents();
    expect(deadIds.map(Number)).toEqual(
      cp.players.filter((p: any) => !p.alive).map((p: any) => p.id),
    );
  });
