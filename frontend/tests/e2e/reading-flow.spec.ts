/**
 * 浏览器集成测试负责真实授权字体后的全文量高、词组换行和确定性阅读策略。输入为明确标注验收的手写6／12席公开记录及主题。
 * 预期来自独立原文、字号、原生DOM首末行、静止段和像素网格；计划及实测行数仅定位采样帧，不生成文字或事实答案。
 * 不运行游戏或模型，不改历史fixture；反向seek恢复同一位移，延迟真实字体证明未就绪时正文不能提前量高。
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../src/video/compiler";
import { getVideoSourceIdentity } from "../../src/video/source";
import type { VideoPlan } from "../../src/video/types";

function readingReplay(body: string, locale: "zh-CN" | "en", count: number): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "explicit-reading-review-fixture",
    meta: { board: "non-game reading acceptance", locale, startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: Array.from({ length: count }, (_, index) => ({
      player_id: index + 1,
      role: index === 0 ? "wolf" : "villager",
      camp: index === 0 ? "wolf" : "good",
    })),
    events: [
      {
        seq: 1,
        day: 1,
        phase: "day",
        timestamp: "2026-10-17T00:00:00Z",
        type: "day_speech",
        payload: { actorId: 2, text: body },
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
const ordinary =
  "这是独立版式验收，并非真实对局。白痴与禁言长老讨论狼人达半，12号使用Claude-Opus-4.6。请保留原话与明确署名，不从发言推导技能或阵营；这一整段应在正常字号下完整展示，短文不自动放大。";

function longReadingBody(locale: "zh-CN" | "en") {
  return locale === "en"
    ? "Independent reading acceptance, not a real game. Player 12 keeps Claude-Opus-4.6 and every original word. ".repeat(
        35,
      )
    : "独立阅读验收，非真实对局。白痴与12号保留原话，狼人达半只是本句文字，不是新判定。".repeat(35);
}

async function pixelAlignedOffset(viewport: Locator) {
  const offset = Number(await viewport.getAttribute("data-reading-offset"));
  const pixelScale = Number(await viewport.getAttribute("data-reading-pixel-scale"));
  expect(pixelScale).toBeGreaterThan(0);
  expect(Number.isFinite(offset)).toBe(true);
  expect(offset * pixelScale).toBeCloseTo(Math.round(offset * pixelScale), 6);
  return offset;
}

async function expectVisibleLastLine(viewport: Locator) {
  const last = await viewport.locator("[data-reading-content] > span").last().boundingBox();
  const window = await viewport.locator("[data-reading-window]").boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(window!.y + window!.height + 1);
}

async function expectWholeVisibleLines(viewport: Locator) {
  await expect(viewport.locator("[data-reading-window]")).toHaveAttribute(
    "data-reading-whole-rows",
    "true",
  );
  // 直接核排版后的inline行矩形，不借生产量高公式重算答案；亚像素容差只覆盖像素网格舍入。
  const lines = await viewport.evaluate((element) => {
    const window = element.querySelector("[data-reading-window]")!.getBoundingClientRect();
    const rects = Array.from(element.querySelectorAll("[data-reading-content] > span")).flatMap(
      (span) => Array.from(span.getClientRects()),
    );
    const visible = rects.filter(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > window.top + 0.75 &&
        rect.top < window.bottom - 0.75,
    );
    return {
      visible: visible.length,
      cutBottom: visible
        .filter((rect) => rect.bottom > window.bottom + 0.75)
        .map((rect) => ({ top: rect.top, bottom: rect.bottom, windowBottom: window.bottom })),
    };
  });
  expect(lines.visible).toBeGreaterThan(2);
  expect(lines.cutBottom).toEqual([]);
}

for (const [theme, locale, count, height, large] of [
  ["gothic-v1", "zh-CN", 12, 1080, false],
  ["minimal-v1", "zh-CN", 6, 720, false],
  ["gothic-v1", "en", 12, 720, true],
] as const)
  test(`${theme}/${locale}/${count}/${height}/${large}: a normal paragraph fits without changing its words or requested text size`, async ({
    page,
  }) => {
    const replay = readingReplay(ordinary, locale, count);
    const plan = compileVideoPlan(
      replay,
      {
        source: getVideoSourceIdentity(replay),
        layout: "broadcast-v1",
        width: (height * 16) / 9,
        height,
        theme: { id: theme, options: { largeText: large } },
      },
      { locale, timeZone: "UTC" },
    );
    await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
    await page.goto("/video.html");
    const viewport = page.locator("[data-reading-viewport]");
    await expect(viewport).toHaveAttribute("data-reading-ready", "true");
    await expect(viewport.locator("[data-reading-content]")).toHaveText(ordinary);
    expect(
      await viewport.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBeCloseTo(((large ? 48 : 26) * height) / 1080, 3);
    await expect(viewport).toHaveAttribute("data-reading-overflow", "0");
    await expect(page.locator("[data-neutral-record]")).toHaveCount(0);
    const protectedWords = viewport.locator("[data-reading-token]");
    for (const term of ["白痴", "禁言长老", "狼人达半", "12号", "Claude-Opus-4.6"]) {
      const word = protectedWords.filter({ hasText: term }).first();
      await expect(word).toBeVisible();
      expect(await word.evaluate((element) => element.getClientRects().length)).toBe(1);
    }
    const bounds = await page.locator('[data-surface="speech"]').boundingBox();
    const stage = await page.locator("[data-video-stage]").boundingBox();
    // 短文仍按内容收缩，不能因长文上限升到90%而一律撑满。
    expect(bounds!.height).toBeLessThan(stage!.height * 0.8);
    expect(bounds!.y).toBeGreaterThan(stage!.y);
    expect(bounds!.y + bounds!.height).toBeLessThan(stage!.y + stage!.height);
  });

for (const [theme, locale, height, fps, large, reduced] of [
  ["gothic-v1", "zh-CN", 1080, 30, false, false],
  ["minimal-v1", "en", 720, 60, false, false],
  ["gothic-v1", "zh-CN", 720, 30, true, true],
] as const)
  test(`${theme}/${locale}/${height}/${fps}/${large}/${reduced}: full text scrolls linearly and reverse seek returns the same view`, async ({
    page,
  }) => {
    const body = longReadingBody(locale);
    const replay = readingReplay(body, locale, 12);
    const plan = compileVideoPlan(
      replay,
      {
        source: getVideoSourceIdentity(replay),
        layout: "broadcast-v1",
        width: (height * 16) / 9,
        height,
        fps,
        speechReading: { motion: "continuous" },
        theme: { id: theme, options: { largeText: large, reducedMotion: reduced } },
      },
      { locale, timeZone: "UTC" },
    );
    const reading = plan.shots[0]!.reading!;
    const start = reading.from + reading.headHoldFrames;
    const end = reading.from + reading.durationFrames - reading.tailHoldFrames;
    const middle = Math.floor((start + end) / 2);
    await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
    await page.goto("/video.html");
    const viewport = page.locator("[data-reading-viewport]");
    await expect(viewport).toHaveAttribute("data-reading-ready", "true");
    await expect(viewport).toHaveAttribute("data-reading-motion", "continuous");
    await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
    expect(
      await viewport.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    ).toBeCloseTo(((large ? 48 : locale === "en" ? 24 : 26) * height) / 1080, 3);
    await expect
      .poll(async () => Number(await viewport.getAttribute("data-reading-overflow")))
      .toBeGreaterThan(100);
    const overflow = Number(await viewport.getAttribute("data-reading-overflow"));
    await seek(page, start);
    await expect(viewport).toHaveAttribute("data-reading-offset", "0");
    await seek(page, middle);
    await expect
      .poll(async () => Number(await viewport.getAttribute("data-reading-offset")))
      .toBeGreaterThan(overflow * 0.49);
    const middleOffset = await pixelAlignedOffset(viewport);
    expect(middleOffset).toBeLessThan(overflow * 0.51);
    await seek(page, end);
    await expect
      .poll(async () => Number(await viewport.getAttribute("data-reading-offset")))
      .toBeGreaterThanOrEqual(overflow);
    const finalOffset = await pixelAlignedOffset(viewport);
    const pixelScale = Number(await viewport.getAttribute("data-reading-pixel-scale"));
    expect(finalOffset).toBeLessThanOrEqual(overflow + 1 / pixelScale);
    await expectVisibleLastLine(viewport);
    await seek(page, middle);
    await expect
      .poll(async () => Number(await viewport.getAttribute("data-reading-offset")))
      .toBe(middleOffset);
    await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
    await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
  });

test.describe("whole-line speech holds on the physical pixel grid", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 1100, height: 800 } });

  for (const locale of ["zh-CN", "en"] as const)
    test(`${locale}: long speech rests between short advances and remains deterministic after resize`, async ({
      page,
    }) => {
      const body = longReadingBody(locale);
      const replay = readingReplay(body, locale, 12);
      const height = locale === "en" ? 720 : 1080;
      const plan = compileVideoPlan(
        replay,
        {
          source: getVideoSourceIdentity(replay),
          layout: "broadcast-v1",
          width: (height * 16) / 9,
          height,
          // 中文验缺省逐行策略，英文明确同一策略及短推进上限；不从实现重算位移答案。
          ...(locale === "en"
            ? { speechReading: { motion: "line" as const, transitionFrames: 6 } }
            : {}),
        },
        { locale, timeZone: "UTC" },
      );
      const shot = plan.shots[0]!;
      const reading = shot.reading!;
      const start = shot.from + reading.from + reading.headHoldFrames;
      const end = shot.from + reading.from + reading.durationFrames - reading.tailHoldFrames;
      await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
      await page.goto("/video.html");
      const viewport = page.locator("[data-reading-viewport]");
      await expect(viewport).toHaveAttribute("data-reading-ready", "true");
      await expect(viewport).toHaveAttribute("data-reading-motion", "line");
      await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
      const card = await page.locator('[data-surface="speech"]').boundingBox();
      const stage = await page.locator("[data-video-stage]").boundingBox();
      expect(card!.height).toBeGreaterThan(stage!.height * 0.85);
      expect(card!.height).toBeLessThanOrEqual(stage!.height * 0.9 + 2);
      await expect
        .poll(async () => Number(await viewport.getAttribute("data-reading-line-stops")))
        .toBeGreaterThan(3);
      const steps = Number(await viewport.getAttribute("data-reading-line-stops")) - 1;
      const cycle = (end - start) / steps;
      expect(cycle).toBeGreaterThan(30);
      const frameAt = (step: number, fraction: number) =>
        Math.floor(start + (step + fraction) * cycle);

      await seek(page, Math.max(shot.from, start - 1));
      await expect(viewport).toHaveAttribute("data-reading-offset", "0");
      const holds: number[] = [];
      // 相邻数个停留帧必须完全相同；下一行停留严格前进，不能只验证开始和结束而漏掉果冻漂移。
      for (const step of [0, 1, 2]) {
        const offsets: number[] = [];
        for (const fraction of [0.1, 0.3, 0.6]) {
          await seek(page, frameAt(step, fraction));
          offsets.push(await pixelAlignedOffset(viewport));
          await expectWholeVisibleLines(viewport);
        }
        expect(offsets[1]).toBe(offsets[0]);
        expect(offsets[2]).toBe(offsets[0]);
        holds.push(offsets[0]!);
      }
      expect(holds[0]).toBe(0);
      expect(holds[1]).toBeGreaterThan(holds[0]!);
      expect(holds[2]).toBeGreaterThan(holds[1]!);

      const transition = reading.transitionFrames!;
      const boundary = Math.ceil(start + cycle);
      const advance: number[] = [];
      for (let frame = boundary - transition - 1; frame <= boundary + 1; frame++) {
        await seek(page, frame);
        advance.push(await pixelAlignedOffset(viewport));
      }
      expect(advance[0]).toBe(holds[0]);
      expect(advance.at(-1)).toBe(holds[1]);
      for (let index = 1; index < advance.length; index++)
        expect(advance[index]).toBeGreaterThanOrEqual(advance[index - 1]!);
      expect(advance.some((offset) => offset > holds[0]! && offset < holds[1]!)).toBe(true);

      await seek(page, end);
      const overflow = Number(await viewport.getAttribute("data-reading-overflow"));
      const finalOffset = await pixelAlignedOffset(viewport);
      const pixelScale = Number(await viewport.getAttribute("data-reading-pixel-scale"));
      expect(finalOffset).toBeGreaterThanOrEqual(overflow);
      expect(finalOffset).toBeLessThanOrEqual(overflow + 1 / pixelScale);
      await expectVisibleLastLine(viewport);
      await seek(page, frameAt(1, 0.3));
      expect(await pixelAlignedOffset(viewport)).toBe(holds[1]);

      await page.setViewportSize({ width: 930, height: 740 });
      await expect
        .poll(async () => Number(await viewport.getAttribute("data-reading-pixel-scale")))
        .not.toBe(pixelScale);
      await expect(viewport).toHaveAttribute("data-reading-motion", "line");
      const resized: number[] = [];
      for (const fraction of [0.1, 0.3, 0.6]) {
        await seek(page, frameAt(1, fraction));
        resized.push(await pixelAlignedOffset(viewport));
        await expectWholeVisibleLines(viewport);
      }
      expect(resized[1]).toBe(resized[0]);
      expect(resized[2]).toBe(resized[0]);
      const resizedPixelScale = Number(await viewport.getAttribute("data-reading-pixel-scale"));
      expect(Math.abs(resized[0]! - holds[1]!)).toBeLessThanOrEqual(
        1 / pixelScale + 1 / resizedPixelScale,
      );
      await seek(page, end);
      await expectVisibleLastLine(viewport);
      await seek(page, frameAt(1, 0.3));
      expect(await pixelAlignedOffset(viewport)).toBe(resized[0]);
      await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
      await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
    });
});

for (const mode of ["static", "legacy-continuous"] as const)
  test(`${mode}: explicit static speech stays put and an old prepared reading keeps exact continuous offsets`, async ({
    page,
  }) => {
    const body = longReadingBody("zh-CN");
    const replay = readingReplay(body, "zh-CN", 6);
    const plan = compileVideoPlan(replay, {
      source: getVideoSourceIdentity(replay),
      layout: "broadcast-v1",
      speechReading: { motion: "static" },
    });
    const shot = plan.shots[0]!;
    const reading = shot.reading!;
    if (mode === "legacy-continuous") {
      // 手写旧prepared形状：去掉新增策略字段，不让新版编译器替测试自产兼容预期。
      delete reading.motion;
      delete reading.transitionFrames;
    }
    const start = shot.from + reading.from + reading.headHoldFrames;
    const end = shot.from + reading.from + reading.durationFrames - reading.tailHoldFrames;
    const middle = Math.floor((start + end) / 2);
    await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
    await page.goto("/video.html");
    const viewport = page.locator("[data-reading-viewport]");
    await expect(viewport).toHaveAttribute("data-reading-ready", "true");
    await expect(viewport).toHaveAttribute("data-reading-motion", mode);
    await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
    const overflow = Number(await viewport.getAttribute("data-reading-overflow"));
    expect(overflow).toBeGreaterThan(100);
    for (const frame of [start, middle, end, middle, start]) {
      await seek(page, frame);
      const expected = mode === "static" ? 0 : (overflow * (frame - start)) / (end - start);
      await expect
        .poll(async () => Number(await viewport.getAttribute("data-reading-offset")))
        .toBeCloseTo(expected, 8);
    }
    await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
    await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
  });

test("a delayed real project font holds the reading subtree until the exact face is loaded", async ({
  page,
}) => {
  const replay = readingReplay(ordinary, "zh-CN", 12);
  const plan: VideoPlan = compileVideoPlan(replay, {
    source: getVideoSourceIdentity(replay),
    layout: "broadcast-v1",
  });
  plan.fonts = [{ family: "Noto Sans SC", src: "/reading-font.woff2", weight: "100 900" }];
  const bytes = readFileSync(
    new URL("../../src/themes/fonts/NotoSansSC-VF.woff2", import.meta.url),
  );
  let release!: () => void,
    requested = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/reading-font.woff2", async (route) => {
    requested = true;
    await pending;
    await route.fulfill({ contentType: "font/woff2", body: bytes });
  });
  await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
  await page.goto("/video.html", { waitUntil: "domcontentloaded" });
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator("[data-reading-viewport]")).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.locator("[data-reading-viewport]")).toHaveAttribute(
    "data-reading-ready",
    "true",
  );
  await expect(page.locator("[data-reading-content]")).toHaveText(ordinary);
  expect(await page.evaluate(() => document.fonts.check('26px "Noto Sans SC"'))).toBe(true);
});

test("StrictMode releases only committed font and layout handles and keeps reverse seek responsive", async ({
  page,
}) => {
  const body = ordinary.repeat(25);
  await page.route("**/api/replay", (route) =>
    route.fulfill({ json: readingReplay(body, "zh-CN", 12) }),
  );
  // 主工作台真实入口在StrictMode下挂载；不另造测试宿主绕过effect的setup／cleanup回放。
  await page.goto("/");
  const viewport = page.locator("[data-reading-viewport]");
  await expect(viewport).toHaveAttribute("data-reading-ready", "true");
  await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
  const pendingHandles = () =>
    page.evaluate(
      () =>
        (window as unknown as { remotion_delayRenderHandles?: number[] })
          .remotion_delayRenderHandles?.length ?? 0,
    );
  await expect.poll(pendingHandles).toBe(0);
  const slider = page.locator('.frame-control input[type="range"]');
  const lastFrame = Number(await slider.getAttribute("max"));
  await seek(page, lastFrame);
  await expect
    .poll(async () => Number(await viewport.getAttribute("data-reading-offset")))
    .toBeGreaterThan(0);
  await seek(page, 0);
  await expect(viewport).toHaveAttribute("data-reading-offset", "0");
  await expect.poll(pendingHandles).toBe(0);
});

