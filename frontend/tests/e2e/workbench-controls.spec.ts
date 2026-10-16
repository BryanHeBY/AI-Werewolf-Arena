/**
 * 浏览器集成测试负责验证复盘导入竞态、同会话换档、导航和窄屏全文阅读。输入为独立构造的合法事件与延迟文件／端点，
 * 预期使用明确 seq、界面状态与实际 DOM 边界；不启动游戏规则、模型或修改录制夹具。
 */
import { expect, test, type Page } from "@playwright/test";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../src/video/compiler";

function replay(board = "import-board", count = 2) {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "same-session",
    meta: {
      board,
      startedAt: "2026-10-16T00:00:00Z",
      endedAt: "2026-10-16T00:01:00Z",
      locale: "zh-CN",
    },
    result: { winner: null, reason: null },
    players: [
      { player_id: 1, name: "甲", role: "villager", camp: "good" },
      { player_id: 2, name: "乙", role: "wolf", camp: "wolf" },
    ],
    events: Array.from({ length: count }, (_, index) => ({
      seq: index + 1,
      timestamp: "2026-10-16T00:00:00Z",
      day: Math.floor(index / 10) + 1,
      phase: index % 10 < 5 ? "night" : "day",
      type: "day_speech",
      payload: { actorId: (index % 2) + 1, text: `独立发言 target-${index}` },
    })),
  };
}

async function importFile(page: Page, name: string, data: unknown) {
  await page.getByLabel("打开复盘文件", { exact: true }).setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
}

test("missing endpoint supports import and same-session replacement resets playback and seat focus", async ({
  page,
}) => {
  await page.route("**/api/replay", (route) => route.fulfill({ status: 404 }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "狼人杀复盘播放器" })).toBeVisible();
  await importFile(page, "first.json", replay("first-board"));
  await page.getByRole("button", { name: "下一事件", exact: true }).click();
  await page.getByRole("button", { name: "1号·甲", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await expect(page.getByRole("heading", { name: "与 1号·甲相关的事件" })).toBeVisible();
  await importFile(page, "second.json", replay("second-board"));
  await expect(page.getByRole("heading", { name: "second-board", exact: true })).toBeVisible();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
  await expect(page.getByRole("heading", { name: "全局对局时间线", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "1号·甲", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator(".replay-file-name")).toHaveText("second.json");
});

test("a delayed server response cannot replace a browser import", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/replay", async (route) => {
    await pending;
    await route.fulfill({ json: replay("late-server") }).catch(() => {});
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await importFile(page, "local.json", replay("local-wins"));
  await expect(page.getByRole("heading", { name: "local-wins", exact: true })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "late-server", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "下一事件", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await expect(page.getByRole("heading", { name: "local-wins", exact: true })).toBeVisible();
});

test("a delayed old file cannot overwrite a newer file and retry can recover the endpoint", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const readText = File.prototype.text;
    File.prototype.text = async function () {
      if (this.name === "slow.json")
        await new Promise<void>((resolve) => {
          (window as unknown as { releaseReplayFile: () => void }).releaseReplayFile = resolve;
        });
      return readText.call(this);
    };
  });
  let retryReady = false;
  await page.route("**/api/replay", (route) =>
    route.fulfill({ json: retryReady ? replay("retry-ok") : {} }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "无法打开复盘" })).toBeVisible();
  retryReady = true;
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await expect(page.getByRole("heading", { name: "retry-ok", exact: true })).toBeVisible();
  await importFile(page, "slow.json", replay("slow-loses"));
  await importFile(page, "fast.json", replay("fast-wins"));
  await expect(page.getByRole("heading", { name: "fast-wins", exact: true })).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { releaseReplayFile: () => void }).releaseReplayFile(),
  );
  await page.getByRole("button", { name: "下一事件", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await expect(page.getByRole("heading", { name: "fast-wins", exact: true })).toBeVisible();
  await importFile(page, "invalid.json", {});
  await expect(page.getByRole("heading", { name: "无法打开复盘" })).toBeVisible();
  await importFile(page, "valid.json", replay("recovered-import"));
  await expect(page.getByRole("heading", { name: "recovered-import", exact: true })).toBeVisible();
});

