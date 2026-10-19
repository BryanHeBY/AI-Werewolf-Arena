/**
 * 单元测试负责核对警长票型与紧邻正式计票的两阶段连接，以及各票型未知数值的展示边界。
 * 输入为独立手写事件、导演屏障和事实前缀，输出逐帧来源、原始票数与可见DOM断言；不调用规则或从逐票计算预期。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame, getVideoEventFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { VideoFrame } from "../../../src/video/VideoComposition";
import { SceneContentBlocks } from "../../../src/presentation/SceneContentBlocks";
import { sceneContent } from "../../../src/presentation/scene-content";
import type { VideoScript } from "../../../src/video/types";

function election(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "sheriff-ballot",
    meta: { board: "test", startedAt: "start", endedAt: "end", locale: "zh-CN" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, index) => ({
      player_id: index + 1,
      role: index === 0 ? "wolf" : "villager",
      camp: index === 0 ? "wolf" : "good",
    })),
    events: [
      {
        seq: 1,
        timestamp: "2026-10-19T00:00:00Z",
        day: 1,
        phase: "day",
        stage: "sheriff_vote_summary",
        type: "sheriff_vote_summary",
        payload: {
          votes: [2, 4, 5, 6, 7, 8, 10, 12].map((actorId, index) => ({
            actorId,
            targetId: index < 5 ? 11 : 1,
            abstain: false,
          })),
          winnerId: 11,
        },
      },
      {
        seq: 2,
        timestamp: "2026-10-19T00:00:01Z",
        day: 1,
        phase: "day",
        stage: "sheriff",
        type: "sheriff_elected",
        payload: { winnerId: 11, candidates: [1, 3, 9, 11], tally: { 1: 3, 3: 0, 9: 0, 11: 5 } },
      },
    ],
  };
}
function compile(document: ReplayDocument, options: Omit<VideoScript, "source"> = {}) {
  return compileVideoPlan(document, {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1",
    ...options,
  });
}

test("adjacent official sheriff tally reveals only at its own source frame and keeps recorded zero candidates", () => {
  const document = election();
  const original = JSON.stringify(document);
  const plan = compile(document);
  expect(plan.shots).toHaveLength(1);
  const shot = plan.shots[0]!;
  const resolution = shot.scene.resolution!;
  expect(shot.sourceSeqs).toEqual([1, 2]);
  expect(shot.sourceFacts).toEqual([]);
  expect(shot.scene.ballot?.tally).toBeNull();
  expect(resolution.ballot?.tally).toEqual({ 1: 3, 3: 0, 9: 0, 11: 5 });
  expect(resolution.targetId).toBe(11);
  expect(resolution.revealFrame).toBeGreaterThan(40);
  expect(buildVideoFrame(plan, 23).sourceSeq).toBe(0);
  expect(buildVideoFrame(plan, 24).sourceSeq).toBe(1);
  const before = buildVideoFrame(plan, resolution.revealFrame - 1);
  const after = buildVideoFrame(plan, resolution.revealFrame);
  expect(before.sourceSeq).toBe(1);
  expect(before.scene.ballot?.tally).toBeNull();
  expect(after.sourceSeq).toBe(2);
  expect(after.scene.ballot?.tally).toEqual({ 1: 3, 3: 0, 9: 0, 11: 5 });
  expect(after.scene.content?.blocks.find((block) => block.kind === "ballot")).toMatchObject({
    ballot: { tally: { 1: 3, 3: 0, 9: 0, 11: 5 } },
  });
  expect(before.scene.content?.blocks.find((block) => block.kind === "ballot")).toMatchObject({
    ballot: { tally: null },
  });
  expect(getVideoEventFrame(plan, 1)).toBe(24);
  expect(getVideoEventFrame(plan, 2)).toBe(resolution.revealFrame);
  expect(after.currentView.players.every((player) => player.alive)).toBe(true);
  expect(buildVideoFrame(plan, resolution.revealFrame - 1).scene.ballot?.tally).toBeNull();
  expect(JSON.stringify(document)).toBe(original);
  expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  const beforeHtml = renderToStaticMarkup(
    <VideoFrame plan={plan} frame={resolution.revealFrame - 1} />,
  );
  expect(beforeHtml).not.toContain("data-ballot-count");
  expect(beforeHtml).not.toContain("—");
  const afterHtml = renderToStaticMarkup(<VideoFrame plan={plan} frame={resolution.revealFrame} />);
  for (const id of [1, 3, 9, 11]) expect(afterHtml).toContain(`data-ballot-count="${id}"`);
  expect(afterHtml).toContain("5 票");
  expect(afterHtml).toContain("3 票");
  expect(afterHtml.match(/>0 票</g)).toHaveLength(2);
  expect(afterHtml).not.toContain("—");
});

test("unknown stages, round or winner mismatch and malformed official tally cannot be linked", () => {
  const changes: Array<(document: ReplayDocument) => void> = [
    (d) => {
      d.events[1]!.day = 2;
    },
    (d) => {
      d.events[1]!.phase = "night";
    },
    (d) => {
      d.events[1]!.stage = "sheriff_pk_vote";
    },
    (d) => {
      d.events[0]!.stage = "unknown";
      d.events[1]!.stage = "unknown";
    },
    (d) => {
      d.events[0]!.payload.round = 1;
      d.events[1]!.payload.round = 2;
    },
    (d) => {
      d.events[1]!.payload.winnerId = 1;
    },
    (d) => {
      d.events[1]!.payload.tally = { 11: -1 };
    },
    (d) => {
      d.events[1]!.payload.tally = { 99: 5 };
    },
    (d) => {
      d.events[1]!.payload.tally = { 11: "5" };
    },
    (d) => {
      delete d.events[1]!.payload.tally;
    },
  ];
  for (const change of changes) {
    const document = election();
    change(document);
    const plan = compile(document);
    expect(plan.shots[0]!.sourceSeqs).toEqual([1]);
    expect(plan.shots[0]!.scene.ballot?.tally).toBeNull();
    expect(plan.shots[0]!.scene.resolution).toBeUndefined();
  }
});

test("edits, skip, hold and fact prefixes keep sheriff records separate without borrowing future counts", () => {
  const options: Omit<VideoScript, "source">[] = [
    { edits: [{ anchor: { seq: 1, type: "sheriff_vote_summary" }, caption: "作者说明" }] },
    { edits: [{ anchor: { seq: 2, type: "sheriff_elected" }, durationFrames: 90 }] },
    { edits: [{ anchor: { seq: 2, type: "sheriff_elected" }, skip: true }] },
    {
      holds: [{ id: "pause", after: { seq: 1, type: "sheriff_vote_summary" }, durationFrames: 12 }],
    },
  ];
  for (const option of options) {
    const plan = compile(election(), option);
    const summary = plan.shots.find((shot) => shot.eventSeq === 1)!;
    expect(summary.sourceSeqs).toEqual([1]);
    expect(summary.scene.resolution).toBeUndefined();
    expect(summary.scene.ballot?.tally).toBeNull();
  }
  const document = election();
  document.factCoverage = { committedDeaths: 1 };
  document.facts = [
    {
      seq: 1,
      afterSeq: 1,
      day: 1,
      kind: "life_committed",
      playerId: 12,
      alive: false,
      causes: ["recorded"],
    },
  ];
  const plan = compile(document);
  expect(plan.shots[0]!.sourceSeqs).toEqual([1]);
  expect(plan.shots[0]!.scene.resolution).toBeUndefined();
  expect(plan.shots[1]!.sourceFacts).toEqual([1]);
  expect(buildVideoFrame(plan, plan.shots[1]!.from + 23).currentView.players[11]!.alive).toBe(true);
  expect(buildVideoFrame(plan, plan.shots[1]!.from + 24).currentView.players[11]!.alive).toBe(
    false,
  );
  const partial = election();
  partial.events.pop();
  expect(compile(partial).shots[0]!.scene.ballot?.tally).toBeNull();
  const legacy = compile(election(), { layout: "legacy-ellipse-v1" });
  expect(legacy.shots.map((shot) => shot.sourceSeqs)).toEqual([[1], [2]]);
});

test("PK rounds remain separate and only their adjacent final official record supplies tally", () => {
  const document = election();
  document.events[0]!.payload.round = 2;
  const first = {
    ...document.events[0]!,
    payload: { ...document.events[0]!.payload, winnerId: null, round: 1 },
  };
  const pk = {
    ...document.events[0]!,
    type: "sheriff_pk_started",
    payload: { candidates: [1, 11] },
  };
  document.events = [first, pk, ...document.events].map((event, index) => ({
    ...event,
    seq: index + 1,
  }));
  const plan = compile(document);
  expect(plan.shots.map((shot) => shot.sourceSeqs)).toEqual([[1], [2], [3, 4]]);
  expect(plan.shots[0]!.scene.ballot?.tally).toBeNull();
  expect(plan.shots[2]!.scene.resolution?.ballot?.round).toBe(2);
  expect(plan.shots[2]!.scene.resolution?.ballot?.tally).toEqual({ 1: 3, 3: 0, 9: 0, 11: 5 });
});

test("all ballot kinds omit unknown totals and weights while explicit fractional values remain", () => {
  for (const type of ["sheriff_vote_summary", "vote_summary"] as const) {
    const document = election();
    document.events = [
      {
        ...document.events[0]!,
        type,
        payload: {
          votes: [{ actorId: 2, targetId: 3, abstain: false }],
          ...(type === "sheriff_vote_summary" ? { winnerId: 3 } : { target: 3 }),
        },
      },
    ];
    const shot = compile(document).shots[0]!;
    const html = renderToStaticMarkup(<VideoFrame plan={compile(document)} frame={24} />);
    expect(html).not.toContain("data-ballot-count");
    expect(html).not.toContain("—");
    expect(html).not.toContain("0票");
    const structured = renderToStaticMarkup(
      <SceneContentBlocks content={sceneContent(shot.scene)} locale="zh-CN" />,
    );
    expect(structured).toContain('data-ballot-actor="2"');
    expect(structured).not.toContain("—");
    document.events[0]!.payload.votes = [{ actorId: 2, targetId: 3, abstain: false, weight: 1.5 }];
    const weighted = compile(document).shots[0]!;
    expect(
      renderToStaticMarkup(
        <SceneContentBlocks content={sceneContent(weighted.scene)} locale="zh-CN" />,
      ),
    ).toContain("1.5");
  }
});