test("switching adjacent short and long speeches remeasures the same reading window without locking its height", async ({
  page,
}) => {
  const body = longReadingBody("zh-CN");
  const replay = readingReplay(ordinary, "zh-CN", 12);
  replay.events.push({
    seq: 2,
    day: 1,
    phase: "day",
    timestamp: "2026-10-17T00:00:01Z",
    type: "day_speech",
    payload: { actorId: 2, text: body },
  });
  const plan = compileVideoPlan(replay, {
    source: getVideoSourceIdentity(replay),
    layout: "broadcast-v1",
  });
  expect(plan.shots).toHaveLength(2);
  const short = plan.shots[0]!;
  const long = plan.shots[1]!;
  const reading = long.reading!;
  const tail = long.from + reading.from + reading.durationFrames - reading.tailHoldFrames;
  await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
  await page.goto("/video.html");
  const viewport = page.locator("[data-reading-viewport]");
  const card = page.locator('[data-surface="speech"]');
  const stage = await page.locator("[data-video-stage]").boundingBox();
  const pendingHandles = () =>
    page.evaluate(
      () =>
        (window as unknown as { remotion_delayRenderHandles?: number[] })
          .remotion_delayRenderHandles?.length ?? 0,
    );
  let shortHeight = 0;
  // 相邻镜头沿用SpeechScene／ReadingViewport组件；往返真实seq，不靠刷新或重挂载清空量高状态。
  for (const pass of [0, 1]) {
    await seek(page, short.from);
    await expect(viewport).toHaveAttribute("data-reading-ready", "true");
    await expect(viewport.locator("[data-reading-content]")).toHaveText(ordinary);
    await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "1");
    await expect(viewport).toHaveAttribute("data-reading-overflow", "0");
    await expect(viewport).toHaveAttribute("data-reading-offset", "0");
    const height = (await card.boundingBox())!.height;
    expect(height).toBeLessThan(stage!.height * 0.6);
    if (pass === 0) shortHeight = height;
    else expect(height).toBeCloseTo(shortHeight, 1);
    await expect.poll(pendingHandles).toBe(0);

    await seek(page, long.from);
    await expect(viewport).toHaveAttribute("data-reading-ready", "true");
    await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
    await expect(page.getByTestId("composition-event")).toHaveAttribute("data-event-seq", "2");
    await expect
      .poll(async () => Number(await viewport.getAttribute("data-reading-overflow")))
      .toBeGreaterThan(100);
    expect((await card.boundingBox())!.height).toBeGreaterThan(stage!.height * 0.85);
    await seek(page, tail);
    const overflow = Number(await viewport.getAttribute("data-reading-overflow"));
    const offset = await pixelAlignedOffset(viewport);
    const pixelScale = Number(await viewport.getAttribute("data-reading-pixel-scale"));
    expect(offset).toBeGreaterThanOrEqual(overflow);
    expect(offset).toBeLessThanOrEqual(overflow + 1 / pixelScale);
    await expectVisibleLastLine(viewport);
    await expect(viewport.locator("[data-reading-content]")).toHaveText(body);
    await expect.poll(pendingHandles).toBe(0);
  }
});