test("chapter navigation, text search and pausable following preserve source event IDs", async ({
  page,
}) => {
  await page.route("**/api/replay", (route) =>
    route.fulfill({ json: replay("long-timeline", 60) }),
  );
  await page.goto("/");
  await page.getByLabel("跳转到日／阶段", { exact: true }).selectOption("50");
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "51");
  await expect
    .poll(() => page.locator(".timeline-list").evaluate((list) => list.scrollTop))
    .toBeGreaterThan(0);
  await page.getByLabel("搜索事件", { exact: true }).fill("target-47");
  await expect(page.locator(".timeline .event")).toHaveCount(1);
  await page.locator(".timeline .event").click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "48");
  await page.getByLabel("搜索事件", { exact: true }).fill("");
  await page.getByRole("button", { name: "正在跟随 · 点击暂停", exact: true }).click();
  await page.locator(".timeline-list").evaluate((list) => {
    list.scrollTop = 0;
  });
  await page.getByLabel("跳转到日／阶段", { exact: true }).selectOption("55");
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "56");
  expect(await page.locator(".timeline-list").evaluate((list) => list.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "恢复跟随当前事件", exact: true }).click();
  await expect
    .poll(() => page.locator(".timeline-list").evaluate((list) => list.scrollTop))
    .toBeGreaterThan(0);
  await page.getByLabel("播放速度", { exact: true }).selectOption("2");
  await expect(page.getByLabel("播放速度", { exact: true })).toHaveValue("2");
  await page.getByLabel("搜索事件", { exact: true }).fill("absent-token");
  await expect(page.getByText("没有匹配的事件", { exact: true })).toBeVisible();
});

