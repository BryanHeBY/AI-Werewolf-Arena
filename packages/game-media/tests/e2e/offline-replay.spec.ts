/**
 * 浏览器集成测试通过工作台验证复盘加载、播放、拖动、席位筛选、语言与时区。输入为录制角色归档和显式畸形／修改字面量；预期检查事件时点、身份可见性、错误与终局胜者，不调用模型或游戏引擎。
 */
import { currentEventSourceText } from "../support/replay-current-event";
import { withPlayerNames } from "../support/named-label-expectation";
import { createPlayerText } from "@ai-werewolf-arena/game-presentation";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { lonelyGirlEventLabel, shapeshifterEventLabel } from "@ai-werewolf-arena/game-presentation";
import { expect, test } from "@playwright/test";
import { text } from "@ai-werewolf-arena/game-text";
import { wildChildEventLabel } from "@ai-werewolf-arena/game-presentation";
import { readFileSync } from "node:fs";
import { compileVideoPlan } from "../../src/video/compiler";
const original = JSON.parse(
  readFileSync(frontendFixtureURL("frontend/tests/fixtures/sample.replay.json"), "utf8"),
);

for (const locale of ["zh-CN", "en"] as const)
  for (const backlash of [false, true])
    test(`${locale}/${backlash}: actual Black Market choice keeps identity until death and final victory`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/black-market-${backlash ? "twelve_backlash" : "twelve_gun"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        locale === "en"
          ? backlash
            ? "God Black Market result: player 7 to player 1, Inspection, night 1: Backlash proposal."
            : "Black Market choice: player 7 offered Gun to player 9 on night 1."
          : backlash
            ? "【上帝黑市结果】第1夜7号对1号的查验：反噬提案。"
            : "【黑市选择】第1夜7号给9号猎枪。",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const actor = page.getByRole("button", {
        name: locale === "en" ? "Player 7·Seat 7" : "7号·Seat 7",
        exact: true,
      });
      await expect(actor).toContainText(locale === "en" ? "Black Market Merchant" : "黑市商人");
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(8);
      await expect(actor).toHaveClass(/dead/);
      await expect(actor).toHaveClass(/winner/);
      await expect(page.getByTestId("composition-winner")).toHaveCount(8);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const first of ["wolf", "god"] as const)
    test(`${locale}/${first}: controlled gifted gun preserves a second choice before terminal victory`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/gift-gun-last-${first}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const armed = withPlayerNames(
        locale === "en"
          ? "Player 2: gifted gun gift-gun:1, Armed."
          : "2号：赠枪gift-gun:1，已激活。",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: armed }).click();
      await expect(currentEventSourceText(page)).toHaveText(armed);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const actor = page.getByRole("button", {
        name: locale === "en" ? "Player 2·Seat 2" : "2号·Seat 2",
        exact: true,
      });
      await expect(actor).toContainText(locale === "en" ? "Hunter" : "猎人");
      const target = first === "wolf" ? 3 : 1,
        shot = withPlayerNames(
          locale === "en" ? `Player 2 shoots player ${target}` : `2号开枪带走${target}号`,
          replay.players,
          locale,
        );
      await page.locator(".timeline .event").filter({ hasText: shot }).click();
      await expect(currentEventSourceText(page)).toHaveText(shot);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(3);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(5);
      await expect(actor).toHaveClass(/dead/);
      await expect(actor).toHaveClass(/winner/);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["twelve", "guard", "extra_hold"] as const)
    test(`${locale}/${kind}: actual Awakened replay separates copied skills from God identity and final victory`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/awakened-${kind}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        kind === "twelve"
          ? locale === "en"
            ? "Player 1 shoots player 8"
            : "1号开枪带走8号"
          : kind === "guard"
            ? locale === "en"
              ? "Awakened guard: player 1 chose 6 on night 2."
              : "觉醒守护：1号第2夜选择6。"
            : locale === "en"
              ? "Awakened extra knife: player 1 chose 6 on night 3."
              : "觉醒额外刀：1号第3夜选择6。",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const actor = page.getByRole("button", {
        name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
        exact: true,
      });
      await expect(actor).toContainText(locale === "en" ? "Awakened Hidden Wolf" : "觉醒隐狼");
      const victim = page.getByRole("button", {
        name:
          locale === "en"
            ? `Player ${kind === "twelve" ? 8 : 6}·Seat ${kind === "twelve" ? 8 : 6}`
            : `${kind === "twelve" ? 8 : 6}号·Seat ${kind === "twelve" ? 8 : 6}`,
        exact: true,
      });
      if (kind === "twelve") await expect(victim).toHaveClass(/dead/);
      else await expect(victim).not.toHaveClass(/dead/);
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      const winners = kind === "twelve" ? 8 : kind === "guard" ? 4 : 3;
      await expect(page.locator(".seat-grid .winner")).toHaveCount(winners);
      await expect(page.getByTestId("composition-winner")).toHaveCount(winners);
      if (kind === "extra_hold") {
        await expect(actor).toHaveClass(/winner/);
        await expect(
          page.getByRole("button", {
            name: locale === "en" ? "Player 2·Seat 2" : "2号·Seat 2",
            exact: true,
          }),
        ).toHaveClass(/dead/);
      }
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: neutral public gun caption kills the target without asserting Hunter in the caption`, async ({
    page,
  }) => {
    const replay = JSON.parse(
      readFileSync(frontendFixtureURL("frontend/tests/fixtures/mirror-twelve.replay.json"), "utf8"),
    );
    replay.meta.locale = locale;
    const shot = replay.events.find((event: { type: string }) => event.type === "hunter_shot");
    shot.type = "player_shot";
    shot.stage = "death_shot";
    shot.payload = { actorId: 7, targetId: 2 };
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const label = withPlayerNames(
      locale === "en" ? "Player 7 shoots player 2" : "7号开枪带走2号",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: label }).click();
    await expect(currentEventSourceText(page)).toHaveText(label);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(4);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    const victim = page.getByRole("button", {
      name: locale === "en" ? "Player 2·Seat 2" : "2号·Seat 2",
      exact: true,
    });
    await expect(victim).toHaveClass(/dead/);
    const caption = await page.getByTestId("composition-caption").boundingBox();
    expect(caption).not.toBeNull();
    for (const seat of await page.locator("[data-composition-player]").all()) {
      const box = await seat.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThan(caption!.y);
    }
  });

test("switches display locale and time zone while keeping playback and seat focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "six_player_mvp" })).toBeVisible();
  await expect(page.getByText("session_frontend_fixture", { exact: false })).toBeVisible();
  await expect(page.getByText("天黑请闭眼", { exact: false }).first()).toBeVisible();
  // 初始镜头保留揭晓前状态；本项测试直接选择要验证语言切换的源事件。
  await page.locator('.timeline .event[data-event-seq="2"]').click();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await page.getByRole("button", { name: "1号", exact: true }).click();
  await expect(page.getByRole("heading", { name: "与 1 号相关的事件" })).toBeVisible();
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Events involving player 1" })).toBeVisible();
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await expect(page.locator(".current-event p")).toHaveText("Player 2 is exiled");
  await expect(page.getByRole("button", { name: "Player 2", exact: true })).toHaveClass(/dead/);
  await expect(page.locator(".current-event time")).toHaveText("2026-07-29 00:01:00 [UTC]");
  await page.getByLabel("Display time zone", { exact: true }).selectOption("Asia/Shanghai");
  await expect(page.locator(".current-event time")).toHaveText(
    "2026-07-29 08:01:00 [Asia/Shanghai]",
  );
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  await page.getByRole("button", { name: "Clear seat filter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Game timeline", exact: true })).toBeVisible();
  await page.getByLabel("Display language", { exact: true }).selectOption("zh-CN");
  await expect(page.locator(".current-event p")).toHaveText("2号被放逐出局");
  await expect(page.getByRole("heading", { name: "全局对局时间线" })).toBeVisible();
});

test("new replay locale is the default and raw names and speech remain unchanged", async ({
  page,
}) => {
  const replay = {
    ...original,
    schemaVersion: 2,
    meta: { ...original.meta, locale: "en" },
    players: [{ ...original.players[0], name: "茶茶 {role}" }, original.players[1]],
    events: [
      {
        ...original.events[0],
        type: "day_speech",
        payload: { actorId: 1, text: "我是绿茶 <b>raw</b> {actor}" },
      },
    ],
  };
  await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
  await page.goto("/");
  await expect(page.getByLabel("Display language", { exact: true })).toHaveValue("en");
  await expect(page.locator(".current-event p")).toHaveText(
    "Player 1·茶茶 {role} says: 我是绿茶 <b>raw</b> {actor}",
  );
  await expect(
    page.getByRole("button", { name: "Player 1·茶茶 {role}", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Display language", { exact: true }).selectOption("zh-CN");
  await expect(page.locator(".current-event p")).toHaveText(
    "1号·茶茶 {role}发言：我是绿茶 <b>raw</b> {actor}",
  );
  await expect(page.getByRole("button", { name: "1号·茶茶 {role}", exact: true })).toBeVisible();
  expect(await page.locator(".current-event b").count()).toBe(0);
});

test("load errors and empty state can change language", async ({ page }) => {
  await page.route("**/api/replay", (route) =>
    route.fulfill({ json: { ...original, schemaVersion: 99 } }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "无法打开复盘" })).toBeVisible();
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(
    page.getByText("This replay format version is not supported.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/replay");
  await page.route("**/api/replay", (route) => route.fulfill({ status: 404 }));
  await page.reload();
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Werewolf replay player" })).toBeVisible();
});

test("choosing only a time zone during load does not override the incoming replay locale", async ({
  page,
}) => {
  let release!: () => void;
  const loaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/replay", async (route) => {
    await loaded;
    await route.fulfill({
      json: { ...original, schemaVersion: 2, meta: { ...original.meta, locale: "en" } },
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel("显示时区", { exact: true }).selectOption("Asia/Shanghai");
  release();
  await expect(page.getByLabel("Display language", { exact: true })).toHaveValue("en");
  await expect(page.getByLabel("Display time zone", { exact: true })).toHaveValue("Asia/Shanghai");
});

test("playing video keeps advancing while display language changes", async ({ page }) => {
  // 即使音频设备始终未恢复，无声画面也应继续播放。
  await page.addInitScript(() => {
    AudioContext.prototype.resume = () => new Promise<void>(() => {});
  });
  // 计划仅给真实事件边界坐标；把播放起点放在2号事件前1.5秒，避免把完整阅读时长当固定5秒。
  // 预期仍独立锁定从原事件1实际播放至2，不能用 seek 直接跳过被验证的跨事件播放。
  const plan = compileVideoPlan(readReplayDocument(original));
  const secondEventFrame = plan.eventFrames["2"]![0]!.frame;
  const startFrame = secondEventFrame - Math.ceil(plan.fps * 1.5);
  expect(startFrame).toBeGreaterThanOrEqual(0);
  await page.route("**/api/replay", (route) => route.fulfill({ json: original }));
  await page.goto("/");
  const position = page.getByLabel("播放位置", { exact: true });
  await position.fill(String(startFrame));
  await expect(position).toHaveValue(String(startFrame));
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-seq", "1");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toBeVisible();
  await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(startFrame);
  const beforeLocaleChange = Number(await position.inputValue());
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Playback position", { exact: true }).inputValue()),
    )
    .toBeGreaterThan(beforeLocaleChange);
  await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2", {
    timeout: 5000,
  });
  await expect(page.locator(".current-event")).toHaveAttribute("data-source-seq", "2");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
});

test("a completed replay with no winner differs from an in-progress replay", async ({ page }) => {
  await page.route("**/api/replay", (route) =>
    route.fulfill({ json: { ...original, result: { winner: null, reason: "max_days_reached" } } }),
  );
  await page.goto("/");
  await expect(page.locator(".result-chip strong")).toHaveText("无胜者");
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.locator(".result-chip strong")).toHaveText("No winner");
  await page.unroute("**/api/replay");
  await page.route("**/api/replay", (route) =>
    route.fulfill({
      json: {
        ...original,
        result: { winner: null, reason: null },
      },
    }),
  );
  await page.reload();
  await expect(page.locator(".result-chip strong")).toHaveText("未结束");
  await page.getByLabel("显示语言", { exact: true }).selectOption("en");
  await expect(page.locator(".result-chip strong")).toHaveText("Unfinished");
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: explicit personal and relationship victory stays visible for dead winners only at the terminal frame`, async ({
    page,
  }) => {
    const victory = JSON.parse(
      readFileSync(frontendFixtureURL("frontend/tests/fixtures/victory.replay.json"), "utf8"),
    );
    victory.meta.locale = locale;
    await page.route("**/api/replay", (route) => route.fulfill({ json: victory }));
    await page.goto("/");
    await expect(page.locator(".result-chip strong")).toContainText(
      locale === "en" ? "personal goal victory" : "个人目标胜利",
    );
    await expect(page.locator(".result-chip strong")).toContainText("scenario_pair");
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    await page.locator('.timeline .event[data-event-seq="2"]').click();
    await expect(page.locator(".seat-grid .winner")).toHaveCount(3);
    await expect(page.getByTestId("composition-winner")).toHaveCount(3);
    await expect(page.getByTestId("composition-victory")).toContainText(
      locale === "en" ? "Exile settled" : "放逐结算完成",
    );
    await expect(
      page.getByRole("button", {
        name: locale === "en" ? "Player 1·原名<Alpha>" : "1号·原名<Alpha>",
        exact: true,
      }),
    ).toHaveClass(/dead.*winner-seat/);
    await page
      .getByLabel(locale === "en" ? "Display language" : "显示语言", { exact: true })
      .selectOption(locale === "en" ? "zh-CN" : "en");
    await expect(page.locator(".seat-grid .winner")).toHaveCount(3);
    await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: malformed victory never invents an unknown winning player`, async ({ page }) => {
    const victory = JSON.parse(
      readFileSync(frontendFixtureURL("frontend/tests/fixtures/victory.replay.json"), "utf8"),
    );
    victory.meta.locale = locale;
    delete victory.result.decision;
    const outcome = {
      kind: "victory",
      primary: {
        kind: "individual",
        playerId: 999,
        goalId: "scenario_unknown",
        winningPlayerIds: [999],
      },
      additional: [],
      winningPlayerIds: [999],
    };
    victory.events[1].payload.outcome = outcome;
    await page.route("**/api/replay", (route) => route.fulfill({ json: victory }));
    await page.goto("/");
    const unknown = locale === "en" ? "Unknown" : "未知";
    await expect(page.locator(".result-chip strong")).toHaveText(unknown);
    await expect(page.locator(".timeline .event p").last()).toHaveText(unknown);
    await page.locator('.timeline .event[data-event-seq="2"]').click();
    await expect(page.locator(".current-event p")).toHaveText(unknown);
    await expect(page.locator("[data-scene-announcement]")).toHaveText(unknown);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    await expect(page.getByTestId("composition-winner")).toHaveCount(0);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: an actual wolf-king complete-game archive shows distinct shots and death order`, async ({
    page,
  }) => {
    const replay = JSON.parse(
      readFileSync(frontendFixtureURL("frontend/tests/fixtures/wolf-king.replay.json"), "utf8"),
    );
    replay.meta.locale = locale;
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const king = withPlayerNames(
      locale === "en" ? "Wolf King 1 shoots player 2" : "1号狼王开枪带走2号",
      replay.players,
      locale,
    );
    const hunter = withPlayerNames(
      locale === "en" ? "Hunter 2 shoots player 3" : "2号猎人开枪带走3号",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: king }).click();
    await expect(currentEventSourceText(page)).toHaveText(king);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(3); // 夜间死者为 5，放逐者为 1，枪击死者为 2。
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    await page.locator(".timeline .event").filter({ hasText: hunter }).click();
    await expect(currentEventSourceText(page)).toHaveText(hunter);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(4);
    await page.locator(".timeline .event").last().click();
    await expect(page.getByTestId("composition-winner")).toHaveCount(5);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(5);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual White Wolf King archive applies both initial deaths before the Hunter's response`, async ({
    page,
  }) => {
    const replay = JSON.parse(
      readFileSync(
        frontendFixtureURL("frontend/tests/fixtures/white-wolf-king.replay.json"),
        "utf8",
      ),
    );
    replay.meta.locale = locale;
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const blast = withPlayerNames(
      locale === "en"
        ? "White Wolf King 1 self-destructs and takes player 4"
        : "1号白狼王自爆并带走4号",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: blast }).click();
    await expect(currentEventSourceText(page)).toHaveText(blast);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(3);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    const shot = withPlayerNames(
      locale === "en" ? "Hunter 4 shoots player 2" : "4号猎人开枪带走2号",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: shot }).click();
    await expect(currentEventSourceText(page)).toHaveText(shot);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(4);
    await page.locator(".timeline .event").last().click();
    await expect(page.locator(".seat-grid .winner")).toHaveCount(4);
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const miss of [false, true])
    test(`${locale}/${miss}: actual Knight archive kills exactly its duel loser and then settles the terminal frame`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/${miss ? "knight-miss" : "knight"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const duel = withPlayerNames(
        miss
          ? locale === "en"
            ? "Knight 1 duels player 4; the non-wolf target survives and the Knight dies"
            : "1号骑士决斗4号，目标非狼存活，骑士出局"
          : locale === "en"
            ? "Knight 1 duels player 2; the wolf target dies"
            : "1号骑士决斗2号，目标为狼并出局",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: duel }).click();
      await expect(currentEventSourceText(page)).toHaveText(duel);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(2);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name:
            locale === "en"
              ? `Player ${miss ? 1 : 2}·Seat ${miss ? 1 : 2}`
              : `${miss ? 1 : 2}号·Seat ${miss ? 1 : 2}`,
          exact: true,
        }),
      ).toHaveClass(/dead/);
      await expect(
        page.getByRole("button", {
          name:
            locale === "en"
              ? `Player ${miss ? 4 : 1}·Seat ${miss ? 4 : 1}`
              : `${miss ? 4 : 1}号·Seat ${miss ? 4 : 1}`,
          exact: true,
        }),
      ).not.toHaveClass(/dead/);
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(5);
      await expect(page.getByTestId("composition-winner")).toHaveCount(5);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual Gravekeeper archive displays private camp feedback at the right night without altering death or terminal winners`, async ({
    page,
  }) => {
    const replay = JSON.parse(
      readFileSync(frontendFixtureURL("frontend/tests/fixtures/gravekeeper.replay.json"), "utf8"),
    );
    replay.meta.locale = locale;
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const first = withPlayerNames(
      locale === "en"
        ? "Gravekeeper 8 learns on night 2 that player 1, exiled on day 1, has camp label Werewolves"
        : "8号守墓人在第2夜获知第1日放逐1号的阵营标签：狼人",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: first }).click();
    await expect(currentEventSourceText(page)).toHaveText(first);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(1);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    const second = withPlayerNames(
      locale === "en"
        ? "Gravekeeper 8 learns on night 3 that player 5, exiled on day 2, has camp label Good"
        : "8号守墓人在第3夜获知第2日放逐5号的阵营标签：好人",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: second }).click();
    await expect(currentEventSourceText(page)).toHaveText(second);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(5);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    const caption = await page.getByTestId("composition-caption").boundingBox();
    expect(caption).not.toBeNull();
    for (const seat of await page.locator("[data-composition-player]").all()) {
      const box = await seat.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThan(caption!.y);
    }
    await page.locator(".timeline .event").last().click();
    await expect(page.locator(".seat-grid .winner")).toHaveCount(8);
    await expect(page.getByTestId("composition-winner")).toHaveCount(8);
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["gun_blocked", "gun_link"] as const)
    test(`${locale}/${kind}: actual Dreamer archive distinguishes blocked night shots from anonymous real link deaths`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/dreamer-${kind}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const text = withPlayerNames(
        kind === "gun_blocked"
          ? locale === "en"
            ? "Player 4 shoots at player 5; night protection blocks the shot"
            : "4号向5号开枪，夜间保护使枪击落空"
          : locale === "en"
            ? "Additional deaths: Player 5"
            : "追加死亡：5号",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: text }).click();
      await expect(currentEventSourceText(page)).toHaveText(text);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(kind === "gun_blocked" ? 1 : 3);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(5);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const special of [false, true])
    test(`${locale}/${special}: actual Beauty archive preserves protected lives and shows a dead winning wolf after the whole exile chain`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/wolf-beauty-${special ? "last-god" : "blocked"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const text = withPlayerNames(
        special
          ? locale === "en"
            ? "Additional deaths: Player 2"
            : "追加死亡：2号"
          : locale === "en"
            ? "Dream protection blocks Wolf Beauty 1's night charm death of player 5"
            : "1号对5号的夜间魅惑牵连被梦保护阻止",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: text }).click();
      await expect(currentEventSourceText(page)).toHaveText(text);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(special ? 3 : 2);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(special ? 1 : 4);
      await expect(page.getByTestId("composition-winner")).toHaveCount(special ? 1 : 4);
      if (special)
        await expect(
          page.getByRole("button", {
            name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
            exact: true,
          }),
        ).toHaveClass(/dead/);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const badge of [false, true])
    test(`${locale}/${badge}: actual Bear archive gives an anonymous quiet signal after death/shot/badge settlement without changing any seat`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/bear-${badge ? "king-badge" : "neighbor-update"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const text =
        locale === "en"
          ? `Day ${badge ? 1 : 2}: Bear did not roar`
          : `第${badge ? 1 : 2}天：熊没有咆哮`;
      await page.locator(".timeline .event").filter({ hasText: text }).click();
      await expect(currentEventSourceText(page)).toHaveText(text);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(badge ? 2 : 3);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(badge ? 5 : 4);
      await expect(page.getByTestId("composition-winner")).toHaveCount(badge ? 5 : 4);
      if (badge)
        await expect(
          page.getByRole("button", {
            name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
            exact: true,
          }),
        ).toHaveClass(/dead/);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: actual Hidden Wolf inheritance is a private fact followed by a separate real death, without premature winners`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/hidden-wolf-${large ? "twelve" : "king-link"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        locale === "en"
          ? `Hidden Wolf 1 inherits the knife on day ${large ? 2 : 1}`
          : `1号隐狼在第${large ? 2 : 1}天获得刀权`,
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(large ? 4 : 1);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
          exact: true,
        }),
      ).not.toHaveClass(/dead/);
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(large ? 8 : 4);
      await expect(page.getByTestId("composition-winner")).toHaveCount(large ? 8 : 4);
      await expect(
        page.getByRole("button", {
          name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
          exact: true,
        }),
      ).toHaveClass(/dead/);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: actual Gargoyle inheritance is a private fact followed by a separate real death, without premature winners`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/gargoyle-${large ? "twelve" : "king-link"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        locale === "en"
          ? `Gargoyle 1 inherits the knife on day ${large ? 2 : 1}`
          : `1号石像鬼在第${large ? 2 : 1}天获得刀权`,
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(large ? 4 : 1);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
          exact: true,
        }),
      ).not.toHaveClass(/dead/);
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(large ? 8 : 4);
      await expect(page.getByTestId("composition-winner")).toHaveCount(large ? 8 : 4);
      await expect(
        page.getByRole("button", {
          name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
          exact: true,
        }),
      ).toHaveClass(/dead/);
    });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual role inspection renders a specific label without changing any seat`, async ({
    page,
  }) => {
    const replay = JSON.parse(
      readFileSync(
        frontendFixtureURL("frontend/tests/fixtures/gargoyle-twelve.replay.json"),
        "utf8",
      ),
    );
    replay.meta.locale = locale;
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const label = withPlayerNames(
      locale === "en" ? "Player 1 inspects player 5's role: Seer" : "1号查验5号的具体角色：预言家",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: label }).click();
    await expect(currentEventSourceText(page)).toHaveText(label);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
  });