function ballotAcceptance() {
  const author = "独立编导版式验收，非真实对局。保留所有逐票、原始权重与本段完整说明。".repeat(24);
  const longName = "独立长名验收".repeat(40);
  const result = `1号·${longName}被放逐出局`;
  const replay = readingReplay("", "zh-CN", 12);
  replay.players[0]!.name = longName;
  const votes = Array.from({ length: 12 }, (_, index) => ({
    actorId: index + 1,
    targetId: index + 1,
    abstain: false,
    weight: index === 0 ? 1.5 : 1,
  }));
  replay.events = [
    {
      seq: 1,
      day: 1,
      phase: "voting",
      timestamp: "2026-10-17T00:00:00Z",
      type: "vote_summary",
      payload: {
        round: 1,
        votes,
        tally: Object.fromEntries(votes.map((vote) => [vote.targetId, vote.weight])),
        target: 1,
      },
    },
    {
      seq: 2,
      day: 1,
      phase: "voting",
      timestamp: "2026-10-17T00:00:01Z",
      type: "voted_out",
      payload: { target: 1 },
    },
  ];
  return { replay, author, result };
}

test("a long authored ballot keeps its complete explanation and all twelve weighted targets inside safe slots", async ({
  page,
}) => {
  const { replay, author } = ballotAcceptance();
  const plan = compileVideoPlan(
    replay,
    {
      source: getVideoSourceIdentity(replay),
      layout: "broadcast-v1",
      edits: [{ anchor: { seq: 1, type: "vote_summary" }, caption: author }],
    },
    { locale: "zh-CN", timeZone: "UTC" },
  );
  const shot = plan.shots[0]!;
  await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
  await page.goto("/video.html");
  await seek(page, shot.from + shot.scene.cues.impact);
  const card = page.locator('[data-surface="ballot"]');
  await expect(page.locator("[data-scene-ballot]")).toHaveCount(1);
  const prose = card.locator("[data-reading-viewport]:has([data-scene-announcement])");
  await expect(prose).toHaveAttribute("data-reading-ready", "true");
  await expect(prose.locator("[data-reading-content]")).toHaveText(author);
  await expect(card.locator("[data-ballot-target]")).toHaveCount(12);
  await expect(card.locator('[data-ballot-target="1"]')).toContainText("1.5 票");
  await expect(card.locator('[data-ballot-target="1"]')).toContainText("×1.5");
  const bounds = await card.boundingBox();
  const stage = await page.locator("[data-video-stage]").boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height * 0.15);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(stage!.y + stage!.height * 0.98);
  const reading = shot.reading!;
  const overflow = Number(await prose.getAttribute("data-reading-overflow"));
  expect(overflow).toBeGreaterThan(0);
  await seek(page, shot.from + reading.from + reading.durationFrames - reading.tailHoldFrames);
  await expect(prose).toHaveAttribute("data-reading-offset", String(overflow));
  const last = await prose.locator("[data-reading-content] > span").last().boundingBox();
  const proseBounds = await prose.boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(proseBounds!.y + proseBounds!.height + 1);
  await expect(card.locator("[data-ballot-target]")).toHaveCount(12);
  // 作者锚点本来就切断自动合段；这份说明不能提前展示下一独立放逐镜头的生命状态。
  await expect(page.locator('[data-composition-player="1"]')).toHaveAttribute(
    "data-player-alive",
    "true",
  );
  await seek(page, shot.from + shot.scene.cues.impact);
  await expect(prose).toHaveAttribute("data-reading-offset", "0");
});

