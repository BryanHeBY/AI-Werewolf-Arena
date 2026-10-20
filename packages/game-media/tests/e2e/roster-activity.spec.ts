/**
 * 浏览器集成测试负责结构化夜聊／警上名单在真实HUD的颜色、虚线与揭晓边界。输入为明确非对局的手写6席公开记录。
 * 预期名单、发言者、颜色和原话均独立写明；计划只定位原seq生效帧，不从台词、阵营或编译view生成答案。
 * 不运行模型或规则，不修改历史fixture；倒看必须恢复原名单，匿名英文仍保留真实actor和可辨活动状态。
 */
import { expect, test, type Page } from "@playwright/test";
import { VIDEO_BROWSER_ORIGIN } from "../support/browser-hosts";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../src/video/compiler";
import { getVideoEventFrame } from "../../src/video/frame";
import { getVideoSourceIdentity } from "../../src/video/source";
import type { VideoPlan } from "../../src/video/types";

test.use({ viewport: { width: 1440, height: 960 } });

test("Web and video share the current speaker/action fill while left and right cards mirror its direction", async ({
  page,
}) => {
  const replay = acceptance([
    event(1, "phase_changed", { phase: "day" }, "day"),
    event(2, "day_speech", { actorId: 1, text: "独立验收：左侧发言，座次不推身份。" }, "day"),
    event(3, "day_speech", { actorId: 5, text: "独立验收：右侧发言，与左侧对称。" }, "day"),
    event(4, "guard_applied", { actorId: 1, targetId: 2, abstain: false }),
  ]);
  const plan = compileVideoPlan(replay);
  await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
  await page.goto("/");
  for (const [seq, id, direction] of [
    [2, 1, "90deg"],
    [3, 5, "270deg"],
  ] as const) {
    await seek(page, at(plan, seq));
    await expect(page.locator("[data-reading-viewport]")).toHaveAttribute(
      "data-reading-ready",
      "true",
    );
    const card = page.locator(`[data-composition-player="${id}"]`);
    await expect(card).toHaveAttribute("data-player-current", "true");
    await expect(card).toHaveCSS("border-top-width", "5px");
    expect(await card.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(direction);
    await expect(page.locator('.seat-grid [data-player-current="true"]')).toHaveCount(1);
    const web = page.locator(`.seat-grid [data-player-id="${id}"]`);
    await expect(web).toHaveAttribute("data-player-current", "true");
    await expect(web).toHaveCSS("border-top-width", "3px");
    expect(await web.evaluate((el) => el.getAttribute("style"))).toContain("color-mix");
  }
  await page.locator('.seat-grid [data-player-id="1"]').click();
  await expect(page.locator('.seat-grid [data-player-id="5"]')).toHaveAttribute(
    "data-player-current",
    "true",
  );
  await expect(page.locator('.seat-grid [data-player-id="1"]')).not.toHaveAttribute(
    "data-player-current",
    "true",
  );
  await screenshot(page, "web-right-speaker-final");
  const action = plan.shots.find((s) => s.eventSeq === 4)!;
  expect(action.durationFrames).toBe(60);
  expect(action.scene.cues.settled).toBeLessThanOrEqual(15);
  await seek(page, action.from);
  await expect(page.getByText("等待结果揭晓", { exact: true })).toHaveCount(0);
  await seek(page, at(plan, 4));
  await expect(page.locator('[data-composition-player="1"]')).toHaveAttribute(
    "data-player-current",
    "true",
  );
  await expect(page.locator('.seat-grid [data-player-id="1"]')).toHaveAttribute(
    "data-player-current",
    "true",
  );
  await screenshot(page, "web-action-final");
});

function acceptance(events: ReplayEvent[], unknown = false): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "explicit-roster-activity-acceptance-not-a-real-game",
    meta: { board: "non-game roster acceptance", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 6 }, (_, index) => ({
      player_id: index + 1,
      name: `Fixture Name ${index + 1}`,
      model: `Fixture Provider ${index + 1}`,
      role: unknown ? "unknown" : index < 2 ? "wolf" : "villager",
      camp: unknown ? "unknown" : index < 2 ? "wolf" : "good",
    })),
    events,
  };
}
function event(
  seq: number,
  type: string,
  payload: ReplayEvent["payload"],
  phase = "night",
): ReplayEvent {
  return {
    seq,
    type,
    payload,
    day: 1,
    phase,
    stage: phase === "night" ? "wolf_discussion" : "sheriff",
    timestamp: `2026-10-19T00:00:${String(seq).padStart(2, "0")}Z`,
  };
}
async function open(page: Page, replay: ReplayDocument, minimalAnonymous = false) {
  const plan = compileVideoPlan(
    replay,
    {
      source: getVideoSourceIdentity(replay),
      layout: "broadcast-v1",
      theme: { id: minimalAnonymous ? "minimal-v1" : "gothic-v1" },
      ...(minimalAnonymous ? { presentation: { anonymous: true } } : {}),
    },
    { locale: minimalAnonymous ? "en" : "zh-CN", timeZone: "UTC" },
  );
  await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
  await page.goto(`${VIDEO_BROWSER_ORIGIN}/`);
  await expect(page.locator("[data-composition-player]")).toHaveCount(6);
  await expect(page.locator('[data-player-alive="true"]')).toHaveCount(6);
  return plan;
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
function at(plan: VideoPlan, seq: number) {
  const frame = getVideoEventFrame(plan, seq);
  if (frame === null) throw new Error(`roster_acceptance_missing_seq:${seq}`);
  return frame;
}
async function group(
  page: Page,
  kind: "wolf-discussion" | "sheriff-election",
  status: "participant" | "speaker" | "candidate" | "withdrawn",
  expected: number[],
) {
  const members = page.locator(
    `[data-roster-activity="${kind}"][data-roster-activity-status="${status}"]`,
  );
  await expect
    .poll(() =>
      members.evaluateAll((nodes) =>
        nodes
          .map((node) => Number(node.getAttribute("data-composition-player")))
          .sort((a, b) => a - b),
      ),
    )
    .toEqual(expected);
}
async function speaker(page: Page, id: number | null) {
  await expect(page.locator('[data-roster-speaker="true"]')).toHaveCount(id === null ? 0 : 1);
  if (id !== null)
    await expect(page.locator(`[data-composition-player="${id}"]`)).toHaveAttribute(
      "data-roster-speaker",
      "true",
    );
}
async function border(page: Page, id: number, color: string, style = "solid") {
  const card = page.locator(`[data-composition-player="${id}"]`);
  await expect(card).toHaveCSS("border-top-color", color);
  await expect(card).toHaveCSS("border-top-style", style);
}
async function screenshot(page: Page, name: string) {
  const directory = resolve("../output/video-validation/roster-activity");
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `${name}.png`), fullPage: true });
}