for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: actual Spirit Seer pass/repeat renders privately without killing seats or premature victory`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/psychic-${large ? "twelve" : "skip"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        large
          ? locale === "en"
            ? "Player 5 inspects player 1's role: Werewolf"
            : "5号查验1号的具体角色：狼人"
          : locale === "en"
            ? "Player 3 ends the inspection opportunity on night 2: Passed"
            : "3号在第2夜结束查验机会：主动跳过",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).last().click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(large ? 5 : 1);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(large ? 8 : 2);
      await expect(page.getByTestId("composition-winner")).toHaveCount(large ? 8 : 2);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: real mechanical reflection and gun keep choices distinct from actual death`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/mechanical-${large ? "twelve" : "reflection"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        large
          ? locale === "en"
            ? "Mechanical Wolf shot: player 1 hit player 8."
            : "【机械狼开枪】1号命中8号。"
          : locale === "en"
            ? "Mechanical reflection: on night 2, player 1 shielded player 3; poison returned to original caster 4."
            : "【机械反毒】第2夜，1号保护3号，毒返回原施毒者4号。",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(large ? 8 : 1);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const actor = page.getByRole("button", {
        name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
        exact: true,
      });
      await expect(actor).toContainText(locale === "en" ? "Mechanical Wolf" : "机械狼");
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(large ? 8 : 4);
      await expect(page.getByTestId("composition-winner")).toHaveCount(large ? 8 : 4);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: actual Merchant gift and Lucky inspection keep real identities and lives until settlement`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/merchant-${large ? "twelve" : "dream"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        large
          ? locale === "en"
            ? "Player 5 checks player 2: Werewolves"
            : "5号查验2号：狼人"
          : locale === "en"
            ? "God trade result: player 3 to player 1, Inspection, night 1: Backlash proposal."
            : "【上帝交易结果】第1夜3号对1号的查验：反噬提案。",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const actor = page.getByRole("button", {
        name:
          locale === "en"
            ? `Player ${large ? 8 : 3}·Seat ${large ? 8 : 3}`
            : `${large ? 8 : 3}号·Seat ${large ? 8 : 3}`,
        exact: true,
      });
      await expect(actor).toContainText(locale === "en" ? "Miracle Merchant" : "奇迹商人");
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(large ? 8 : 4);
      await expect(page.getByTestId("composition-winner")).toHaveCount(large ? 8 : 4);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: real Hybrid private affiliation keeps Good identity and a dead Wolf-side winner`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/hybrid-${large ? "twelve_wolf_win" : "wolf_win"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const id = large ? 8 : 3,
        label = withPlayerNames(
          locale === "en"
            ? `God victory affiliation: player ${id} chose player 1 on night 1; frozen affiliation: Werewolves.`
            : `【上帝胜利归属】${id}号第1夜选择1号，冻结胜利归属：狼人。`,
          replay.players,
          locale,
        );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const actor = page.getByRole("button", {
        name: locale === "en" ? `Player ${id}·Seat ${id}` : `${id}号·Seat ${id}`,
        exact: true,
      });
      await expect(actor).toContainText(locale === "en" ? "Hybrid" : "混血儿");
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(large ? 5 : 3);
      await expect(page.getByTestId("composition-winner")).toHaveCount(large ? 5 : 3);
      await expect(actor).toHaveClass(/dead/);
      await expect(actor).toHaveClass(/winner/);
      await expect(actor).toContainText(locale === "en" ? "Hybrid" : "混血儿");
      const terminalCaption = await page.getByTestId("composition-caption").boundingBox();
      expect(terminalCaption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(terminalCaption!.y);
      }
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: actual Mirror unique report or exhausted pass leaves identities intact until terminal settlement`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/mirror-${large ? "twelve" : "exhausted"}.replay.json`,
          ),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = withPlayerNames(
        large
          ? locale === "en"
            ? "Player 5 inspects player 8's role: Guard"
            : "5号查验8号的具体角色：守卫"
          : locale === "en"
            ? "Player 3 ends the inspection opportunity on night 6: No eligible living targets"
            : "3号在第6夜结束查验机会：没有可查验的存活目标",
        replay.players,
        locale,
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(large ? 5 : 0);
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      const id = large ? 5 : 3,
        actor = page.getByRole("button", {
          name: locale === "en" ? `Player ${id}·Seat ${id}` : `${id}号·Seat ${id}`,
          exact: true,
        });
      await expect(actor).toContainText(locale === "en" ? "Mirror Girl" : "魔镜少女");
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(large ? 8 : 2);
      await expect(page.getByTestId("composition-winner")).toHaveCount(large ? 8 : 2);
      const finalCaption = await page.getByTestId("composition-caption").boundingBox();
      expect(finalCaption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(finalCaption!.y);
      }
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: PK captions stay public and badge effects change only at recorded handoff`, async ({
    page,
  }) => {
    const replay = structuredClone(original);
    replay.meta = { ...replay.meta, locale };
    replay.result = { winner: null, reason: "max_days_reached" };
    replay.players = [1, 2, 3].map((player_id) => ({ player_id, role: "villager", camp: "good" }));
    const facts = [
      { type: "sheriff_pk_started", stage: "sheriff_pk_speech", payload: { candidates: [1, 2] } },
      { type: "sheriff_elected", stage: "sheriff_vote", payload: { winnerId: 1 } },
      { type: "exile_pk_started", stage: "exile_pk_speech", payload: { candidates: [1, 2] } },
      { type: "night_resolved", stage: "night_resolved", payload: { deaths: [1] } },
      {
        type: "sheriff_badge_transferred",
        stage: "sheriff_badge_choice",
        payload: { fromId: 1, toId: 3, reason: "night_death" },
      },
    ];
    replay.events = facts.map((fact, index) => ({
      ...fact,
      seq: index + 1,
      day: index < 3 ? 1 : 2,
      phase: index < 3 ? "day" : "night",
      timestamp: "2026-10-09T00:00:00.000Z",
    }));
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const first = withPlayerNames(
      locale === "en" ? "Sheriff PK begins: Player 1, Player 2." : "警长PK开始：1号、2号。",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: first }).click();
    await expect(currentEventSourceText(page)).toHaveText(first);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
    await expect(page.locator(".seat-grid .sheriff")).toHaveCount(0);
    const third = withPlayerNames(
      locale === "en" ? "Exile PK begins: Player 1, Player 2." : "放逐PK开始：1号、2号。",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: third }).click();
    await expect(currentEventSourceText(page)).toHaveText(third);
    await expect(page.locator(".seat-grid .sheriff")).toHaveCount(1);
    await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
    await page.locator(".timeline .event").last().click();
    await expect(page.locator(".seat-grid .dead")).toHaveCount(1);
    const successor = page.getByRole("button", {
      name: locale === "en" ? "Player 3" : "3号",
      exact: true,
    });
    await expect(successor.locator(".sheriff")).toHaveCount(1);
    await expect(currentEventSourceText(page)).toContainText("3");
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: public death reveal changes the card marker at its recorded event`, async ({
    page,
  }) => {
    const replay = structuredClone(original);
    replay.meta = { ...replay.meta, locale };
    replay.result = { winner: null, reason: "max_days_reached" };
    replay.players = [
      { player_id: 1, role: "wolf", camp: "wolf" },
      { player_id: 2, role: "hunter", camp: "good" },
    ];
    replay.events = [
      { type: "phase_changed", payload: { phase: "day" } },
      { type: "player_role_revealed", payload: { playerId: 2, role: "hunter" } },
      {
        type: "last_words_spoken",
        payload: { playerId: 2, text: "Final words", phase: "day", day: 1 },
      },
    ].map((fact, index) => ({
      ...fact,
      seq: index + 1,
      day: 1,
      phase: "day",
      timestamp: "2026-10-09T00:00:00.000Z",
    }));
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    await page.locator(".timeline .event").first().click();
    const target = page.getByRole("button", {
      name: locale === "en" ? "Player 2" : "2号",
      exact: true,
    });
    const marker = locale === "en" ? "Revealed: Hunter" : "已翻牌：猎人";
    await expect(target).not.toContainText(marker);
    await expect(target).toHaveClass(/alive/);
    const label = withPlayerNames(
      locale === "en" ? "Player 2 revealed their role card: Hunter" : "2号公开身份牌：猎人",
      replay.players,
      locale,
    );
    await page.locator(".timeline .event").filter({ hasText: label }).click();
    await expect(currentEventSourceText(page)).toHaveText(label);
    await expect(target).toContainText(marker);
    await expect(target).toHaveClass(/dead/);
    await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
    await page.locator(".timeline .event").first().click();
    await expect(target).not.toContainText(marker);
    await expect(target).toHaveClass(/alive/);
  });

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["dream", "inspection", "king_chain"] as const)
    test(`${locale}/${kind}: actual Cursed Fox archive reaches a chain-final personal victory or dead Fox with Good winners`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(frontendFixtureURL(`frontend/tests/fixtures/fox-${kind}.replay.json`), "utf8"),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(kind === "dream" ? 1 : 4);
      await expect(page.getByTestId("composition-winner")).toHaveCount(kind === "dream" ? 1 : 4);
      const fox = page.getByRole("button", {
        name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
        exact: true,
      });
      if (kind === "dream") {
        await expect(fox).not.toHaveClass(/dead/);
        await expect(fox).toHaveClass(/winner/);
        await expect(page.locator(".result-chip strong")).toContainText(
          locale === "en" ? "personal goal victory" : "个人目标胜利",
        );
        await expect(currentEventSourceText(page)).toContainText(
          locale === "en" ? "Survive an ordinary faction elimination" : "普通阵营全灭时存活",
        );
      } else {
        await expect(fox).toHaveClass(/dead/);
        await expect(fox).not.toHaveClass(/winner/);
      }
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      if (kind === "dream")
        await page.screenshot({ path: `/tmp/awa-p8-fox-${locale}-browser.png`, fullPage: true });
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["mixed_netease", "mixed_lui", "root_hunter", "dream_chain"] as const)
    test(`${locale}/${kind}: actual Cupid archive separates relationship membership, heartbreak death and chain-final winners`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/cupid-${kind}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await expect(page.locator(".seat-grid .winner")).toHaveCount(0);
      await page.locator(".timeline .event").last().click();
      const count = kind === "mixed_netease" ? 3 : kind === "mixed_lui" ? 2 : 4;
      await expect(page.locator(".seat-grid .winner")).toHaveCount(count);
      await expect(page.getByTestId("composition-winner")).toHaveCount(count);
      const cupid = page.getByRole("button", {
        name: locale === "en" ? "Player 1·Seat 1" : "1号·Seat 1",
        exact: true,
      });
      if (kind === "mixed_netease") {
        await expect(cupid).not.toHaveClass(/dead/);
        await expect(cupid).toHaveClass(/winner/);
      } else {
        await expect(cupid).toHaveClass(/dead/);
        if (kind === "mixed_lui") await expect(cupid).not.toHaveClass(/winner/);
        else await expect(cupid).toHaveClass(/winner/);
      }
      if (kind.startsWith("mixed_")) {
        await expect(page.locator(".result-chip strong")).toContainText(
          locale === "en" ? "Cupid lovers" : "丘比特情侣组",
        );
        await expect(page.locator(".result-chip strong")).not.toContainText("cupid_lovers");
      }
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      if (kind === "mixed_netease")
        await page.screenshot({ path: `/tmp/awa-p8-cupid-${locale}-browser.png`, fullPage: true });
    });