test("a merged ballot gives a complete long result its own reading clock at the actual reveal frame", async ({
  page,
}) => {
  const { replay, result } = ballotAcceptance();
  // 无作者屏障的真实合段分支单独验收，不为拼接测试而改编译计划或跳过脚本边界。
  const plan = compileVideoPlan(replay, undefined, { locale: "zh-CN", timeZone: "UTC" });
  const shot = plan.shots[0]!;
  const resolution = shot.scene.resolution!;
  await page.route("**/api/video/plan", (route) => route.fulfill({ json: plan }));
  await page.goto("/video.html");
  await seek(page, shot.from + shot.scene.cues.impact);
  const card = page.locator('[data-surface="ballot"]');
  await expect(page.locator("[data-scene-ballot]")).toHaveCount(1);
  await expect(card.locator("[data-ballot-target]")).toHaveCount(12);
  await seek(page, shot.from + resolution.revealFrame - 1);
  await expect(card.locator("[data-scene-resolution]")).toHaveCount(0);
  await expect(page.locator('[data-composition-player="1"]')).toHaveAttribute(
    "data-player-alive",
    "true",
  );
  await seek(page, shot.from + resolution.revealFrame);
  const resultWindow = card.locator("[data-reading-viewport]:has([data-scene-resolution])");
  await expect(resultWindow).toHaveAttribute("data-reading-ready", "true");
  await expect(resultWindow.locator("[data-reading-content]")).toHaveText(result);
  await expect(resultWindow).toHaveAttribute("data-reading-offset", "0");
  await expect(page.locator('[data-composition-player="1"]')).toHaveAttribute(
    "data-player-alive",
    "false",
  );
  const reading = resolution.reading!;
  await seek(page, shot.from + reading.from + reading.durationFrames - reading.tailHoldFrames);
  const overflow = Number(await resultWindow.getAttribute("data-reading-overflow"));
  expect(overflow).toBeGreaterThan(0);
  await expect(resultWindow).toHaveAttribute("data-reading-offset", String(overflow));
  const last = await resultWindow.locator("[data-reading-content] > span").last().boundingBox();
  const resultBounds = await resultWindow.boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(resultBounds!.y + resultBounds!.height + 1);
  await seek(page, shot.from + resolution.revealFrame);
  await expect(resultWindow).toHaveAttribute("data-reading-offset", "0");
  await expect(card.locator("[data-ballot-target]")).toHaveCount(12);
});