test("an explicit wolf order survives speech and end-chat, then clears exactly when the knife vote is revealed", async ({
  page,
}) => {
  const words = "这是验收原话：我声称6号也是狼人，但这句话不能添加夜聊成员。";
  const ended = "独立验收：3号结束本轮夜聊，其他成员仍在组内。";
  const replay = acceptance([
    event(1, "phase_changed", { phase: "night" }),
    // 名单故意与角色阵营不一致；这是显示契约验收，不声称存在这种真实规则对局。
    event(2, "wolf_tactical_order", { order: [1, 3, 5] }),
    event(3, "wolf_discussion", { actorId: 3, text: words, round: 1, endChat: false }),
    event(4, "wolf_discussion", {
      actorId: 1,
      text: "独立验收：1号继续讨论。",
      round: 1,
      endChat: false,
    }),
    event(5, "wolf_discussion_ended", { actorId: 3, reason: ended, round: 1 }),
    event(6, "wolf_discussion", {
      actorId: 5,
      text: "独立验收：5号仍可发言。",
      round: 2,
      endChat: false,
    }),
    // 旧归档即使仍写wolf_discussion stage，明确刀票type也必须结束夜聊边框。
    event(7, "wolf_kill_vote_cast", { actorId: 1, targetId: 4, abstain: false }),
  ]);
  const plan = await open(page, replay);
  await seek(page, at(plan, 2) - 1);
  await expect(page.locator("[data-roster-activity]")).toHaveCount(0);
  await seek(page, at(plan, 2));
  await group(page, "wolf-discussion", "participant", [1, 3, 5]);
  for (const id of [1, 3, 5]) await border(page, id, "rgb(182, 76, 92)");
  for (const [seq, id, body] of [
    [3, 3, words],
    [4, 1, "独立验收：1号继续讨论。"],
    [5, 3, ended],
    [6, 5, "独立验收：5号仍可发言。"],
  ] as const) {
    await seek(page, at(plan, seq));
    await group(
      page,
      "wolf-discussion",
      "participant",
      [1, 3, 5].filter((member) => member !== id),
    );
    await group(page, "wolf-discussion", "speaker", [id]);
    await speaker(page, id);
    await border(page, id, "rgb(255, 106, 119)");
    await expect(page.locator(`[data-composition-player="${id}"]`)).toHaveCSS(
      "border-top-width",
      "5px",
    );
    for (const other of [1, 3, 5].filter((member) => member !== id))
      await border(page, other, "rgb(182, 76, 92)");
    await expect(page.locator("[data-scene-speech]")).toHaveText(body);
  }
  await screenshot(page, "wolf-discussion");
  await seek(page, at(plan, 7) - 1);
  await group(page, "wolf-discussion", "participant", [1, 3]);
  await group(page, "wolf-discussion", "speaker", [5]);
  await seek(page, at(plan, 7));
  await expect(page.locator("[data-roster-activity]")).toHaveCount(0);
  await speaker(page, null);
  await seek(page, at(plan, 5));
  await group(page, "wolf-discussion", "participant", [1, 5]);
  await group(page, "wolf-discussion", "speaker", [3]);
  await border(page, 3, "rgb(255, 106, 119)");
  await expect(page.locator("[data-scene-speech]")).toHaveText(ended);
  await expect(page.locator('[data-player-alive="true"]')).toHaveCount(6);
});

