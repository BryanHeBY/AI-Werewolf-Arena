/**
 * 单元组件测试负责全文换行保护、显式强调和纯帧位移边界。输入为独立字面原话与保护名单，输出原字符／UTF16区间及固定数值。
 * 不从生产分词或计划重算预期，不模拟规则或字体尺寸；真实字体ready、量高和可视首末行由定向浏览器测试验证。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SceneText, CaptionCounter } from "../../../src/video/render/broadcast/SceneText";
import { readingTextRuns } from "../../../src/video/render/broadcast/reading-text";
import { readingOffset } from "../../../src/video/render/broadcast/ReadingViewport";
import type { SceneCaption } from "../../../src/video/render/broadcast/contracts";
import { BallotScene } from "../../../src/video/render/broadcast/BallotScene";
import { resolveTheme, themePalette, themeSurface } from "../../../src/themes";
import type { VideoScene } from "../../../src/video/types";

const flow = (value: string): SceneCaption => ({
  text: value,
  offset: 0,
  pageIndex: 0,
  pages: [value],
  scheduled: false,
  reading: { active: true, progress: 0, scrollProgress: 0 },
});

test("role names, announced victory phrases, seats and model tokens are whole without adding or removing characters", () => {
  const body = "（白痴）与禁言长老讨论狼人达半，12号使用Claude-Opus-4.6，Player 7回复。";
  const runs = readingTextRuns(body);
  expect(runs.map((run) => run.text).join("")).toBe(body);
  for (const phrase of [
    "（白痴）",
    "禁言长老",
    "狼人达半，",
    "12号",
    "Claude-Opus-4.6，",
    "Player 7",
  ])
    expect(runs.some((run) => run.keep && run.text === phrase)).toBe(true);
  for (const run of runs) expect(body.slice(run.start, run.end)).toBe(run.text);
});
test("graphemes and explicit names survive typography with original UTF16 offsets", () => {
  const body = "A👩🏽‍💻e\u0301与匿名甲讨论，超长模型名称不强制成不换行块。";
  const runs = readingTextRuns(body, ["匿名甲", "x".repeat(80)]);
  expect(runs.map((run) => run.text).join("")).toBe(body);
  expect(runs.find((run) => run.text === "👩🏽‍💻")).toMatchObject({ start: 1, end: 8 });
  expect(runs.some((run) => run.text === "e\u0301" && run.keep)).toBe(true);
  expect(runs.some((run) => run.text === "匿名甲" && run.keep)).toBe(true);
  expect(readingTextRuns("x".repeat(80)).every((run) => !run.keep)).toBe(true);
});
test("punctuation never turns a long model or URL back into an unbreakable word", () => {
  for (const body of [
    "（" + "a".repeat(100) + "）",
    "https://example.test/" + "model".repeat(30) + "！",
  ]) {
    const runs = readingTextRuns(body);
    expect(runs.map((run) => run.text).join("")).toBe(body);
    expect(runs.filter((run) => run.keep).every((run) => [...run.text].length <= 16)).toBe(true);
    expect(runs.length).toBeGreaterThan(80);
  }
});
test("flow word protection preserves only the selected repeated emphasis and never adds a target claim", () => {
  const body = "我声称白痴与12号相关，白痴仍是我的原话。";
  const selected = body.lastIndexOf("白痴");
  const html = renderToStaticMarkup(
    <SceneText
      caption={flow(body)}
      emphasis={[{ text: "白痴", start: selected, end: selected + 2 }]}
      accent="#123456"
    />,
  );
  expect(html.replace(/<[^>]*>/g, "")).toBe(body);
  expect(html.match(/<mark /g)).toHaveLength(1);
  expect(html).toContain('color:#123456;font-weight:700">白痴</mark>');
  expect(html).not.toContain("data-target");
});
test("only explicit multi-page captions have a page counter", () => {
  expect(renderToStaticMarkup(<CaptionCounter caption={flow("原话")} locale="zh-CN" />)).toBe("");
  const legacy: SceneCaption = {
    text: "后半",
    offset: 2,
    pageIndex: 1,
    pages: ["前半", "后半"],
    scheduled: false,
  };
  expect(renderToStaticMarkup(<CaptionCounter caption={legacy} locale="en" />)).toBe("2 / 2");
});
test("reading displacement is a pure clamped function that returns the same value after reverse seek", () => {
  expect([0, 0.25, 0.5, 1, 0.25].map((progress) => readingOffset(400, progress))).toEqual([
    0, 100, 200, 400, 100,
  ]);
  expect(readingOffset(0, 0.5)).toBe(0);
  expect(readingOffset(-10, 1)).toBe(0);
  expect(readingOffset(400, -1)).toBe(0);
  expect(readingOffset(400, 2)).toBe(400);
});
test("flow and archived ballot paths each expose exactly one semantic ballot owner", () => {
  const theme = resolveTheme("minimal-v1");
  const palette = themePalette(theme, "day");
  const scene: VideoScene = {
    kind: "ballot",
    title: "Ballot",
    body: "Recorded ballot",
    bodySource: "event",
    targetIds: [1],
    emphasis: [],
    cues: { establish: 0, travel: 8, impact: 24, settled: 40 },
    ballot: {
      kind: "exile",
      votes: [{ actorId: 2, targetId: 1, abstain: false, weight: 1.5 }],
      tally: { 1: 1.5 },
      targetId: 1,
      adjustments: [],
      complete: true,
    },
  };
  for (const reading of [true, false]) {
    const caption = flow("Recorded ballot");
    if (!reading) delete (caption as { reading?: unknown }).reading;
    const html = renderToStaticMarkup(
      <BallotScene
        scene={scene}
        caption={caption}
        localFrame={24}
        locale="en"
        players={[]}
        metrics={{
          scale: 1,
          stage: { x: 0, y: 0, width: 1280, height: 837 },
          readingWidth: 1224,
          bodySize: 30,
          lineHeight: 1.4,
          padding: 28,
        }}
        appearance={{
          theme,
          palette,
          cards: palette,
          surface: themeSurface(theme, "day"),
          gothic: false,
          night: false,
        }}
      />,
    );
    expect(html.match(/data-scene-ballot="true"/g)).toHaveLength(1);
    expect(html).toContain('data-ballot-target="1"');
    expect(html).toContain("1.5 votes");
    expect(html).toContain("×1.5");
  }
});