test("mobile long prose stays scrollable inside the current-event reader without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = replay("mobile-reader");
  fixture.events[0]!.payload.text = "长发言原文 <raw> {actor}。".repeat(100);
  await page.route("**/api/replay", (route) => route.fulfill({ json: fixture }));
  await page.goto("/");
  const reader = page.getByLabel("当前事件全文", { exact: true });
  await expect(reader).toContainText(fixture.events[0]!.payload.text);
  const metrics = await reader.evaluate((element) => ({
    client: element.clientHeight,
    scroll: element.scrollHeight,
    overflow: getComputedStyle(element).overflowY,
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  expect(metrics.client).toBeLessThanOrEqual(250);
  expect(metrics.overflow).toBe("auto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const seats = await page.locator(".player-panel").boundingBox();
  const content = await reader.boundingBox();
  expect(seats!.y).toBeLessThan(content!.y + 400);
  await reader.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await reader.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("web appearance persists without changing video frames, seat focus or the mounted event search", async ({
  page,
}) => {
  await page.route("**/api/replay", (route) =>
    route.fulfill({ json: replay("appearance-board", 30) }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "1号·甲", exact: true }).click();
  await page.getByLabel("搜索事件", { exact: true }).fill("target-10");
  await page.locator(".timeline .event").click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "11");
  const frame = await page.getByLabel("播放位置", { exact: true }).inputValue();
  const videoBefore = await page.locator("[data-video-shot]").getAttribute("data-video-shot");
  await page.getByRole("tab", { name: "外观", exact: true }).click();
  await expect(page.getByLabel("当前事件全文", { exact: true })).toContainText("target-10");
  await page.getByLabel("网页主题", { exact: true }).selectOption("gothic-v1");
  await page.getByLabel("减少动效", { exact: true }).check();
  await expect(page.locator(".replay-workspace")).toHaveAttribute("data-web-theme", "gothic-v1");
  await expect(page.locator(".app-surface")).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.getByLabel("播放位置", { exact: true })).toHaveValue(frame);
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "11");
  await expect(page.locator("[data-video-shot]")).toHaveAttribute("data-video-shot", videoBefore!);
  await expect(page.getByRole("button", { name: "1号·甲", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("tab", { name: "事件", exact: true }).click();
  await expect(page.getByLabel("搜索事件", { exact: true })).toHaveValue("target-10");
  await expect(page.locator(".timeline .event")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".replay-workspace")).toHaveAttribute("data-web-theme", "gothic-v1");
  await expect(page.locator(".app-surface")).toHaveAttribute("data-reduced-motion", "true");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("awa.web-appearance.v1")!)),
  ).toEqual({
    theme: { id: "gothic-v1" },
    reduceMotion: true,
  });
});

test("phase controls use structural boundaries and detail tabs support keyboard navigation while prose stays visible", async ({
  page,
}) => {
  await page.route("**/api/replay", (route) => route.fulfill({ json: replay("phase-board", 20) }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "← 上一阶段", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "下一阶段 →", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "6");
  await page.getByRole("button", { name: "← 上一阶段", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
  await expect(page.locator(".timeline-group-heading")).toHaveCount(4);
  await page.getByRole("tab", { name: "事件", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "玩家", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "玩家", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("当前事件全文", { exact: true })).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "外观", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByLabel("搜索事件", { exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.getByRole("tab", { name: "外观", exact: true }).click();
  for (let index = 0; index < 3; index++)
    await page.getByRole("button", { name: "下一阶段 →", exact: true }).click();
  await page.getByRole("tab", { name: "事件", exact: true }).click();
  await expect
    .poll(() => page.locator(".timeline-list").evaluate((list) => list.scrollTop))
    .toBeGreaterThan(0);
});

test("explicit seat and model metadata display without guessing a vendor or rewriting speech", async ({
  page,
}) => {
  const fixture = {
    ...replay("seats-board"),
    players: [
      {
        player_id: 7,
        seat: 2,
        name: "甲",
        model: "OpenAI explicit model",
        role: "villager",
        camp: "good",
      },
      { player_id: 41, seat: 1, name: "乙", role: "wolf", camp: "wolf" },
    ],
    events: replay().events.map((event, index) => ({
      ...event,
      payload: { actorId: index === 0 ? 7 : 41, text: "7号、{actor}号与Player 7是原始发言。" },
    })),
  };
  await page.route("**/api/replay", (route) => route.fulfill({ json: fixture }));
  await page.goto("/");
  const first = page.locator(".seat-grid .seat").first();
  await expect(first).toHaveAttribute("data-player-id", "41");
  await expect(first).toHaveAttribute("data-seat", "1");
  await expect(page.getByRole("button", { name: "2号·甲", exact: true })).toContainText(
    "OpenAI explicit model",
  );
  await expect(page.locator('.seat[data-player-id="7"] [data-avatar-key="neutral"]')).toHaveCount(
    1,
  );
  await expect(page.getByLabel("当前事件全文", { exact: true })).toHaveText(
    "2号·甲发言：7号、{actor}号与Player 7是原始发言。",
  );
  await page.getByRole("button", { name: "2号·甲", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "与 2号·甲相关的事件", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".timeline .event")).toHaveCount(1);
});

test("absorbed ballot entries keep raw seq navigation while sidebar and rosters follow each reveal boundary", async ({
  page,
}) => {
  const votes = [
    { actorId: 1, targetId: 2, weight: 1, abstain: false },
    { actorId: 2, targetId: 2, weight: 1, abstain: false },
  ];
  const items = [
    { type: "day_speech", payload: { actorId: 1, text: "投票前的原文。" } },
    ...votes.map((payload) => ({ type: "vote_cast", payload })),
    { type: "vote_summary", payload: { round: 1, votes, tally: { 2: 2 }, target: 2 } },
    { type: "voted_out", payload: { target: 2 } },
    { type: "day_speech", payload: { actorId: 1, text: "投票后的原文。" } },
  ];
  const fixture = {
    ...replay("ballot-navigation"),
    events: items.map((item, index) => ({
      seq: index + 1,
      timestamp: "2026-10-16T00:00:00Z",
      day: 1,
      phase: "voting",
      ...item,
    })),
  };
  // 编译计划仅提供导航坐标；预期 seq、生死和原文均由上方独立事实固定，不读 view 生成 oracle。
  const plan = compileVideoPlan(readReplayDocument(fixture));
  const ballot = plan.shots.find((shot) => shot.id === "event:4")!;
  const seek = async (frame: number) => {
    await page.getByLabel("播放位置", { exact: true }).fill(String(frame));
    await expect(page.getByLabel("播放位置", { exact: true })).toHaveValue(String(frame));
  };
  await page.route("**/api/replay", (route) => route.fulfill({ json: fixture }));
  await page.goto("/");
  await expect(page.locator('.timeline .event[data-event-seq="2"]')).toHaveCount(1);
  await page.locator('.timeline .event[data-event-seq="2"]').click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "4");
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-seq", "4");
  await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
  await expect(page.locator('[data-composition-player="2"]')).not.toContainText("出局");
  await seek(ballot.from + ballot.scene.cues.settled);
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-seq", "5");
  await expect(page.locator(".seat-grid .dead .seat-number")).toHaveText("2");
  await expect(page.locator('[data-composition-player="2"]')).toContainText("出局");
  await seek(ballot.from + ballot.scene.cues.impact - 1);
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-seq", "1");
  await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
  await expect(page.getByLabel("当前事件全文", { exact: true })).toHaveText(
    "1号·甲发言：投票前的原文。",
  );
  await page.locator('.timeline .event[data-event-seq="3"]').click();
  await page.getByRole("button", { name: "上一事件", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
  await page.getByRole("button", { name: "下一事件", exact: true }).click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "4");
});

test("committed death facts reveal together in video and Web seats while raw proposals stay alive and rewinding restores them", async ({
  page,
}) => {
  const fixture = {
    ...replay("fact-navigation"),
    factCoverage: { committedDeaths: 1 },
    facts: [
      {
        seq: 1,
        afterSeq: 2,
        kind: "life_committed",
        day: 1,
        playerId: 2,
        alive: false,
        causes: ["exile"],
      },
    ],
    events: [
      {
        seq: 1,
        timestamp: "2026-10-16T00:00:00Z",
        day: 1,
        phase: "day",
        type: "day_speech",
        payload: { actorId: 1, text: "提交前。" },
      },
      {
        seq: 2,
        timestamp: "2026-10-16T00:00:01Z",
        day: 1,
        phase: "voting",
        type: "voted_out",
        payload: { target: 2 },
      },
      {
        seq: 3,
        timestamp: "2026-10-16T00:00:02Z",
        day: 1,
        phase: "day",
        type: "day_speech",
        payload: { actorId: 1, text: "提交后。" },
      },
    ],
  };
  const plan = compileVideoPlan(readReplayDocument(fixture));
  const fact = plan.shots.find((shot) => shot.id === "fact:1")!;
  const seek = async (frame: number) => {
    await page.getByLabel("播放位置", { exact: true }).fill(String(frame));
    await expect(page.getByLabel("播放位置", { exact: true })).toHaveValue(String(frame));
  };
  await page.route("**/api/replay", (route) => route.fulfill({ json: fixture }));
  await page.goto("/");
  await page.locator('.timeline .event[data-event-seq="2"]').click();
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-seq", "2");
  await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
  await seek(fact.from + fact.scene.cues.impact - 1);
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-fact-seq", "0");
  await expect(page.locator('[data-composition-player="2"]')).not.toContainText("出局");
  await seek(fact.from + fact.scene.cues.impact);
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-fact-seq", "1");
  await expect(page.locator(".seat-grid .dead .seat-number")).toHaveText("2");
  await expect(page.locator('[data-composition-player="2"]')).toContainText("出局");
  await expect(page.getByLabel("当前事件全文", { exact: true })).toHaveText("2号·乙已死亡。");
  await seek(fact.from + fact.scene.cues.impact - 1);
  await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-fact-seq", "0");
  await page.locator('.timeline .event[data-event-seq="3"]').click();
  await expect(page.locator(".seat-grid .dead .seat-number")).toHaveText("2");
  await expect(page.getByLabel("当前事件全文", { exact: true })).toHaveText("1号·甲发言：提交后。");
});