test("anonymous English minimal election uses explicit nominations, withdrawal and PK before the elected badge", async ({
  page,
}) => {
  const speech =
    "Acceptance only. I claim player 6 is a candidate; this is speech, not a nomination record.";
  const replay = acceptance([
    event(1, "phase_changed", { phase: "day" }, "day"),
    event(2, "sheriff_candidate_declared", { actorId: 6, run: true }, "day"),
    event(3, "sheriff_nomination_summary", { candidates: [1, 2, 3] }, "day"),
    event(4, "day_speech", { actorId: 2, text: speech }, "day"),
    event(5, "sheriff_withdraw_summary", { withdrawn: [2] }, "day"),
    event(6, "sheriff_candidates_finalized", { candidates: [1, 3] }, "day"),
    event(
      7,
      "sheriff_vote_summary",
      {
        round: 1,
        votes: [
          { actorId: 4, targetId: 1, abstain: false },
          { actorId: 5, targetId: 3, abstain: false },
        ],
        winnerId: null,
      },
      "day",
    ),
    event(8, "sheriff_pk_started", { candidates: [3] }, "day"),
    event(
      9,
      "day_speech",
      { actorId: 3, text: "Acceptance only: player 3 gives the PK speech." },
      "day",
    ),
    event(10, "sheriff_elected", { winnerId: 3 }, "day"),
    event(
      11,
      "day_speech",
      { actorId: 2, text: "Acceptance only: normal discussion resumes." },
      "day",
    ),
  ]);
  const plan = await open(page, replay, true);
  // 并发个人参选原本就被汇总折叠；在汇总揭晓前的事实前缀核对不能提前给6号上警边框。
  await seek(page, at(plan, 3) - 1);
  await expect(page.locator("[data-roster-activity]")).toHaveCount(0);
  await expect(page.locator("[data-player-metadata]")).toHaveCount(0);
  await expect(page.locator("[data-video-stage]")).not.toContainText("Fixture Name");
  await expect(page.locator("[data-video-stage]")).not.toContainText("Fixture Provider");
  await seek(page, at(plan, 3));
  await group(page, "sheriff-election", "candidate", [1, 2, 3]);
  for (const id of [1, 2, 3]) await border(page, id, "rgb(155, 109, 23)");
  await seek(page, at(plan, 4));
  await group(page, "sheriff-election", "candidate", [1, 2, 3]);
  await speaker(page, 2);
  await border(page, 2, "rgb(128, 84, 0)");
  await expect(page.locator("[data-scene-speech]")).toHaveText(speech);
  await seek(page, at(plan, 5) - 1);
  await group(page, "sheriff-election", "candidate", [1, 2, 3]);
  await group(page, "sheriff-election", "withdrawn", []);
  await seek(page, at(plan, 5));
  await group(page, "sheriff-election", "candidate", [1, 3]);
  await group(page, "sheriff-election", "withdrawn", [2]);
  await border(page, 2, "rgb(119, 130, 143)", "dashed");
  await screenshot(page, "election-withdrawn");
  for (const seq of [6, 7]) {
    await seek(page, at(plan, seq));
    await group(page, "sheriff-election", "candidate", [1, 3]);
    await group(page, "sheriff-election", "withdrawn", []);
  }
  await seek(page, at(plan, 8) - 1);
  await group(page, "sheriff-election", "candidate", [1, 3]);
  await seek(page, at(plan, 8));
  await group(page, "sheriff-election", "candidate", [3]);
  await seek(page, at(plan, 9));
  await speaker(page, 3);
  await border(page, 3, "rgb(128, 84, 0)");
  await screenshot(page, "election-pk");
  await seek(page, at(plan, 10) - 1);
  await group(page, "sheriff-election", "candidate", [3]);
  await expect(page.locator("[data-roster-sheriff]")).toHaveCount(0);
  await seek(page, at(plan, 10));
  await expect(page.locator("[data-roster-activity]")).toHaveCount(0);
  await expect(page.locator('[data-composition-player="3"] [data-roster-sheriff]')).toHaveCount(1);
  await seek(page, at(plan, 11));
  await expect(page.locator("[data-roster-activity]")).toHaveCount(0);
  await speaker(page, 2);
  await seek(page, at(plan, 5));
  await group(page, "sheriff-election", "candidate", [1, 3]);
  await group(page, "sheriff-election", "withdrawn", [2]);
  await border(page, 2, "rgb(119, 130, 143)", "dashed");
  await expect(page.locator("[data-roster-sheriff]")).toHaveCount(0);
  await expect(page.locator('[data-player-alive="true"]')).toHaveCount(6);
});