for (const size of [6, 12])
  for (const outcome of ["success", "tie"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${outcome}/${locale}: actual Debater live reveal and anonymous studio result`, async ({
        page,
      }) => {
        const replay = JSON.parse(
          readFileSync(
            frontendFixtureURL(`frontend/tests/fixtures/debater-${size}-${outcome}.replay.json`),
            "utf8",
          ),
        );
        replay.meta.locale = locale;
        const index = replay.events.findIndex(
            (e: { type: string }) => e.type === "debater_revealed",
          ),
          actor = replay.events[index].payload.actorId;
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        await page.locator(".timeline .event").nth(index).click();
        const seat = page.getByRole("button", {
          name: locale === "en" ? `Player ${actor}·Seat ${actor}` : `${actor}号·Seat ${actor}`,
          exact: true,
        });
        await expect(seat).not.toHaveClass(/dead/);
        await expect(currentEventSourceText(page)).toContainText(
          locale === "en" ? "remains alive" : "仍然存活",
        );
        const result = replay.events.findIndex(
          (e: { type: string }) => e.type === "debate_resolved",
        );
        await page.locator(".timeline .event").nth(result).click();
        await expect(currentEventSourceText(page)).toContainText(
          locale === "en" ? "participants" : "全体",
        );
        await expect(currentEventSourceText(page)).not.toContainText("voterId");
        await expect(page.locator("[data-video-stage]")).not.toContainText("voterId");
        await expect(seat).not.toHaveClass(/dead/);
        if (size === 12 && outcome === "success")
          await page.screenshot({
            path: `/tmp/awa-p8-debater-${locale}-browser.png`,
            fullPage: true,
          });
      });

for (const size of [6, 12])
  for (const mode of ["write", "skip"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${mode}/${locale}: actual anonymous wall caption and unchanged alive seats`, async ({
        page,
      }) => {
        const replay = JSON.parse(
          readFileSync(
            frontendFixtureURL(`frontend/tests/fixtures/wall-${size}-${mode}.replay.json`),
            "utf8",
          ),
        );
        replay.meta.locale = locale;
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        await page
          .locator(".timeline .event")
          .filter({
            hasText:
              locale === "en" ? "Anonymous wall notes (random order)" : "匿名墙纸条（随机顺序）",
          })
          .click();
        await expect(currentEventSourceText(page)).toContainText(
          locale === "en" ? "Anonymous wall" : "匿名墙",
        );
        // 非空纸条仍保留用户原文；空列表采用共享的“无／None”语义，不泄露原始 JSON 表示。
        await expect(currentEventSourceText(page)).toContainText(
          mode === "write" ? "[God] secret 💌" : locale === "en" ? "None" : "无",
        );
        await expect(currentEventSourceText(page)).not.toContainText("actorId");
        await expect(page.locator("[data-video-stage]")).not.toContainText("actorId");
        const exile = replay.events.find((e: { type: string }) => e.type === "voted_out").payload
          .target;
        for (const player of replay.players) {
          const seat = page.getByRole("button", {
            name:
              locale === "en"
                ? `Player ${player.player_id}·Seat ${player.player_id}`
                : `${player.player_id}号·Seat ${player.player_id}`,
            exact: true,
          });
          if (player.player_id === exile) await expect(seat).toHaveClass(/dead/);
          else await expect(seat).not.toHaveClass(/dead/);
        }
        const slider = page.getByRole("slider");
        for (let step = 0; step < 15; step++) await slider.press("ArrowRight");
        await expect(page.getByTestId("composition-caption")).toHaveCSS("opacity", "1");
        if (size === 12 && mode === "write")
          await page.screenshot({ path: `/tmp/awa-p8-wall-${locale}-browser.png`, fullPage: true });
      });

for (const name of ["6-seer", "6-hunter", "12-both0", "12-keep"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual Thief archive changes original role only at chosen fact in studio and video`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/thief-${name}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      const index = replay.events.findIndex(
          (e: { type: string }) => e.type === "thief_identity_chosen",
        ),
        event = replay.events[index],
        actor = event.payload.actorId;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const seat = page.getByRole("button", {
        name: locale === "en" ? `Player ${actor}·Seat ${actor}` : `${actor}号·Seat ${actor}`,
        exact: true,
      });
      await expect(seat).toContainText(locale === "en" ? "Thief" : "盗贼");
      await page.locator(".timeline .event").nth(index).click();
      const labels: Record<string, [string, string]> = {
        seer: ["预言家", "Seer"],
        hunter: ["猎人", "Hunter"],
        wolf: ["狼人", "Werewolf"],
        thief: ["盗贼", "Thief"],
      };
      const label = labels[event.payload.role]![locale === "en" ? 1 : 0];
      await expect(seat).toContainText(label);
      await expect(seat).not.toHaveClass(/dead/);
      await expect(page.locator(`[data-composition-player="${actor}"]`)).toContainText(label);
      await expect(currentEventSourceText(page)).toContainText(locale === "en" ? "Thief" : "盗贼");
      const slider = page.getByRole("slider");
      for (let n = 0; n < 15; n++) await slider.press("ArrowRight");
      await expect(page.getByTestId("composition-caption")).toHaveCSS("opacity", "1");
      if (name === "12-both0")
        await page.screenshot({ path: `/tmp/awa-p9-thief-${locale}-browser.png`, fullPage: true });
    });

for (const name of ["6-wolf_exile", "6-hunter_chain", "12-good_knife", "6-same_wave"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual Wild Child archive keeps role and changes camp only at transformation`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/wild-child-${name}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      const actor = replay.events.find(
          (e: { type: string }) => e.type === "wild_child_model_chosen",
        ).payload.actorId,
        index = replay.events.findIndex(
          (e: { type: string }) => e.type === "wild_child_transformed",
        );
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const seat = page.getByRole("button", {
        name: locale === "en" ? `Player ${actor}·Seat ${actor}` : `${actor}号·Seat ${actor}`,
        exact: true,
      });
      await expect(seat).toContainText(locale === "en" ? "Wild Child" : "野孩子");
      await expect(seat).toHaveClass(/good/);
      if (index < 0) {
        await page.locator(".timeline .event").last().click();
        await expect(seat).toHaveClass(/dead/);
        await expect(seat).toContainText(locale === "en" ? "Wild Child" : "野孩子");
        return;
      }
      const selectedLabel = wildChildEventLabel(
        "wild_child_transformed",
        replay.events[index].payload,
        locale,
        createPlayerText(
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        ),
      )!;
      await page.locator(".timeline .event").filter({ hasText: selectedLabel }).click();
      await expect(currentEventSourceText(page)).toHaveText(selectedLabel);
      await expect(seat).not.toHaveClass(/dead/);
      await expect(seat).toHaveClass(/wolf/);
      await expect(seat).toContainText(locale === "en" ? "Wild Child" : "野孩子");
      await expect(page.locator(`[data-composition-player="${actor}"]`)).toContainText(
        locale === "en" ? "Wild Child" : "野孩子",
      );
      await expect(currentEventSourceText(page)).toContainText(
        locale === "en" ? "Wild Child" : "野孩子",
      );
      const slider = page.getByRole("slider");
      for (let n = 0; n < 15; n++) await slider.press("ArrowRight");
      await expect(page.getByTestId("composition-caption")).toHaveCSS("opacity", "1");
      if (name === "12-good_knife")
        await page.screenshot({
          path: `/tmp/awa-p9-wild-child-${locale}-browser.png`,
          fullPage: true,
        });
    });

for (const name of ["6-seer", "6-hunter", "12-both0", "12-one1"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual Shapeshifter archive changes original role only at chosen fact in studio and video`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/shapeshifter-${name}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      const index = replay.events.findIndex(
          (e: { type: string }) => e.type === "shapeshifter_identity_chosen",
        ),
        event = replay.events[index],
        actor = event.payload.actorId;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const seat = page.getByRole("button", {
        name: locale === "en" ? `Player ${actor}·Seat ${actor}` : `${actor}号·Seat ${actor}`,
        exact: true,
      });
      await expect(seat).toContainText(locale === "en" ? "Many-Faced One" : "千面人");
      const selectedLabel = shapeshifterEventLabel(
        event.type,
        event.payload,
        locale,
        createPlayerText(
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        ),
      )!;
      await page.locator(".timeline .event").filter({ hasText: selectedLabel }).click();
      await expect(currentEventSourceText(page)).toHaveText(selectedLabel);
      const labels: Record<string, [string, string]> = {
        seer: ["预言家", "Seer"],
        hunter: ["猎人", "Hunter"],
        wolf: ["狼人", "Werewolf"],
        shapeshifter: ["千面人", "Many-Faced One"],
      };
      const label = labels[event.payload.role]![locale === "en" ? 1 : 0];
      await expect(seat).toContainText(label);
      await expect(seat).not.toHaveClass(/dead/);
      await expect(page.locator(`[data-composition-player="${actor}"]`)).toContainText(label);
      await expect(currentEventSourceText(page)).toContainText(
        locale === "en" ? "Many-Faced One" : "千面人",
      );
      const slider = page.getByRole("slider");
      for (let n = 0; n < 15; n++) await slider.press("ArrowRight");
      await expect(page.getByTestId("composition-caption")).toHaveCSS("opacity", "1");
      if (name === "12-both0")
        await page.screenshot({
          path: `/tmp/awa-p9-shapeshifter-${locale}-browser.png`,
          fullPage: true,
        });
    });

for (const name of ["6-seer", "12-one1"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual actor choice archive renders native role while other identities stay unknown`, async ({
      page,
    }) => {
      const privateView = readReplayPlayerView(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(
                `frontend/tests/fixtures/player-views/shapeshifter-${name}.player.json`,
              ),
              "utf8",
            ),
          ),
        ),
        god = JSON.parse(
          readFileSync(
            frontendFixtureURL(`frontend/tests/fixtures/shapeshifter-${name}.replay.json`),
            "utf8",
          ),
        );
      const own = privateView.timeline.find(
        (row) => row.kind === "event" && row.event.type === "shapeshifter_identity_chosen",
      );
      if (!own || own.kind !== "event") throw new Error("actual_actor_fact_missing");
      const actor = privateView.player_id,
        event = {
          seq: 1,
          timestamp: own.timestamp,
          phase: own.phase,
          day: own.day,
          type: own.event.type,
          payload: own.event.payload,
        },
        replay = {
          ...god,
          meta: { ...god.meta, locale },
          players: god.players.map((p: any) => ({
            ...p,
            role: p.player_id === actor ? privateView.role : "unknown",
            camp: p.player_id === actor ? privateView.camp : "unknown",
          })),
          events: [
            {
              seq: 1,
              timestamp: "2026-10-09T00:00:00Z",
              phase: "night",
              day: 1,
              type: "phase_changed",
              payload: { phase: "night", day: 1 },
            },
            { ...event, seq: 2 },
          ],
        };
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const seat = page.getByRole("button", {
        name: locale === "en" ? `Player ${actor}·Seat ${actor}` : `${actor}号·Seat ${actor}`,
        exact: true,
      });
      await expect(seat).toContainText(locale === "en" ? "Many-Faced One" : "千面人");
      const label = shapeshifterEventLabel(
        event.type,
        event.payload,
        locale,
        createPlayerText(
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        ),
      )!;
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(seat).toContainText(
        event.payload.role === "wolf"
          ? locale === "en"
            ? "Werewolf"
            : "狼人"
          : locale === "en"
            ? "Seer"
            : "预言家",
      );
      await expect(seat).not.toHaveClass(/dead/);
      for (const p of replay.players.filter((p: any) => p.player_id !== actor))
        await expect(page.locator(`[data-composition-player="${p.player_id}"]`)).toContainText(
          text(locale, "replay.unknown"),
        );
    });

