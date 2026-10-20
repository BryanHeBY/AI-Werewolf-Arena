/**
 * 浏览器集成层验证角色字色、动作配色与活动状态互不混淆。输入为手写12席展示验收记录，不运行规则、模型或语音。
 * 颜色/名单由字面预期指定；狼美人投刀与普通狼人必须同色，未知底牌不从技能或报告反推，左右渐变须镜像。
 */
import { expect, test, type Page } from "@playwright/test";
import { VIDEO_BROWSER_ORIGIN } from "../support/browser-hosts";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../src/video/compiler";
import { getVideoEventFrame } from "../../src/video/frame";
import { getVideoSourceIdentity } from "../../src/video/source";
import type { VideoPlan } from "../../src/video/types";

test.use({ viewport: { width: 1600, height: 1000 } });
function recording(): ReplayDocument {
  const roles = [
    "wolf",
    "witch",
    "villager",
    "seer",
    "wolf_king",
    "hunter",
    "mechanical_wolf",
    "wolf_beauty",
    "guard",
    "unknown",
    "knight",
    "idiot",
  ];
  const players = roles.map((role, index) => ({
    player_id: index + 1,
    role,
    camp: [1, 5, 7, 8].includes(index + 1) ? "wolf" : role === "unknown" ? "unknown" : "good",
  }));
  const row = (
    seq: number,
    type: string,
    payload: ReplayEvent["payload"],
    phase = "night",
  ): ReplayEvent => ({
    seq,
    type,
    payload,
    phase,
    day: 1,
    timestamp: "acceptance",
    stage: phase === "day" ? "sheriff" : "night",
  });
  return {
    schemaVersion: 2,
    sessionId: "role-colors-explicit-non-game",
    perspective: "god",
    meta: { board: "visual acceptance", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players,
    events: [
      row(1, "god_private_game_info", {
        players: players.map((p) => ({ id: p.player_id, role: p.role, camp: p.camp })),
      }),
      row(2, "phase_changed", { phase: "day" }, "day"),
      row(3, "sheriff_nomination_summary", { candidates: [1, 4, 5, 11] }, "day"),
      row(
        4,
        "day_speech",
        { actorId: 1, text: "独立视觉验收：警上名单与真实角色颜色分开。" },
        "day",
      ),
      row(5, "sheriff_withdraw_summary", { withdrawn: [5] }, "day"),
      row(6, "phase_changed", { phase: "night" }),
      row(7, "seer_checked", { actorId: 4, targetId: 8, result: "wolf" }),
      row(8, "witch_potion_used", { actorId: 2, targetId: 8, potionType: "poison" }),
      row(9, "wolf_kill_vote_cast", { actorId: 1, targetId: 3, abstain: false }),
      row(10, "wolf_kill_vote_cast", { actorId: 8, targetId: 3, abstain: false }),
      // 明确的能力记录不是本体身份披露；10号底牌始终未知，但执行查验仍使用查验色。
      row(11, "seer_checked", { actorId: 10, targetId: 8, result: "wolf" }),
      row(12, "mechanical_attack_chosen", { actorId: 7, targetId: 3, day: 1 }),
      row(13, "awakened_attack_chosen", { actorId: 8, targetId: 3, day: 1 }),
      row(14, "mechanical_poison_used", { actorId: 7, targetId: 3, day: 1 }),
      row(15, "mechanical_shot", { actorId: 7, targetId: 3 }),
      row(16, "wolf_king_shot", { actorId: 5, targetId: 12 }),
    ],
  };
}
async function seek(page: Page, plan: VideoPlan, seq: number) {
  const frame = getVideoEventFrame(plan, seq);
  if (frame === null) throw new Error(`role_color_missing_seq:${seq}`);
  const slider = page.locator('.frame-control input[type="range"]');
  await slider.evaluate((el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      el,
      String(value),
    );
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, frame);
  await expect(slider).toHaveValue(String(frame));
}
for (const theme of ["gothic-v1", "minimal-v1"] as const)
  test(`${theme}: neutral resting cards preserve role inks while nominations, withdrawal and action fills stay explicit`, async ({
    page,
  }) => {
    const replay = recording();
    const plan = compileVideoPlan(replay, {
      source: getVideoSourceIdentity(replay),
      layout: "broadcast-v1",
      theme: { id: theme },
    });
    await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
    await page.goto(`${VIDEO_BROWSER_ORIGIN}/`);
    const card = (id: number) => page.locator(`[data-composition-player="${id}"]`);
    await seek(page, plan, 1);
    for (const id of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]) {
      await expect(card(id)).toHaveCSS("background-image", "none");
      expect(await card(id).evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(
        await card(6).evaluate((el) => getComputedStyle(el).borderTopColor),
      );
    }
    await expect(card(1).locator("[data-role-label]")).toHaveCSS("color", "rgb(243, 180, 187)");
    await expect(card(8).locator("[data-role-label]")).toHaveCSS("color", "rgb(240, 180, 202)");
    await expect(page.locator('[data-lineup-role="witch"]')).toHaveCSS(
      "color",
      "rgb(211, 188, 231)",
    );
    await expect(card(10)).toHaveAttribute("data-role-color-key", "neutral");
    await seek(page, plan, 4);
    for (const id of [1, 4, 5, 11]) {
      await expect(card(id)).toHaveAttribute("data-roster-activity-status", "candidate");
      expect(await card(id).evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
        "linear-gradient",
      );
    }
    const direction = (id: number) =>
      card(id).evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(await direction(4)).toContain("90deg");
    expect(await direction(11)).toContain("270deg");
    await expect(card(1)).toHaveCSS("border-top-width", "5px");
    await expect(card(2)).toHaveCSS("background-image", "none");
    await expect(card(4)).toHaveCSS(
      "border-top-color",
      theme === "gothic-v1" ? "rgb(185, 154, 97)" : "rgb(155, 109, 23)",
    );
    await seek(page, plan, 5);
    await expect(card(5)).toHaveCSS("border-top-style", "dashed");
    await expect(card(5)).toHaveCSS("background-image", "none");
    for (const [seq, id, key, rgb] of [
      [7, 4, "azure", "rgb(163, 201, 232)"],
      [8, 2, "amethyst", "rgb(211, 188, 231)"],
      [9, 1, "blood", "rgb(243, 180, 187)"],
      [10, 8, "blood", "rgb(243, 180, 187)"],
      [11, 10, "azure", "rgb(163, 201, 232)"],
      [12, 7, "blood", "rgb(243, 180, 187)"],
      [13, 8, "blood", "rgb(243, 180, 187)"],
      [14, 7, "amethyst", "rgb(211, 188, 231)"],
      [15, 7, "ochre", "rgb(222, 192, 139)"],
      [16, 5, "ochre", "rgb(222, 192, 139)"],
    ] as const) {
      await seek(page, plan, seq);
      await expect(card(id)).toHaveAttribute("data-player-acting", "true");
      await expect(card(id)).toHaveCSS("border-top-color", rgb);
      expect(await direction(id)).toContain(id <= 6 ? "90deg" : "270deg");
      await expect(page.locator("[data-action-color-key]")).toHaveAttribute(
        "data-action-color-key",
        key,
      );
    }
    await expect(card(10)).toHaveAttribute("data-visible-role", "unknown");
    await seek(page, plan, 1);
    await expect(card(10)).toHaveCSS("background-image", "none");
  });

test("Web seats use the same semantic action fill, keep unknown identity neutral and clear color on reverse seek", async ({
  page,
}) => {
  const replay = recording(),
    plan = compileVideoPlan(replay);
  await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
  await page.goto("/");
  for (const [seq, id] of [
    [7, 4],
    [8, 2],
    [9, 1],
    [10, 8],
    [11, 10],
    [12, 7],
    [13, 8],
    [14, 7],
    [15, 7],
    [16, 5],
  ] as const) {
    await seek(page, plan, seq);
    const web = page.locator(`.seat-grid [data-player-id="${id}"]`),
      video = page.locator(`[data-composition-player="${id}"]`);
    await expect(web).toHaveAttribute("data-player-acting", "true");
    const ownInk = await web.locator(".seat-role").evaluate((el) => getComputedStyle(el).color);
    if (id === 8 || id === 10)
      expect(ownInk).not.toBe(await web.evaluate((el) => getComputedStyle(el).borderTopColor));
    // Web夜间与哥特视频暗面使用同一套动作色。
    expect(await web.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(
      await video.evaluate((el) => getComputedStyle(el).borderTopColor),
    );
    expect(await web.getAttribute("style")).toContain("color-mix");
  }
  await expect(page.locator('.seat-grid [data-player-id="10"]')).toHaveAttribute(
    "data-visible-role",
    "unknown",
  );
  await seek(page, plan, 4);
  await expect(page.locator('.seat-grid [data-player-id="10"]')).not.toHaveAttribute(
    "data-player-acting",
    "true",
  );
  const candidate = page.locator('.seat-grid [data-player-id="4"]');
  expect(await candidate.getAttribute("style")).toContain("18%");
  const idle = page.locator('.seat-grid [data-player-id="2"]');
  expect(await idle.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
});
