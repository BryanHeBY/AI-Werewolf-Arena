/**
 * 单元组件测试负责验证广播渲染的事实揭晓、匿名资料、完整票型与主题扩展。输入为独立手写回放和显式帧，输出原文及状态标记的字面断言。
 * 不以像素颜色代替生命事实，不从渲染结果生成预期，不调用浏览器、模型或游戏规则。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { VideoFrame } from "../../../src/video/VideoComposition";
import { compileVideoPlan } from "../../../src/video/compiler";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { buildVideoFrame } from "../../../src/video/frame";
import type { VideoScript } from "../../../src/video/types";
import type { VideoThemeSlotRegistry } from "../../../src/video/theme-renderers";

// 检查真实渲染文本而非HTML字串连续性；词法保护span不能掩盖丢字或署名错误。
function renderedText(markup: string) {
  return markup
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function replay(events: Array<Pick<ReplayEvent, "type" | "payload">>): ReplayDocument {
  return {
    schemaVersion: 2,
    sessionId: "renderer",
    perspective: "god",
    meta: { board: "renderer", locale: "zh-CN", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, i) => ({
      player_id: i + 1,
      name: `Original ${i + 1}`,
      model: `Model ${i + 1}`,
      role: i === 0 ? "wolf" : "villager",
      camp: i === 0 ? "wolf" : "good",
    })),
    events: events.map((event, i) => ({
      seq: i + 1,
      timestamp: "2026-10-17T00:00:00Z",
      day: 1,
      phase: "day",
      ...event,
    })),
  };
}
function plan(document: ReplayDocument, options: Omit<VideoScript, "source"> = {}) {
  return compileVideoPlan(document, {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1",
    ...options,
  });
}
test("anonymous profiles omit system names and models while raw speech and explicit emphasis remain", () => {
  const document = replay([
    { type: "day_speech", payload: { actorId: 2, text: "我声称1号是狼人。" } },
  ]);
  const video = plan(document, {
    presentation: { anonymous: true },
    edits: [{ anchor: { seq: 1, type: "day_speech" }, emphasis: [{ text: "我声称" }] }],
  });
  const html = renderToStaticMarkup(<VideoFrame plan={video} frame={0} />);
  expect(html).not.toContain("Original");
  expect(html).not.toContain("Model");
  expect(renderedText(html)).toContain("我声称");
  expect(renderedText(html)).toContain("1号是狼人。");
  expect(html).toContain("<mark");
  expect(video.shots[0]!.scene.targetIds).toEqual([]);
  expect(buildVideoFrame(video, 0).currentView.players[0]!.alive).toBe(true);
});
test("all twelve recorded targets and voter sources remain represented in a dense ballot grid", () => {
  const votes = Array.from({ length: 12 }, (_, i) => ({
    actorId: i + 1,
    targetId: i + 1,
    weight: 1,
    abstain: false,
  }));
  const document = replay([
    {
      type: "vote_summary",
      payload: {
        votes,
        tally: Object.fromEntries(votes.map((v) => [v.targetId, 1])),
        target: null,
        round: 1,
      },
    },
  ]);
  const video = plan(document);
  expect(renderToStaticMarkup(<VideoFrame plan={video} frame={0} />)).not.toContain(
    "data-ballot-target",
  );
  const html = renderToStaticMarkup(<VideoFrame plan={video} frame={24} />);
  for (let id = 1; id <= 12; id++) expect(html).toContain(`data-ballot-target="${id}"`);
  expect(html).toContain("grid-template-columns:minmax(0,1fr) minmax(0,1fr)");
  expect(html.match(/data-player-alive="true"/g)).toHaveLength(12);
});
test("a winner-only archived sheriff summary shows the recorded result without inventing zero votes", () => {
  const document = replay([
    { type: "sheriff_vote_summary", payload: { votes: [], winnerId: 6, round: 1 } },
  ]);
  const video = plan(document);
  const html = renderToStaticMarkup(<VideoFrame plan={video} frame={24} />);
  expect(html).toContain('data-ballot-target="6"');
  expect(html).toContain("未记录逐票明细");
  expect(html).toContain("结果 · 6号");
  expect(html).not.toContain("—");
  expect(html).not.toContain("0票");
  expect(html.match(/data-player-alive="true"/g)).toHaveLength(12);
});
test("repeated subtitle pages highlight only the exact occurrence selected by the script", () => {
  const document = replay([
    { type: "day_speech", payload: { actorId: 2, text: "甲".repeat(250) } },
  ]);
  const video = plan(document, {
    // 显式旧分页预算让重复页保持108字/90帧，独立核对第120个字不会误标第一屏。
    captionPageFrames: 90,
    edits: [
      { anchor: { seq: 1, type: "day_speech" }, emphasis: [{ text: "甲", occurrence: 120 }] },
    ],
  });
  const shot = video.shots[0]!;
  const secondPage = 90;
  expect(shot.captionPages[0]).toBe("甲".repeat(108));
  expect(renderToStaticMarkup(<VideoFrame plan={video} frame={0} />)).not.toContain("<mark");
  expect(renderToStaticMarkup(<VideoFrame plan={video} frame={secondPage} />)).toContain("<mark");
});
test("theme slots receive current state and identical prepared asset base without serializing components", () => {
  const document = replay([{ type: "day_speech", payload: { actorId: 2, text: "Words." } }]);
  const video = plan(document);
  const slots: VideoThemeSlotRegistry = {
    "gothic-v1/frame": ({ mediaBaseUrl, view }) => (
      <span data-custom-base={mediaBaseUrl} data-custom-source={view.sourceSeq}>
        CUSTOM SLOT
      </span>
    ),
  };
  const html = renderToStaticMarkup(
    <VideoFrame plan={video} frame={0} themeSlots={slots} mediaBaseUrl="/api/video/" />,
  );
  expect(html).toContain('data-custom-base="/api/video/"');
  expect(html).toContain("CUSTOM SLOT");
  expect(JSON.parse(JSON.stringify(video))).toEqual(video);
  expect(JSON.stringify(video)).not.toContain("CUSTOM SLOT");
});
test("theme-specific options affect the default renderer and explicit camera focus keeps all HUD seats", () => {
  const document = replay([{ type: "day_speech", payload: { actorId: 2, text: "Words." } }]);
  const video = plan(document, {
    theme: { id: "gothic-v1", options: { ornamentalFrames: true, paperTexture: true } },
    edits: [
      {
        anchor: { seq: 1, type: "day_speech" },
        camera: [{ frame: 0, target: { playerIds: [12] }, zoom: 1.5 }],
      },
    ],
  });
  const html = renderToStaticMarkup(<VideoFrame plan={video} frame={0} />);
  expect(html).toContain("data-theme-ornamental-frame");
  expect(html).toContain("repeating-linear-gradient");
  expect(html).toContain('data-video-focus="12"');
  expect(html.match(/data-composition-player=/g)).toHaveLength(12);
});
test("minimal daytime speaker focus uses the dark semantic accent on its white card", () => {
  const document = replay([{ type: "day_speech", payload: { actorId: 2, text: "Words." } }]);
  const video = plan(document, { theme: { id: "minimal-v1" } });
  const html = renderToStaticMarkup(<VideoFrame plan={video} frame={0} />);
  const actorCard = html.match(/<div data-composition-player="2"[^>]*>/)?.[0];
  expect(actorCard).toContain("border:5px solid #274f85");
  expect(actorCard).not.toContain("#d9e4f0");
});

test("authored ballot and inventory text remains visible with precise emphasis and unchanged facts", () => {
  const document = replay([
    {
      type: "vote_summary",
      payload: {
        votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 1 }],
        tally: { 2: 1 },
        target: 2,
      },
    },
  ]);
  const ballot = plan(document, {
    edits: [
      {
        anchor: { seq: 1, type: "vote_summary" },
        caption: "EDITORIAL BALLOT",
        emphasis: [{ text: "EDITORIAL" }],
      },
    ],
  });
  const ballotHtml = renderToStaticMarkup(<VideoFrame plan={ballot} frame={24} />);
  expect(ballotHtml).toContain("data-scene-editorial");
  expect(ballotHtml).toContain("EDITORIAL");
  expect(renderedText(ballotHtml)).toContain("EDITORIAL BALLOT");
  expect(ballotHtml).toContain("<mark");
  expect(ballotHtml).toContain('data-ballot-target="2"');
  const stockDocument = replay([]);
  stockDocument.factCoverage = { committedDeaths: 1 };
  stockDocument.facts = [
    {
      seq: 1,
      afterSeq: 0,
      day: 1,
      kind: "potion_stock",
      actorId: 2,
      abilityId: "potion-2",
      heal: 0,
      poison: 1,
    },
  ];
  const inventory = plan(stockDocument, {
    factEdits: [
      {
        anchor: { seq: 1, kind: "potion_stock" },
        caption: "EDITORIAL STOCK",
        emphasis: [{ text: "STOCK" }],
      },
    ],
  });
  const stockHtml = renderToStaticMarkup(<VideoFrame plan={inventory} frame={24} />);
  expect(renderedText(stockHtml)).toContain("EDITORIAL ");
  expect(stockHtml).toContain("STOCK");
  expect(stockHtml).toContain("<mark");
  expect(inventory.shots[0]!.scene.stock).toEqual({
    actorId: 2,
    abilityId: "potion-2",
    heal: 0,
    poison: 1,
  });
});

test("emphasis alone can annotate original ballot and stock prose without replacing the caption", () => {
  const document = replay([
    {
      type: "vote_summary",
      payload: {
        votes: [{ actorId: 1, targetId: 2, abstain: false, weight: 1 }],
        tally: { 2: 1 },
        target: 2,
      },
    },
  ]);
  const ballot = plan(document, {
    edits: [{ anchor: { seq: 1, type: "vote_summary" }, emphasis: [{ text: "本轮票型" }] }],
  });
  const ballotHtml = renderToStaticMarkup(<VideoFrame plan={ballot} frame={24} />);
  expect(ballot.shots[0]!.scene.bodySource).toBe("event");
  expect(ballotHtml).toContain("data-scene-editorial");
  expect(ballotHtml).toContain("<mark");
  expect(ballotHtml).toContain('data-ballot-target="2"');

  const stockDocument = replay([]);
  stockDocument.factCoverage = { committedDeaths: 1 };
  stockDocument.facts = [
    {
      seq: 1,
      afterSeq: 0,
      day: 1,
      kind: "potion_stock",
      actorId: 2,
      abilityId: "potion-2",
      heal: 0,
      poison: 1,
    },
  ];
  const inventory = plan(stockDocument, {
    factEdits: [{ anchor: { seq: 1, kind: "potion_stock" }, emphasis: [{ text: "解药" }] }],
  });
  const stockHtml = renderToStaticMarkup(<VideoFrame plan={inventory} frame={24} />);
  expect(inventory.shots[0]!.scene.bodySource).toBe("event");
  expect(stockHtml).toContain("<mark");
  expect(renderedText(stockHtml)).toContain("解药");
  expect(renderedText(stockHtml)).toContain("毒药 1");
});

test("inspection prose uses only its caption page and authored replacement does not append the original report", () => {
  const document = replay([
    { type: "seer_checked", payload: { actorId: 2, targetId: 1, result: "wolf" } },
  ]);
  document.players[1]!.name = "Long source player name ".repeat(30);
  const video = plan(document, { captionPageFrames: 90 });
  const shot = video.shots[0]!;
  expect(shot.captionPages.length).toBeGreaterThan(1);
  const html = renderToStaticMarkup(<VideoFrame plan={video} frame={24} />);
  // 查验原报告必须服从同一分页；不能再把完整结果塞入第二个文本区域。
  expect(html).not.toContain(shot.scene.action!.result!);
  expect(html).toContain(buildVideoFrame(video, 24).caption);
  const authored = plan(document, {
    edits: [
      { anchor: { seq: 1, type: "seer_checked" }, caption: "Edited inspection announcement" },
    ],
  });
  const authoredHtml = renderToStaticMarkup(<VideoFrame plan={authored} frame={24} />);
  expect(renderedText(authoredHtml)).toContain("Edited inspection announcement");
  expect(authoredHtml).not.toContain(shot.scene.action!.result!);
  expect(authored.shots[0]!.scene.action!.result).toBe(shot.scene.action!.result);
});

test("hidden or absent metadata removes its entire roster slot while a mixed column keeps only real labels", () => {
  const document = replay([{ type: "day_speech", payload: { actorId: 2, text: "Words." } }]);
  const hidden = plan(document, { presentation: { showNames: false, showModels: false } });
  const hiddenHtml = renderToStaticMarkup(<VideoFrame plan={hidden} frame={0} />);
  expect(hiddenHtml).not.toContain("data-player-metadata");
  expect(buildVideoFrame(hidden, 0).layout.rosterColumns.left.width).toBe(240);
  expect(buildVideoFrame(hidden, 0).layout.rosterColumns.right.width).toBe(240);
  for (const player of document.players) {
    delete player.name;
    delete player.model;
  }
  document.players[0]!.model = "Only visible model";
  const mixed = plan(document);
  const mixedHtml = renderToStaticMarkup(<VideoFrame plan={mixed} frame={0} />);
  expect(mixedHtml.match(/data-player-metadata/g)).toHaveLength(1);
  expect(mixedHtml).toContain("Only visible model");
  expect(buildVideoFrame(mixed, 0).layout.rosterColumns.left.hasMetadata).toBe(true);
  expect(buildVideoFrame(mixed, 0).layout.rosterColumns.right.hasMetadata).toBe(false);
});

test("daytime gothic card slots receive the dark roster palette while the reading frame retains day ink", () => {
  const document = replay([{ type: "day_speech", payload: { actorId: 2, text: "Words." } }]);
  const slots: VideoThemeSlotRegistry = {
    "gothic-v1/playerCard": ({ palette }) => <span data-roster-ink={palette.text} />,
    "gothic-v1/frame": ({ palette }) => <span data-reading-ink={palette.text} />,
  };
  const html = renderToStaticMarkup(
    <VideoFrame plan={plan(document)} frame={0} themeSlots={slots} />,
  );
  expect(html).toContain('data-roster-ink="#e4e9ed"');
  expect(html).toContain('data-reading-ink="#242a31"');
});
