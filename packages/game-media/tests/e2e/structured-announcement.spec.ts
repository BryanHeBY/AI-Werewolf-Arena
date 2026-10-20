/**
 * 浏览器集成层验证真实字体后的开局身份网格和显式角色／阵营色。输入为手写非真实12席God记录，覆盖默认中文与英文大字。
 * 身份、颜色与原文来自独立fixture字面值；计划只定位揭晓／尾帧，不从scene.content自产预期，不执行对局或TTS。
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../src/video/compiler";
import { getVideoSourceIdentity } from "../../src/video/source";

const roles = [
  "wolf",
  "seer",
  "witch",
  "guard",
  "hunter",
  "villager",
  "awakened_idiot",
  "awakened_hidden_wolf",
  "awakened_wolf_beauty",
  "black_market_merchant",
  "night_noble",
  "cursed_fox",
];
function fixture(): ReplayDocument {
  const players = roles.map((role, index) => ({
    player_id: index + 1,
    role,
    camp: [0, 7, 8, 10].includes(index) ? "wolf" : index === 11 ? "third_party" : "good",
    name: `LONG NAME NOT REPEATED ${index + 1}`,
  }));
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "non-game-structured-announcement-acceptance",
    meta: { board: "non-game acceptance", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players,
    events: [
      {
        seq: 1,
        timestamp: "2026-10-19T00:00:00Z",
        day: 1,
        phase: "night",
        type: "god_private_game_info",
        payload: {
          players: players.map((player) => ({
            id: player.player_id,
            seat: player.player_id,
            role: player.role,
            camp: player.camp,
            name: "PRIVATE PAYLOAD NAME",
          })),
        },
      },
    ],
  };
}
async function seek(page: Page, frame: number) {
  const slider = page.locator('.frame-control input[type="range"]');
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
for (const [locale, theme, large] of [
  ["zh-CN", "gothic-v1", false],
  ["en", "minimal-v1", true],
] as const)
  test(`${locale}/${theme}/${large}: twelve structured opening identities keep full roles and camps without repeating the raw roster sentence`, async ({
    page,
  }) => {
    const replay = fixture();
    const plan = compileVideoPlan(
      replay,
      {
        source: getVideoSourceIdentity(replay),
        layout: "broadcast-v1",
        presentation: { anonymous: true },
        theme: { id: theme, options: { largeText: large } },
      },
      { locale, timeZone: "UTC" },
    );
    await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
    await page.goto("/video.html");
    const grid = page.locator('[data-announcement-kind="lineup"]');
    await expect(grid).toBeVisible();
    await expect(grid.locator("[data-lineup-player]")).toHaveCount(12);
    for (const [index, role] of roles.entries())
      await expect(
        grid.locator(`[data-lineup-player="${index + 1}"] [data-lineup-role]`),
      ).toHaveAttribute("data-lineup-role", role);
    await expect(grid.locator('[data-lineup-player="1"]')).toHaveAttribute(
      "data-lineup-camp",
      "wolf",
    );
    await expect(grid.locator('[data-lineup-player="2"]')).toHaveAttribute(
      "data-lineup-camp",
      "good",
    );
    await expect(grid.locator('[data-lineup-player="12"]')).toHaveAttribute(
      "data-lineup-camp",
      "third_party",
    );
    const campColors = await Promise.all(
      [1, 2, 12].map((id) =>
        grid
          .locator(`[data-lineup-player="${id}"] [data-lineup-camp-label]`)
          .evaluate((node) => getComputedStyle(node).color),
      ),
    );
    expect(new Set(campColors).size).toBe(3);
    await expect(grid).not.toContainText("LONG NAME NOT REPEATED");
    await expect(grid).not.toContainText("PRIVATE PAYLOAD NAME");
    await expect(grid).not.toContainText(locale === "en" ? "Role lineup:" : "角色分布：");
    await expect(grid.locator('[data-lineup-player="8"] [data-lineup-role]')).toHaveText(
      locale === "en" ? "Awakened Hidden Wolf" : "觉醒隐狼",
    );
    const viewport = page.locator("[data-reading-viewport]");
    await expect(viewport).toHaveAttribute("data-reading-ready", "true");
    const reading = plan.shots[0]!.reading!;
    await seek(page, reading.from + reading.durationFrames - reading.tailHoldFrames);
    const last = await grid.locator('[data-lineup-player="12"]').boundingBox();
    const window = await viewport.locator("[data-reading-window]").boundingBox();
    expect(last!.y + last!.height).toBeLessThanOrEqual(window!.y + window!.height + 1);
    const directory = resolve("../output/video-validation/structured-announcement");
    mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${locale}-${theme}.png`), fullPage: true });
  });