for (const name of ["6-good_dead", "6-hunter_chain", "6-wolf_needs_girl", "12-wolf_win"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual Lonely Girl God archive keeps identity at admiration and shows terminal membership`, async ({
      page,
    }) => {
      const replay = JSON.parse(
        readFileSync(
          frontendFixtureURL(`frontend/tests/fixtures/lonely-girl-${name}.replay.json`),
          "utf8",
        ),
      );
      replay.meta.locale = locale;
      const event = replay.events.find((e: any) => e.type === "lonely_girl_admired_chosen"),
        actor = event.payload.actorId,
        label = lonelyGirlEventLabel(
          event.type,
          event.payload,
          locale,
          createPlayerText(
            replay.players.map((p: { player_id: number; name?: string }) => ({
              id: p.player_id,
              name: p.name,
            })),
          ),
        )!;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const seat = page.getByRole("button", {
        name: locale === "en" ? `Player ${actor}·Seat ${actor}` : `${actor}号·Seat ${actor}`,
        exact: true,
      });
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(seat).toContainText(locale === "en" ? "Lonely Girl" : "孤独少女");
      await expect(seat).not.toHaveClass(/dead/);
      await expect(page.locator(`[data-composition-player="${actor}"]`)).toContainText(
        locale === "en" ? "Lonely Girl" : "孤独少女",
      );
      const slider = page.getByRole("slider");
      for (let n = 0; n < 15; n++) await slider.press("ArrowRight");
      await expect(page.getByTestId("composition-caption")).toHaveCSS("opacity", "1");
      if (name === "12-wolf_win")
        await page.screenshot({
          path: `/tmp/awa-p9-lonely-girl-${locale}-browser.png`,
          fullPage: true,
        });
      await page.locator(".timeline .event").last().click();
      await expect(seat).toContainText(locale === "en" ? "Lonely Girl" : "孤独少女");
      await expect(seat).toHaveClass(/dead/);
      await expect(seat).toHaveClass(/winner-seat/);
      await expect(page.locator(`[data-composition-player="${actor}"]`)).toHaveAttribute(
        "data-testid",
        "composition-winner",
      );
      if (name === "12-wolf_win")
        await page.screenshot({
          path: `/tmp/awa-p9-lonely-girl-${locale}-terminal-browser.png`,
          fullPage: true,
        });
    });
for (const name of ["6-good_dead", "12-wolf_win"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual actor admiration has no target identity or membership in minimal shared frame`, async ({
      page,
    }) => {
      const view = readReplayPlayerView(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(
                `frontend/tests/fixtures/player-views/lonely-girl-${name}.player.json`,
              ),
              "utf8",
            ),
          ),
        ),
        god = JSON.parse(
          readFileSync(
            frontendFixtureURL(`frontend/tests/fixtures/lonely-girl-${name}.replay.json`),
            "utf8",
          ),
        ),
        own = view.timeline.find(
          (row) => row.kind === "event" && row.event.type === "lonely_girl_admired_chosen",
        );
      if (!own || own.kind !== "event") throw new Error("missing_actor_fact");
      const actor = view.player_id,
        event = {
          seq: 2,
          timestamp: own.timestamp,
          phase: own.phase,
          day: own.day,
          type: own.event.type,
          payload: own.event.payload,
        },
        replay = {
          ...god,
          meta: { ...god.meta, locale },
          players: god.players.map((p: any) => ({
            ...p,
            role: p.player_id === actor ? view.role : "unknown",
            camp: p.player_id === actor ? view.camp : "unknown",
          })),
          events: [
            {
              seq: 1,
              timestamp: "2026-10-09T00:00:00Z",
              phase: "night",
              day: 1,
              type: "phase_changed",
              payload: { phase: "night", day: 1 },
            },
            event,
          ],
        };
      expect(Object.hasOwn(event.payload, "camp")).toBe(false);
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = lonelyGirlEventLabel(
        event.type,
        event.payload,
        locale,
        createPlayerText(
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        ),
      )!;
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(`[data-composition-player="${actor}"]`)).toContainText(
        locale === "en" ? "Lonely Girl" : "孤独少女",
      );
      for (const p of replay.players.filter((p: any) => p.player_id !== actor))
        await expect(page.locator(`[data-composition-player="${p.player_id}"]`)).toContainText(
          text(locale, "replay.unknown"),
        );
    });
