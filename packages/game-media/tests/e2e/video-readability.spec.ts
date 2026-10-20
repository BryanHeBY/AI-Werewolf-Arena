/**
 * 浏览器集成层负责全画布页眉居中、生命首波和Web主阅读面验收。输入为独立手写12席归档，不调用对局或语音服务。
 * 镜头只用于定位；死亡名单、原文折叠和布局中心均由字面预期及实际DOM几何核对，倒看不能提前提交连锁波。
 */
import { expect, test, type Page } from "@playwright/test";
import { VIDEO_BROWSER_ORIGIN } from "../support/browser-hosts";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../src/video/compiler";
import { getVideoSourceIdentity } from "../../src/video/source";

function recording(): ReplayDocument {
  const players = [
    "wolf",
    "witch",
    "villager",
    "seer",
    "wolf",
    "wolf",
    "villager",
    "wolf_beauty",
    "guard",
    "villager",
    "knight",
    "villager",
  ].map((role, index) => ({
    player_id: index + 1,
    role,
    camp: [0, 4, 5, 7].includes(index) ? "wolf" : "good",
  }));
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "readability-acceptance-non-game",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players,
    events: [
      {
        seq: 1,
        timestamp: "t",
        day: 4,
        phase: "night",
        type: "god_private_game_info",
        payload: { players: players.map((p) => ({ id: p.player_id, role: p.role, camp: p.camp })) },
      },
      {
        seq: 2,
        timestamp: "t",
        day: 4,
        phase: "day",
        type: "phase_changed",
        payload: { phase: "day", day: 4 },
      },
      {
        seq: 3,
        timestamp: "t",
        day: 4,
        phase: "day",
        type: "night_resolved",
        payload: { deaths: [7, 8] },
      },
      {
        seq: 4,
        timestamp: "t",
        day: 4,
        phase: "day",
        type: "additional_deaths",
        payload: { deaths: [2] },
      },
    ],
    factCoverage: { committedDeaths: 1 },
    facts: [
      {
        seq: 1,
        afterSeq: 3,
        kind: "life_committed",
        day: 4,
        playerId: 7,
        alive: false,
        causes: ["wolf_kill"],
        waveId: 6,
      },
      {
        seq: 2,
        afterSeq: 3,
        kind: "life_committed",
        day: 4,
        playerId: 8,
        alive: false,
        causes: ["poison"],
        waveId: 6,
      },
      {
        seq: 3,
        afterSeq: 3,
        kind: "life_committed",
        day: 4,
        playerId: 2,
        alive: false,
        causes: ["charm"],
        waveId: 7,
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
test("the complete phase label stays at the canvas center despite unequal title/alive widths in either language", async ({
  page,
}) => {
  const doc = recording();
  for (const locale of ["zh-CN", "en"] as const) {
    const plan = compileVideoPlan(
      doc,
      { source: getVideoSourceIdentity(doc), layout: "broadcast-v1", pacing: "narration" },
      { locale, timeZone: "UTC" },
    );
    await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
    await page.goto(`${VIDEO_BROWSER_ORIGIN}/`);
    // 两个应用的根路径不同；独立页面标题防止测试误落到复盘的 SPA fallback。
    await expect(page).toHaveTitle("AI Werewolf Arena · Video Preview");
    await seek(page, plan.shots[1]!.from + 4);
    await page.evaluate(() => document.fonts.ready);
    const canvas = await page.locator('[data-video-layout="broadcast-v1"]').boundingBox();
    const phase = await page.getByTestId("composition-phase").boundingBox();
    expect(Math.abs(phase!.x + phase!.width / 2 - canvas!.x - canvas!.width / 2)).toBeLessThan(1);
    await page.unroute("**/api/video/plan");
  }
});
test("Web shows structured identities and committed waves once, keeps the original expandable and restores state on reverse seek", async ({
  page,
}) => {
  const doc = recording();
  doc.events.push({
    seq: 5,
    timestamp: "t",
    day: 4,
    phase: "night",
    type: "witch_potion_used",
    payload: { actorId: 10, targetId: 12, potionType: "poison" },
  });
  const plan = compileVideoPlan(doc);
  await page.route("**/api/replay", (route) => route.fulfill({ json: doc }));
  await page.goto("/");
  await expect(page).toHaveTitle("AI Werewolf Arena · Replay Studio");
  await seek(page, 4);
  const current = page.locator(".current-event");
  await expect(current.locator("[data-lineup-player]")).toHaveCount(12);
  const original = current.locator("[data-original-announcement]");
  await expect(original).not.toHaveAttribute("open");
  await original.locator("summary").click();
  await expect(original.locator("p")).toContainText("角色分布");
  await original.locator("summary").click();
  const death = plan.shots[2]!,
    chain = plan.shots[3]!;
  await seek(page, death.from + 2);
  await expect(page.locator('[data-composition-player="7"]')).toHaveAttribute(
    "data-player-alive",
    "true",
  );
  await seek(page, death.from + 3);
  await expect(current.locator("[data-life-player]")).toHaveCount(2);
  await expect(current.locator("[data-life-player='7']")).toContainText("狼刀");
  await expect(current.locator("[data-life-player='8']")).toContainText("毒药");
  await expect(current.locator("[data-current-structured-content]")).not.toContainText(
    "未选择目标",
  );
  await expect(page.locator('[data-composition-player="2"]')).toHaveAttribute(
    "data-player-alive",
    "true",
  );
  await seek(page, chain.from + 3);
  await expect(current.locator("[data-life-player='2']")).toContainText("狼美人牵连");
  await expect(page.locator('[data-composition-player="2"]')).toHaveAttribute(
    "data-player-alive",
    "false",
  );
  await seek(page, death.from + 2);
  await expect(page.locator('[data-composition-player="7"]')).toHaveAttribute(
    "data-player-alive",
    "true",
  );
  await expect(page.locator('[data-composition-player="2"]')).toHaveAttribute(
    "data-player-alive",
    "true",
  );
  const action = plan.shots.find((shot) => shot.eventSeq === 5)!;
  await seek(page, action.from + action.scene.cues.impact);
  await expect(current.locator("[data-original-announcement]")).toHaveCount(0);
  await expect(current.getByLabel("当前事件全文")).toBeVisible();
  await expect(current.getByLabel("当前事件全文")).toContainText("毒");
});
