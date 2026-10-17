/**
 * 单元测试负责核对观众场景、分组出处和逐帧提交时钟。输入是独立手写事件、原始加权票型和God提交事实，输出字面事实断言。
 * 本层不调用后端规则、不从实现生成预期；兼容旧脚本、匿名系统文字、跳剪回顾与未来语音元数据均按公开契约验证。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame, getVideoEventFrame, videoWorldToScreen } from "../../../src/video/frame";
import { createVideoLayout, resolveLayerPoint } from "../../../src/video/layout";
import { getVideoSourceIdentity } from "../../../src/video/source";
import type { VideoScript } from "../../../src/video/types";
import {
  buildReplaySnapshot,
  createReplaySnapshotIndex,
} from "../../../src/replay/replay-projection";

function replay(
  items: Array<Pick<ReplayEvent, "type" | "payload"> & Partial<Pick<ReplayEvent, "day" | "phase">>>,
): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "scenes",
    meta: { board: "test", startedAt: "start", endedAt: "end", locale: "zh-CN" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, i) => ({
      player_id: i + 1,
      name: `真实姓名${i + 1}`,
      role: i === 0 ? "wolf" : "villager",
      camp: i === 0 ? "wolf" : "good",
    })),
    events: items.map((item, index) => ({
      seq: index + 1,
      timestamp: "2026-01-01T00:00:00Z",
      day: 1,
      phase: "voting",
      ...item,
    })),
  };
}
function script(document: ReplayDocument, options: Omit<VideoScript, "source"> = {}): VideoScript {
  return { source: getVideoSourceIdentity(document), ...options };
}
const votes = [
  { actorId: 1, targetId: 3, weight: 1, abstain: false },
  { actorId: 2, targetId: 3, weight: 1.5, abstain: false },
  { actorId: 4, targetId: null, weight: 1, abstain: true },
];
function election(): ReplayDocument {
  return replay([
    { type: "phase_changed", payload: { phase: "voting" } },
    ...votes.map((payload) => ({ type: "vote_cast", payload })),
    { type: "crow_curse_applied", payload: { day: 1, targetId: 3, bonus: 1, round: 1 } },
    { type: "vote_summary", payload: { round: 1, votes, tally: { 3: 3.5 }, target: 3 } },
    { type: "voted_out", payload: { target: 3 } },
    { type: "phase_changed", phase: "night", day: 2, payload: { phase: "night", day: 2 } },
  ]);
}

test("broadcast merges only the recorded ballot window and preserves raw weighted tally and crow source", () => {
  const document = election();
  const plan = compileVideoPlan(document);
  expect([plan.layout, plan.width, plan.height, plan.theme.id]).toEqual([
    "broadcast-v1",
    1920,
    1080,
    "gothic-v1",
  ]);
  expect(plan.shots.map((shot) => shot.eventSeq)).toEqual([1, 6, 8]);
  const shot = plan.shots[1]!;
  expect(shot.sourceSeqs).toEqual([2, 3, 4, 5, 6, 7]);
  expect(shot.scene.kind).toBe("ballot");
  expect(shot.scene.ballot).toEqual({
    kind: "exile",
    round: 1,
    votes: [...votes.map((v) => ({ ...v }))],
    tally: { 3: 3.5 },
    targetId: 3,
    adjustments: [{ kind: "crow", targetId: 3, weight: 1, sourceSeq: 5 }],
    complete: true,
  });
  expect(plan.eventFrames["2"]).toEqual([
    { shotId: "event:6", frame: shot.from + 24, mode: "absorbed" },
  ]);
  expect(plan.eventFrames["6"]).toEqual([
    { shotId: "event:6", frame: shot.from + 24, mode: "primary" },
  ]);
  expect(getVideoEventFrame(plan, 2)).toBe(shot.from + 24);
  expect(buildVideoFrame(plan, shot.from + 23).sourceSeq).toBe(1);
  expect(buildVideoFrame(plan, shot.from + 24).sourceSeq).toBe(6);
  // summary与紧邻放逐同段，票型先揭晓；旧档voted_out的生命兼容效果到独立结果帧才提交。
  expect(shot.scene.resolution).toEqual({
    text: "3号·真实姓名3被放逐出局",
    targetId: 3,
    // 简短总述不代表票表信息已读完：原逐票/权重/姓名预算356帧，落定40后再独立揭示放逐。
    revealFrame: 396,
    reading: {
      version: 1,
      mode: "flow",
      from: 396,
      durationFrames: 90,
      headHoldFrames: 30,
      tailHoldFrames: 30,
    },
  });
  expect(buildVideoFrame(plan, shot.from + 395).resolutionReading?.active).toBe(false);
  expect(buildVideoFrame(plan, shot.from + 396).resolutionReading?.scrollProgress).toBe(0);
  expect(buildVideoFrame(plan, shot.from + 395).currentView.players[2]!.alive).toBe(true);
  expect(buildVideoFrame(plan, shot.from + 396).currentView.players[2]!.alive).toBe(false);
  expect(getVideoEventFrame(plan, 7)).toBe(shot.from + 396);
  expect(shot.speech.map((cue) => [cue.speaker, cue.from, cue.durationFrames])).toEqual([
    ["god", 24, 372],
    ["god", 396, shot.durationFrames - 396],
  ]);
  expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
});

test("a result-only sheriff summary admits missing ballots without inventing counts or discarding its winner", () => {
  const document = replay([
    { type: "sheriff_vote_summary", payload: { votes: [], winnerId: 6, round: 1 } },
  ]);
  document.players = document.players.map(({ name: _name, ...player }) => player);
  for (const [locale, body] of [
    ["zh-CN", "未记录逐票明细"],
    ["en", "Individual ballots not recorded"],
  ] as const) {
    const shot = compileVideoPlan(document, undefined, { locale, timeZone: "UTC" }).shots[0]!;
    expect(shot.scene.body).toBe(body);
    expect(shot.scene.ballot).toEqual({
      kind: "sheriff",
      round: 1,
      votes: [],
      tally: null,
      targetId: 6,
      adjustments: [],
      complete: true,
    });
    expect(shot.scene.targetIds).toEqual([6]);
    expect(shot.view.label).toBe(
      locale === "zh-CN"
        ? "警长票型：无；6号当选警长"
        : "Sheriff votes: None; Player 6 is elected sheriff",
    );
  }
  const authored = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [{ anchor: { seq: 1, type: "sheriff_vote_summary" }, caption: "作者结果说明" }],
    }),
  ).shots[0]!;
  expect(authored.scene.body).toBe("作者结果说明");
  expect(authored.scene.bodySource).toBe("script");
  expect(authored.scene.ballot?.targetId).toBe(6);
});

test("edits and holds split an internal window, while PK, sheriff and phase boundaries stay independent", () => {
  const document = election();
  document.events.push(
    ...[
      {
        type: "vote_summary",
        payload: { round: 2, votes: [votes[0]!], tally: { 3: 1 }, target: null },
      },
      { type: "sheriff_vote_cast", payload: { actorId: 1, targetId: 2, abstain: false } },
      {
        type: "sheriff_vote_summary",
        payload: { round: 1, votes: [{ actorId: 1, targetId: 2, abstain: false }], winnerId: 2 },
      },
    ].map((event, index) => ({
      ...event,
      seq: 9 + index,
      timestamp: "2026-01-01T00:00:00Z",
      day: 2,
      phase: "day",
    })),
  );
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [
        { anchor: { seq: 3, type: "vote_cast" }, durationFrames: 1, caption: "单独看警长票" },
      ],
      holds: [
        { id: "mid", after: { seq: 4, type: "vote_cast" }, durationFrames: 2, caption: "查看弃票" },
      ],
    }),
  );
  expect(plan.shots.find((shot) => shot.id === "event:3")!.durationFrames).toBe(1);
  expect(plan.shots.find((shot) => shot.id === "event:4")!.scene.ballot?.complete).toBe(false);
  expect(plan.shots.find((shot) => shot.id === "event:6")!.sourceSeqs).toEqual([5, 6, 7]);
  expect(plan.shots.find((shot) => shot.id === "hold:mid")!.durationFrames).toBe(2);
  expect(plan.shots.find((shot) => shot.id === "event:9")!.scene.ballot?.round).toBe(2);
  const sheriff = plan.shots.find((shot) => shot.id === "event:11")!;
  expect(sheriff.sourceSeqs).toEqual([10, 11]);
  expect(sheriff.scene.ballot?.kind).toBe("sheriff");
  expect(sheriff.scene.ballot?.tally).toBeNull();
  expect(sheriff.scene.ballot?.votes[0]?.weight).toBeNull();
});

test("God life coverage delays proposal deaths until exact independent fact and preserves skipped prefixes and recall", () => {
  const document = election();
  document.factCoverage = { committedDeaths: 1 };
  document.facts = [
    {
      seq: 1,
      afterSeq: 0,
      kind: "potion_stock",
      day: 1,
      actorId: 5,
      abilityId: "witch.potion",
      heal: 1,
      poison: 1,
    },
    {
      seq: 2,
      afterSeq: 7,
      kind: "life_committed",
      day: 1,
      playerId: 3,
      alive: false,
      causes: ["exile"],
    },
  ];
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [{ anchor: { seq: 6, type: "vote_summary" }, skip: true }],
      holds: [
        {
          id: "before",
          after: { seq: 8, type: "phase_changed" },
          stateAt: { seq: 6, type: "vote_summary" },
          durationFrames: 3,
        },
        { id: "after", after: { seq: 7, type: "voted_out" }, durationFrames: 3 },
      ],
    }),
  );
  // 初始库存仍在事实前缀中，但不再单独打断开局播报；life事实依然逐帧生效。
  expect(plan.shots[0]!.id).toBe("event:1");
  expect(plan.shots.some((shot) => shot.id === "fact:1")).toBe(false);
  expect(buildVideoFrame(plan, 24).sourceFactSeq).toBe(1);
  expect(buildVideoFrame(plan, 24).currentView.snapshot.day).toBe(1);
  const proposal = plan.shots.find((shot) => shot.id === "event:7")!;
  expect(buildVideoFrame(plan, proposal.from + 89).currentView.players[2]!.alive).toBe(true);
  const commit = plan.shots.find((shot) => shot.id === "fact:2")!;
  expect(commit.sourceSeqs).toEqual([]);
  expect(commit.sourceFacts).toEqual([2]);
  expect(commit.eventSeq).toBeNull();
  expect(buildVideoFrame(plan, commit.from + 23).currentView.players[2]!.alive).toBe(true);
  expect(buildVideoFrame(plan, commit.from + 23).sourceFactSeq).toBe(1);
  expect(buildVideoFrame(plan, commit.from + 24).currentView.players[2]!.alive).toBe(false);
  expect(buildVideoFrame(plan, commit.from + 24).sourceFactSeq).toBe(2);
  const after = plan.shots.find((shot) => shot.id === "hold:after")!;
  expect(after.from).toBe(commit.from + commit.durationFrames);
  expect(buildVideoFrame(plan, after.from).currentView.players[2]!.alive).toBe(false);
  const recall = plan.shots.find((shot) => shot.id === "hold:before")!;
  expect(buildVideoFrame(plan, recall.from).currentView.players[2]!.alive).toBe(true);
  expect(buildVideoFrame(plan, commit.from + 24).currentView.players[2]!.alive).toBe(false);
  const index = createReplaySnapshotIndex(document);
  expect(index[5]!.players[2]!.alive).toBe(true);
  expect(index[6]!.players[2]!.alive).toBe(false);
  expect(buildReplaySnapshot(document, 6)).toEqual(index[6]);
  expect(getVideoEventFrame(plan, 6)).toBeNull();
});

test("structured choices never imply a final knife, successful healing or guessed speech targets", () => {
  const document = replay([
    {
      type: "wolf_kill_vote_cast",
      phase: "night",
      payload: { actorId: 1, targetId: 3, abstain: false },
    },
    {
      type: "witch_potion_used",
      phase: "night",
      payload: { actorId: 5, targetId: 3, potionType: "heal" },
    },
    {
      type: "day_speech",
      phase: "day",
      payload: { actorId: 3, text: "我验了四号是狼，先看四号。" },
    },
    { type: "future_unknown_resolution", payload: { actorId: 3, targetId: 4, deaths: [4] } },
  ]);
  const plan = compileVideoPlan(document);
  expect(plan.shots.map((shot) => shot.scene.kind)).toEqual([
    "action",
    "action",
    "speech",
    "fallback",
  ]);
  expect(plan.shots[0]!.scene.action).toEqual({ kind: "wolf-vote", status: "choice" });
  expect(plan.shots[1]!.scene.action).toEqual({ kind: "heal", status: "recorded" });
  expect(plan.shots[1]!.scene.stock).toBeUndefined();
  expect(plan.shots[2]!.scene.targetIds).toEqual([]);
  expect(plan.shots[2]!.scene.body).toBe("我验了四号是狼，先看四号。");
  expect(plan.shots[3]!.scene.targetIds).toEqual([]);
  expect(plan.shots[3]!.view.players[3]!.alive).toBe(true);
});

test("independent knife and protection facts keep their scope, while an explicit same-prefix wave reveals together", () => {
  const document = replay([
    { type: "voted_out", payload: { target: 3 } },
    { type: "night_resolved", phase: "night", payload: { deaths: [3, 4] } },
  ]);
  document.factCoverage = { committedDeaths: 1 };
  document.facts = [
    {
      seq: 1,
      afterSeq: 0,
      kind: "wolf_knife_committed",
      day: 1,
      participantIds: [1, 2],
      requestedTargetId: 3,
      effectiveTargetId: 4,
    },
    {
      seq: 2,
      afterSeq: 1,
      kind: "night_protection_resolved",
      day: 1,
      targetId: 4,
      interaction: "wolf_attack_blocked",
      protection: "guard",
    },
    {
      seq: 3,
      afterSeq: 2,
      kind: "life_committed",
      day: 1,
      waveId: 1,
      playerId: 3,
      alive: false,
      causes: ["poison"],
    },
    {
      seq: 4,
      afterSeq: 2,
      kind: "life_committed",
      day: 1,
      waveId: 1,
      playerId: 4,
      alive: false,
      causes: ["other"],
    },
  ];
  const plan = compileVideoPlan(document);
  const knife = plan.shots[0]!;
  expect(knife.scene.participantIds).toEqual([1, 2]);
  expect(knife.scene.targetIds).toEqual([4]);
  expect(knife.scene.action).toEqual({ kind: "wolf-knife", status: "committed" });
  expect(knife.view.players[3]!.alive).toBe(true);
  const protection = plan.shots.find((shot) => shot.id === "fact:2")!;
  expect(protection.scene.action).toEqual({
    kind: "protection",
    status: "committed",
    result: "wolf_attack_blocked",
  });
  expect(protection.view.players[2]!.alive).toBe(true);
  expect(protection.view.players[3]!.alive).toBe(true);
  // 已有同前缀同wave的完整提交与夜报同镜头揭晓，不重复播一遍死亡。
  const deaths = plan.shots.find((shot) => shot.id === "event:2")!;
  expect(deaths.sourceSeqs).toEqual([2]);
  expect(deaths.sourceFacts).toEqual([3, 4]);
  expect(deaths.scene.targetIds).toEqual([3, 4]);
  expect(deaths.scene.visual?.effectiveTargetIds).toEqual([3, 4]);
  expect(deaths.scene.visual?.effectiveTargetKnown).toBe(true);
  expect(deaths.scene.visual?.life).toEqual({
    playerIds: [3, 4],
    committed: true,
    causes: { 3: ["poison"], 4: ["other"] },
    waveId: 1,
  });
  expect(
    buildVideoFrame(plan, deaths.from + 23)
      .currentView.players.slice(2, 4)
      .map((player) => player.alive),
  ).toEqual([true, true]);
  expect(
    buildVideoFrame(plan, deaths.from + 24)
      .currentView.players.slice(2, 4)
      .map((player) => player.alive),
  ).toEqual([false, false]);
  expect(buildVideoFrame(plan, deaths.from + 24).sourceFactSeq).toBe(4);
  const unchanged = structuredClone(document);
  unchanged.facts = [];
  expect(
    buildReplaySnapshot(unchanged, 1)
      .players.slice(2, 4)
      .map((player) => player.alive),
  ).toEqual([true, true]);
});

test("same afterSeq is not wave evidence and a recorded wave crossing events keeps both exact prefixes", () => {
  const document = replay([
    { type: "night_resolved", phase: "night", payload: { deaths: [3, 4] } },
    { type: "phase_changed", phase: "day", payload: { phase: "day" } },
  ]);
  document.factCoverage = { committedDeaths: 1 };
  const life = (seq: number, playerId: number, afterSeq: number, waveId?: number) => ({
    seq,
    afterSeq,
    kind: "life_committed" as const,
    day: 1,
    playerId,
    alive: false as const,
    causes: ["other"],
    ...(waveId === undefined ? {} : { waveId }),
  });
  for (const facts of [
    [life(1, 3, 1), life(2, 4, 1)],
    [life(1, 3, 1, 7), life(2, 4, 1, 8)],
    [life(1, 3, 1, 7), life(2, 4, 2, 7)],
  ]) {
    document.facts = facts;
    const plan = compileVideoPlan(document);
    const first = plan.shots.find((s) => s.id === "fact:1")!;
    const second = plan.shots.find((s) => s.id === "fact:2")!;
    expect(first.sourceFacts).toEqual([1]);
    expect(second.sourceFacts).toEqual([2]);
    expect(first.scene.visual?.life?.waveId).toBe(facts[0]!.waveId);
    expect(second.scene.visual?.life?.waveId).toBe(facts[1]!.waveId);
    expect(
      buildVideoFrame(plan, first.from + 24)
        .currentView.players.slice(2, 4)
        .map((p) => p.alive),
    ).toEqual([false, true]);
    expect(
      buildVideoFrame(plan, second.from + 23)
        .currentView.players.slice(2, 4)
        .map((p) => p.alive),
    ).toEqual([false, true]);
    expect(
      buildVideoFrame(plan, second.from + 24)
        .currentView.players.slice(2, 4)
        .map((p) => p.alive),
    ).toEqual([false, false]);
    expect(buildVideoFrame(plan, second.from + 24).sourceSeq).toBe(facts[1]!.afterSeq);
    expect(buildVideoFrame(plan, second.from + 24).sourceFactSeq).toBe(2);
    const commitCue = second.stateCues.find((cue) => cue.throughFactSeq === 2)!;
    expect([commitCue.frame, commitCue.throughSeq]).toEqual([24, facts[1]!.afterSeq]);
  }
});

test("knife revocation is explicit and a new covered ballot paragraph cannot commit proposal deaths", () => {
  const document = election();
  document.factCoverage = { committedDeaths: 1 };
  document.facts = [
    {
      seq: 1,
      afterSeq: 0,
      kind: "wolf_knife_committed",
      day: 1,
      participantIds: [1],
      requestedTargetId: 3,
      effectiveTargetId: 3,
    },
    {
      seq: 2,
      afterSeq: 1,
      kind: "wolf_knife_revoked",
      day: 1,
      targetId: 3,
      reason: "stale_target",
    },
    {
      seq: 3,
      afterSeq: 7,
      kind: "life_committed",
      day: 1,
      playerId: 3,
      alive: false,
      causes: ["exile"],
    },
  ];
  const plan = compileVideoPlan(document);
  const revoked = plan.shots.find((shot) => shot.id === "fact:2")!;
  expect(revoked.scene.action).toEqual({
    kind: "wolf-knife",
    status: "revoked",
    result: "stale_target",
  });
  const ballot = plan.shots.find((shot) => shot.id === "event:6")!;
  expect(ballot.sourceSeqs).toEqual([2, 3, 4, 5, 6, 7]);
  expect(ballot.scene.resolution?.revealFrame).toBe(396);
  expect(
    buildVideoFrame(plan, ballot.from + ballot.durationFrames - 1).currentView.players[2]!.alive,
  ).toBe(true);
  const life = plan.shots.find((shot) => shot.id === "fact:3")!;
  expect(buildVideoFrame(plan, life.from + 23).currentView.players[2]!.alive).toBe(true);
  expect(buildVideoFrame(plan, life.from + 24).currentView.players[2]!.alive).toBe(false);
  // 结果事件本身有剪辑/hold锚点时不被前一summary吞并，导演原有锚点仍能独立生效。
  const edited = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [
        { anchor: { seq: 7, type: "voted_out" }, durationFrames: 1, scene: { kind: "speech" } },
      ],
    }),
  );
  expect(edited.shots.find((shot) => shot.id === "event:6")!.sourceSeqs).toEqual([2, 3, 4, 5, 6]);
  expect(edited.shots.find((shot) => shot.id === "event:7")!.durationFrames).toBe(1);
});

test("explicit emphasis and scene targeting retain raw speech while system names use the sanitized seat roster", () => {
  const document = replay([
    {
      type: "day_speech",
      phase: "day",
      payload: { actorId: 1, text: "原话说：二号可信，二号可信。" },
    },
    {
      type: "witch_potion_used",
      phase: "night",
      payload: { actorId: 5, targetId: 3, potionType: "poison" },
    },
  ]);
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      presentation: { anonymous: true, players: { 1: { seat: 20 }, 3: { seat: 30 } } },
      edits: [
        {
          anchor: { seq: 1, type: "day_speech" },
          scene: { title: "发言重点", targetIds: [2], cues: { impact: 12 } },
          emphasis: [{ text: "二号可信", occurrence: 1 }],
        },
      ],
    }),
  );
  const scene = plan.shots[0]!.scene;
  expect(scene.body).toBe("原话说：二号可信，二号可信。");
  expect(scene.targetIds).toEqual([2]);
  expect(scene.emphasis).toEqual([{ text: "二号可信", start: 9, end: 13 }]);
  expect(scene.cues.impact).toBe(12);
  expect(plan.shots[0]!.view.label).not.toContain("真实姓名");
  expect(plan.shots[1]!.view.label).toContain("30号");
  expect(plan.shots[1]!.view.label).not.toContain("真实姓名");
  expect(plan.playersPresentation.find((player) => player.playerId === 1)!.seat).toBe(20);
  expect(() =>
    compileVideoPlan(
      document,
      script(document, {
        edits: [{ anchor: { seq: 1, type: "day_speech" }, emphasis: [{ text: "没出现" }] }],
      }),
    ),
  ).toThrow("video_emphasis_text_missing");
  expect(() =>
    compileVideoPlan(
      document,
      script(document, {
        edits: [{ anchor: { seq: 1, type: "day_speech" }, scene: { targetIds: [99] } }],
      }),
    ),
  ).toThrow("video_scene_player_invalid");
});

test("broadcast rosters remain fixed under camera zoom and legacy scripts preserve ellipse coordinates", () => {
  const document = election();
  const legacy = compileVideoPlan(document, script(document));
  expect([legacy.layout, legacy.width, legacy.height]).toEqual(["legacy-ellipse-v1", 1280, 720]);
  const oldLayout = createVideoLayout([1, 2, 3, 4, 5, 6], 1280, 720);
  expect(oldLayout.seats[0]!.x).toBe(640);
  expect(oldLayout.seats[0]!.y).toBeCloseTo(129.6);
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [
        {
          anchor: { seq: 1, type: "phase_changed" },
          camera: [{ frame: 0, target: { playerIds: [1, 12] }, zoom: 1.8 }],
        },
      ],
    }),
  );
  const view = buildVideoFrame(plan, 0);
  expect(view.camera.scale).toBe(1.8);
  expect(view.layout.rosterLeft.length).toBe(6);
  expect(view.layout.rosterRight.length).toBe(6);
  for (const anchor of view.layout.seats) {
    expect(anchor.y - anchor.height / 2).toBeGreaterThan(0);
    expect(anchor.y + anchor.height / 2).toBeLessThan(plan.height);
    expect(
      anchor.x < plan.width / 2
        ? anchor.x + anchor.width / 2 < view.layout.stage.x
        : anchor.x - anchor.width / 2 > view.layout.stage.x + view.layout.stage.width,
    ).toBe(true);
    expect(
      videoWorldToScreen(resolveLayerPoint({ playerId: anchor.playerId }, view.layout), view),
    ).toEqual({ x: anchor.x, y: anchor.y });
  }
});

test("fact edits anchor their own kind and split default death batches without deleting committed history", () => {
  const document = replay([
    { type: "night_resolved", phase: "night", payload: { deaths: [3, 4] } },
    { type: "phase_changed", phase: "day", payload: { phase: "day" } },
  ]);
  document.factCoverage = { committedDeaths: 1 };
  document.facts = [
    {
      seq: 1,
      afterSeq: 1,
      kind: "life_committed",
      day: 1,
      waveId: 1,
      playerId: 3,
      alive: false,
      causes: ["poison"],
    },
    {
      seq: 2,
      afterSeq: 1,
      kind: "life_committed",
      day: 1,
      waveId: 1,
      playerId: 4,
      alive: false,
      causes: ["wolf_kill"],
    },
  ];
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      factEdits: [
        { anchor: { seq: 1, kind: "life_committed" }, skip: true },
        {
          anchor: { seq: 2, kind: "life_committed" },
          durationFrames: 10,
          caption: "第二条死亡说明",
          scene: { cues: { travel: 2, impact: 4, settled: 8 } },
          emphasis: [{ text: "死亡" }],
        },
      ],
    }),
  );
  expect(plan.shots.find((shot) => shot.id === "fact:1")).toBeUndefined();
  const shot = plan.shots.find((shot) => shot.id === "fact:2")!;
  expect(shot.sourceFacts).toEqual([2]);
  expect(shot.durationFrames).toBe(10);
  expect(shot.captionPages).toEqual(["第二条死亡说明"]);
  expect(shot.scene.emphasis).toEqual([{ text: "死亡", start: 3, end: 5 }]);
  expect(
    buildVideoFrame(plan, shot.from + 3)
      .currentView.players.slice(2, 4)
      .map((player) => player.alive),
  ).toEqual([false, true]);
  expect(
    buildVideoFrame(plan, shot.from + 4)
      .currentView.players.slice(2, 4)
      .map((player) => player.alive),
  ).toEqual([false, false]);
  expect(() =>
    compileVideoPlan(
      document,
      script(document, { factEdits: [{ anchor: { seq: 2, kind: "potion_stock" } }] }),
    ),
  ).toThrow("video_fact_anchor_mismatch:2");
});

test("known recorder stage aliases group, while an unrelated or PK stage never merges into a ballot window", () => {
  const document = election();
  for (const event of document.events)
    event.stage = event.type === "crow_curse_applied" ? "crow_curse_applied" : "voting";
  document.events[1]!.stage = "exile_pk_vote";
  const plan = compileVideoPlan(document);
  expect(plan.shots.find((shot) => shot.id === "event:2")!.scene.ballot?.complete).toBe(false);
  expect(plan.shots.find((shot) => shot.id === "event:6")!.sourceSeqs).toEqual([3, 4, 5, 6, 7]);
  expect(plan.shots.find((shot) => shot.id === "event:6")!.scene.ballot?.adjustments).toEqual([
    { kind: "crow", targetId: 3, weight: 1, sourceSeq: 5 },
  ]);
  const sheriff = replay([
    { type: "sheriff_vote_cast", payload: { actorId: 1, targetId: 2, abstain: false } },
    {
      type: "sheriff_vote_summary",
      payload: { round: 1, votes: [{ actorId: 1, targetId: 2, abstain: false }], winnerId: 2 },
    },
  ]);
  sheriff.events[0]!.stage = "sheriff";
  sheriff.events[1]!.stage = "sheriff_vote_summary";
  expect(compileVideoPlan(sheriff).shots[0]!.sourceSeqs).toEqual([1, 2]);
});

test("emphasis order is independent of author order, overlaps reject and identical subtitle pages keep exact offsets", () => {
  const document = replay([
    { type: "day_speech", phase: "day", payload: { actorId: 1, text: "一号可以，二号也可以" } },
  ]);
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [
        { anchor: { seq: 1, type: "day_speech" }, emphasis: [{ text: "二号" }, { text: "一号" }] },
      ],
    }),
  );
  expect(plan.shots[0]!.scene.emphasis).toEqual([
    { text: "一号", start: 0, end: 2 },
    { text: "二号", start: 5, end: 7 },
  ]);
  expect(() =>
    compileVideoPlan(
      document,
      script(document, {
        layout: "broadcast-v1",
        edits: [
          {
            anchor: { seq: 1, type: "day_speech" },
            emphasis: [{ text: "一号可以" }, { text: "可以" }],
          },
        ],
      }),
    ),
  ).toThrow("video_emphasis_overlap");
  document.events[0]!.payload.text = "x".repeat(432);
  const repeated = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      // 本例专测相同216字页的原始offset；显式旧分页预算不随新自动阅读模板变化。
      captionPageFrames: 90,
      edits: [
        { anchor: { seq: 1, type: "day_speech" }, emphasis: [{ text: "x", occurrence: 300 }] },
      ],
    }),
  );
  const shot = repeated.shots[0]!;
  expect(shot.captionPages).toEqual(["x".repeat(216), "x".repeat(216)]);
  expect(shot.captionPageOffsets).toEqual([0, 216]);
  expect(buildVideoFrame(repeated, 90).captionOffset).toBe(216);
  expect(shot.scene.emphasis).toEqual([{ text: "x", start: 300, end: 301 }]);
});

test("camera targets select explicit central focus IDs at keyframes without moving fixed roster anchors", () => {
  const document = replay([
    { type: "day_speech", phase: "day", payload: { actorId: 1, text: "这段话没有提到十二号。" } },
  ]);
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [
        {
          anchor: { seq: 1, type: "day_speech" },
          durationFrames: 40,
          camera: [
            { frame: 0, target: "table" },
            { frame: 10, target: { playerIds: [12] }, zoom: 1.8 },
            { frame: 20, target: { playerIds: [2, 5] } },
            { frame: 30, target: "table" },
          ],
        },
      ],
    }),
  );
  const original = buildVideoFrame(plan, 0).layout.seats;
  expect(buildVideoFrame(plan, 0).focusPlayerIds).toEqual([]);
  expect(buildVideoFrame(plan, 9).focusPlayerIds).toEqual([]);
  expect(buildVideoFrame(plan, 10).focusPlayerIds).toEqual([12]);
  expect(buildVideoFrame(plan, 19).focusPlayerIds).toEqual([12]);
  expect(buildVideoFrame(plan, 20).focusPlayerIds).toEqual([2, 5]);
  expect(buildVideoFrame(plan, 30).focusPlayerIds).toEqual([]);
  for (const frame of [10, 19, 20, 30])
    expect(buildVideoFrame(plan, frame).layout.seats).toEqual(original);
  expect(buildVideoFrame(plan, 10).scene.actorId).toBe(1);
});