test("without a recorded wolf order even unknown roles highlight only the literal current speaker", async ({
  page,
}) => {
  const words = "独立验收：我说1号、2号与我同组，但原话不能建立夜聊名单或身份。";
  const ended = "独立验收：6号结束夜聊。";
  const plan = await open(
    page,
    acceptance(
      [
        event(1, "wolf_discussion", { actorId: 6, text: words, round: 1, endChat: false }),
        event(2, "wolf_discussion_ended", { actorId: 6, reason: ended, round: 1 }),
        event(3, "wolf_kill_vote_cast", { actorId: 6, targetId: null, abstain: true }),
      ],
      true,
    ),
  );
  for (const [seq, text] of [
    [1, words],
    [2, ended],
  ] as const) {
    await seek(page, at(plan, seq));
    await group(page, "wolf-discussion", "participant", []);
    await group(page, "wolf-discussion", "speaker", [6]);
    await expect(page.locator("[data-roster-activity]")).toHaveCount(1);
    await speaker(page, 6);
    await border(page, 6, "rgb(255, 106, 119)");
    for (const id of [1, 2, 3, 4, 5]) {
      await expect(page.locator(`[data-composition-player="${id}"]`)).not.toHaveCSS(
        "border-top-color",
        "rgb(255, 106, 119)",
      );
      await expect(page.locator(`[data-composition-player="${id}"]`)).not.toHaveCSS(
        "border-top-color",
        "rgb(182, 76, 92)",
      );
    }
    await expect(page.locator("[data-scene-speech]")).toHaveText(text);
  }
  await screenshot(page, "unknown-speaker-only");
  await seek(page, at(plan, 3));
  await expect(page.locator("[data-roster-activity]")).toHaveCount(0);
  await speaker(page, null);
  await seek(page, at(plan, 1));
  await speaker(page, 6);
  await group(page, "wolf-discussion", "speaker", [6]);
  await border(page, 6, "rgb(255, 106, 119)");
  await expect(page.locator("[data-scene-speech]")).toHaveText(words);
});
