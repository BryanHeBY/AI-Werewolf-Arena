/**
 * 单元层负责核对库存上下文、玩家结束对白与终局结构。输入为独立手写事件/事实，输出明确游标和字段预期。
 * 不调用后端规则或从当前角色生成结果；覆盖库存先于动作写入、缺档/歧义、导演锚点及impact前中性。
 */
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument, ReplayFact } from "@ai-werewolf-arena/replay-contract";
import type { GameOutcome } from "@ai-werewolf-arena/game-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";
import { sceneArt } from "../../../src/themes/gothic/scene-art";
import { VideoFrame } from "../../../src/video/VideoComposition";
import { SceneHero } from "../../../src/video/SceneVisual";
import { outcomeEmblem } from "../../../src/presentation/scene-content";
import { SceneContentBlocks } from "../../../src/presentation/SceneContentBlocks";
import { interpretVideoEvent } from "../../../src/video/plan/records";
import { replayDisplayRoster } from "../../../src/replay/replay-display-roster";
/** 明确选择既有阅读制作时钟；紧凑旁白节奏的边界另由video-narration-pacing独立验证。 */
function readingOptions(document: ReplayDocument) {
  return {
    source: getVideoSourceIdentity(document),
    layout: "broadcast-v1" as const,
    pacing: "reading" as const,
  };
}
function document(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "content",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players: [
      { player_id: 1, role: "witch", camp: "good" },
      { player_id: 2, role: "wolf", camp: "wolf" },
    ],
    events: [
      {
        seq: 1,
        type: "phase_changed",
        payload: { phase: "night" },
        timestamp: "t",
        day: 1,
        phase: "night",
      },
      {
        seq: 2,
        type: "witch_potion_used",
        payload: { actorId: 1, targetId: 2, potionType: "poison" },
        timestamp: "t",
        day: 1,
        phase: "night",
      },
      {
        seq: 3,
        type: "night_resolved",
        payload: { deaths: [2] },
        timestamp: "t",
        day: 1,
        phase: "night",
      },
    ],
    factCoverage: { committedDeaths: 1 },
    facts: [
      {
        seq: 1,
        afterSeq: 0,
        kind: "potion_stock",
        day: 1,
        actorId: 1,
        abilityId: "native-potion",
        heal: 1,
        poison: 1,
      },
      {
        seq: 2,
        afterSeq: 1,
        kind: "potion_stock",
        day: 1,
        actorId: 1,
        abilityId: "native-potion",
        heal: 1,
        poison: 0,
      },
      {
        seq: 3,
        afterSeq: 2,
        kind: "life_committed",
        day: 1,
        playerId: 2,
        alive: false,
        causes: ["poison"],
      },
    ],
  };
}
test("stock is contextual and a pre-event payment never becomes the action's before inventory", () => {
  const doc = document(),
    plan = compileVideoPlan(doc, readingOptions(doc));
  expect(plan.shots.map((shot) => shot.id)).toEqual(["event:1", "event:2", "fact:3"]);
  const action = plan.shots[1]!;
  expect(action.scene.inventory).toEqual({
    before: {
      status: "known",
      actorId: 1,
      abilityId: "native-potion",
      heal: 1,
      poison: 1,
      sourceFactSeq: 1,
      afterSeq: 0,
      day: 1,
    },
    after: {
      status: "known",
      actorId: 1,
      abilityId: "native-potion",
      heal: 1,
      poison: 0,
      sourceFactSeq: 2,
      afterSeq: 1,
      day: 1,
    },
    revealFrame: 24,
  });
  expect(action.scene.content?.blocks.find((block) => block.kind === "inventory")).toEqual({
    kind: "inventory",
    state: action.scene.inventory!.after,
  });
  expect(buildVideoFrame(plan, action.from + 23).sourceSeq).toBe(1);
  expect(buildVideoFrame(plan, action.from + 24).sourceSeq).toBe(2);
  expect(buildVideoFrame(plan, action.from + 24).currentView.players[1]!.alive).toBe(true);
  const death = plan.shots[2]!;
  expect(buildVideoFrame(plan, death.from + 23).currentView.players[1]!.alive).toBe(true);
  expect(buildVideoFrame(plan, death.from + 24).currentView.players[1]!.alive).toBe(false);
  expect(buildVideoFrame(plan, action.from).sourceFactSeq).toBe(2);
  expect(buildVideoFrame(plan, action.from + 24).sourceFactSeq).toBe(2);
  // 倒看仍来自原始前缀，不从曾播放的死亡镜头累计状态。
  expect(buildVideoFrame(plan, action.from).currentView.players[1]!.alive).toBe(true);
  const explicit = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    factEdits: [{ anchor: { seq: 1, kind: "potion_stock" }, caption: "导演保留开局库存" }],
  });
  expect(explicit.shots[0]!.id).toBe("fact:1");
  expect(explicit.shots[0]!.scene.body).toBe("导演保留开局库存");
});
test("action result owns one visible DOM text marker in both flow and explicit legacy pagination", () => {
  const doc = document();
  for (const explicit of [false, true]) {
    const plan = compileVideoPlan(
      doc,
      explicit
        ? {
            source: getVideoSourceIdentity(doc),
            layout: "broadcast-v1",
            edits: [{ anchor: { seq: 2, type: "witch_potion_used" }, durationFrames: 90 }],
          }
        : readingOptions(doc),
    );
    const shot = plan.shots.find((value) => value.eventSeq === 2)!;
    for (const localFrame of [23, 24]) {
      const html = renderToStaticMarkup(<VideoFrame plan={plan} frame={shot.from + localFrame} />);
      expect(html.match(/data-scene-result=/g)).toHaveLength(1);
    }
  }
});
test("an exact same-prefix committed life report reveals once with its authority and raw event mapping intact", () => {
  const doc = document();
  doc.events = [doc.events[0]!, { ...doc.events[2]!, seq: 2 }];
  doc.facts = [
    {
      seq: 1,
      afterSeq: 2,
      kind: "life_committed",
      day: 1,
      playerId: 2,
      alive: false,
      causes: ["poison"],
      waveId: 4,
    },
  ];
  const plan = compileVideoPlan(doc, readingOptions(doc)),
    shot = plan.shots[1]!;
  expect(plan.shots.map((value) => value.id)).toEqual(["event:1", "event:2"]);
  expect(shot.sourceSeqs).toEqual([2]);
  expect(shot.sourceFacts).toEqual([1]);
  expect(shot.scene.visual?.source).toEqual({ eventSeqs: [2], factSeqs: [1] });
  expect(shot.scene.visual?.life).toEqual({
    playerIds: [2],
    committed: true,
    waveId: 4,
    causes: { 2: ["poison"] },
  });
  expect(buildVideoFrame(plan, shot.from + 23).currentView.players[1]!.alive).toBe(true);
  expect(buildVideoFrame(plan, shot.from + 24).currentView.players[1]!.alive).toBe(false);
  expect(buildVideoFrame(plan, shot.from + 24).sourceFactSeq).toBe(1);
  expect(plan.eventFrames["2"]).toEqual([
    { shotId: "event:2", frame: shot.from + 24, mode: "primary" },
  ]);
  const edited = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    factEdits: [{ anchor: { seq: 1, kind: "life_committed" }, caption: "单独确认" }],
  });
  expect(edited.shots.map((value) => value.id)).toEqual(["event:1", "fact:1"]);
  expect(edited.shots[1]!.scene.body).toBe("单独确认");
  expect(buildVideoFrame(edited, edited.shots[1]!.from + 23).currentView.players[1]!.alive).toBe(
    true,
  );
});
test("different or unknown waves and incomplete submissions show only authoritative facts without a waiting page", () => {
  for (const waves of [
    [1, 2],
    [undefined, undefined],
  ] as const) {
    const doc = document();
    doc.events = [doc.events[0]!, { ...doc.events[2]!, seq: 2, payload: { deaths: [1, 2] } }];
    doc.facts = [1, 2].map((playerId, index) => ({
      seq: index + 1,
      afterSeq: 2,
      kind: "life_committed",
      day: 1,
      playerId,
      alive: false,
      causes: ["poison"],
      ...(waves[index] === undefined ? {} : { waveId: waves[index] }),
    }));
    const plan = compileVideoPlan(doc, readingOptions(doc)),
      death = plan.shots[1]!;
    expect(plan.shots.map((value) => value.id)).toEqual(["event:1", "fact:1", "fact:2"]);
    expect(death.scene.body).toBe("1号已死亡。");
    expect(plan.shots[2]!.scene.body).toBe("2号已死亡。");
    expect(
      buildVideoFrame(plan, death.from + 23).currentView.players.map((player) => player.alive),
    ).toEqual([true, true]);
  }
  const doc = document();
  doc.events = [doc.events[0]!, { ...doc.events[2]!, seq: 2, payload: { deaths: [1, 2] } }];
  doc.facts = [
    {
      seq: 1,
      afterSeq: 2,
      kind: "life_committed",
      day: 1,
      playerId: 1,
      alive: false,
      causes: ["poison"],
      waveId: 4,
    },
  ];
  const plan = compileVideoPlan(doc, readingOptions(doc));
  expect(plan.shots.map((shot) => shot.id)).toEqual(["event:1", "fact:1"]);
  expect(
    buildVideoFrame(plan, plan.durationFrames - 1).currentView.players.map(
      (player) => player.alive,
    ),
  ).toEqual([false, true]);
});
test("a partial tail stock consumes its exact fact cursor without adding narration or moving life", () => {
  const doc = document();
  doc.events = [doc.events[0]!];
  doc.facts = [
    {
      seq: 1,
      afterSeq: 1,
      kind: "potion_stock",
      day: 1,
      actorId: 1,
      abilityId: "native-potion",
      heal: 1,
      poison: 1,
    },
  ];
  const plan = compileVideoPlan(doc, readingOptions(doc)),
    shot = plan.shots[0]!;
  expect(plan.shots.map((value) => value.id)).toEqual(["event:1"]);
  expect(shot.speech.some((cue) => cue.text.includes("解药"))).toBe(false);
  expect(buildVideoFrame(plan, shot.durationFrames - 2).sourceFactSeq).toBe(0);
  expect(buildVideoFrame(plan, shot.durationFrames - 1).sourceFactSeq).toBe(1);
  expect(buildVideoFrame(plan, shot.durationFrames - 1).currentView.players[1]!.alive).toBe(true);
  expect(buildVideoFrame(plan, 24).sourceFactSeq).toBe(0);
});
test("a first-event action cannot label same-prefix paid stock as the before quantity", () => {
  const doc = document();
  doc.events = [{ ...doc.events[1]!, seq: 1 }];
  doc.facts = doc.facts!.slice(0, 2).map((fact) => ({ ...fact, afterSeq: 0 }));
  const stock = compileVideoPlan(doc).shots[0]!.scene.inventory!;
  expect(stock.before).toEqual({ status: "unknown", actorId: 1 });
  expect(stock.after).toMatchObject({ status: "known", heal: 1, poison: 0, sourceFactSeq: 2 });
});
test("missing and multiple potion instances stay unknown, while explicit ability attribution picks only its recorded instance", () => {
  const doc = document();
  doc.facts = [];
  const missing = compileVideoPlan(doc).shots.find((shot) => shot.eventSeq === 2)!;
  expect(missing.scene.inventory?.after).toEqual({ status: "unknown", actorId: 1 });
  doc.facts = [
    {
      seq: 1,
      afterSeq: 0,
      kind: "potion_stock",
      day: 1,
      actorId: 1,
      abilityId: "granted-potion",
      heal: 0,
      poison: 1,
    },
    {
      seq: 2,
      afterSeq: 0,
      kind: "potion_stock",
      day: 1,
      actorId: 1,
      abilityId: "copied-potion",
      heal: 1,
      poison: 0,
    },
  ];
  expect(
    compileVideoPlan(doc).shots.find((shot) => shot.eventSeq === 2)!.scene.inventory?.after.status,
  ).toBe("unknown");
  doc.events[1]!.payload.abilityId = "copied-potion";
  expect(
    compileVideoPlan(doc).shots.find((shot) => shot.eventSeq === 2)!.scene.inventory?.after,
  ).toEqual({
    status: "known",
    actorId: 1,
    abilityId: "copied-potion",
    heal: 1,
    poison: 0,
    sourceFactSeq: 2,
    afterSeq: 0,
    day: 1,
  });
  doc.events[1] = {
    ...doc.events[1]!,
    type: "witch_potion_skipped",
    payload: { actorId: 1, targetId: 2, reason: "not now", abilityId: "granted-potion" },
  };
  expect(
    compileVideoPlan(doc).shots.find((shot) => shot.eventSeq === 2)!.scene.inventory?.after,
  ).toMatchObject({ heal: 0, poison: 1 });
  expect(
    compileVideoPlan(doc).shots.find((shot) => shot.eventSeq === 2)!.scene.visual
      ?.requestedTargetIds,
  ).toEqual([]);
  expect(doc.events[1]!.payload.targetId).toBe(2);
});
test("wolf chat completion keeps player source, original reason and future player voice separate from a tactical order", () => {
  const doc = document();
  doc.facts = [];
  doc.events = [
    {
      ...doc.events[0]!,
      type: "wolf_discussion_ended",
      payload: { actorId: 2, reason: "我同意，结束讨论。", round: 3 },
    },
  ];
  const shot = compileVideoPlan(doc).shots[0]!;
  expect(shot.scene.kind).toBe("speech");
  expect(shot.scene.body).toBe("我同意，结束讨论。");
  expect(shot.scene.visual?.dialogue).toEqual({ kind: "end_chat", round: 3 });
  expect(shot.scene.visual?.actorId).toBe(2);
  expect(shot.speech[0]).toMatchObject({
    speaker: "player:2",
    text: "我同意，结束讨论。",
    from: 0,
  });
  expect(shot.scene.content?.blocks[0]).toEqual({
    kind: "dialogue",
    actorId: 2,
    text: "我同意，结束讨论。",
    textSource: "event",
    dialogue: { kind: "end_chat", round: 3 },
  });
  doc.events[0] = { ...doc.events[0]!, type: "wolf_tactical_order", payload: { order: [2, 1] } };
  expect(compileVideoPlan(doc).shots[0]!.scene.kind).toBe("fallback");
});
test("the reusable dialogue template labels an authored replacement as editorial rather than original player speech", () => {
  const doc = document();
  doc.facts = [];
  doc.events = [
    { ...doc.events[0]!, type: "day_speech", payload: { actorId: 2, text: "实际原话" } },
  ];
  const shot = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    edits: [{ anchor: { seq: 1, type: "day_speech" }, caption: "导演说明正文" }],
  }).shots[0]!;
  const html = renderToStaticMarkup(
    <SceneContentBlocks content={shot.scene.content!} locale="zh-CN" kinds={["dialogue"]} />,
  );
  expect(html).toContain("编导标注");
  expect(html).toContain("导演说明正文");
  expect(html).not.toContain("<strong>2号</strong>");
  expect(shot.scene.visual?.actorId).toBe(2);
});
const outcomes: GameOutcome[] = [
  ...(["good", "wolf", "third_party"] as const).map((faction): GameOutcome => ({
    kind: "victory",
    primary: { kind: "faction", faction, winningPlayerIds: [2] },
    additional: [],
    winningPlayerIds: [2],
  })),
  {
    kind: "victory",
    primary: { kind: "individual", playerId: 2, goalId: "own-goal", winningPlayerIds: [2] },
    additional: [],
    winningPlayerIds: [2],
  },
  {
    kind: "victory",
    primary: { kind: "relationship", groupId: "cupid_lovers", winningPlayerIds: [1, 2] },
    additional: [{ kind: "individual", playerId: 2, goalId: "own-goal", winningPlayerIds: [2] }],
    winningPlayerIds: [1, 2],
  },
  { kind: "no_winner" },
];
test("typed terminal outcomes choose six emblems only after reveal and preserve dead winners plus additional claims", () => {
  const emblems = [
    "good",
    "wolf",
    "third-party",
    "individual",
    "relationship",
    "no-winner",
  ] as const;
  for (let index = 0; index < outcomes.length; index++) {
    const doc = document();
    const outcome = outcomes[index]!;
    doc.events[2] = {
      ...doc.events[2]!,
      type: "game_over",
      payload: {
        winner:
          outcome.kind === "victory" && outcome.primary.kind === "faction"
            ? outcome.primary.faction
            : null,
        reason: "recorded_terminal",
        outcome,
        decidedAt: { day: 1, phase: "night", checkpoint: "night_settled" },
      },
    };
    const plan = compileVideoPlan(doc, readingOptions(doc)),
      shot = plan.shots.at(-1)!;
    expect(outcomeEmblem(shot.scene.visual?.victory?.outcome)).toBe(emblems[index]!);
    expect(sceneArt(shot.scene)).toBe("judgement-seal");
    expect(sceneArt(shot.scene, { revealed: true })).toBe(`victory-${emblems[index]}`);
    const before = renderToStaticMarkup(
      <SceneHero
        scene={shot.scene}
        frame={23}
        size={200}
        theme={plan.theme}
        gothic
        color="#aaaaaa"
      />,
    );
    const after = renderToStaticMarkup(
      <SceneHero
        scene={shot.scene}
        frame={24}
        size={200}
        theme={plan.theme}
        gothic
        color="#aaaaaa"
      />,
    );
    expect(before).not.toContain('data-scene-hero="victory-');
    expect(after).toContain(`data-scene-hero="victory-${emblems[index]}"`);
    const frame = buildVideoFrame(plan, shot.from + 24);
    expect(frame.currentView.players[1]!.alive).toBe(false);
    expect(frame.currentView.players[1]!.isWinner).toBe(outcome.kind === "victory");
    const content = shot.scene.content!;
    expect(content.blocks.find((block) => block.kind === "outcome")).toMatchObject({ outcome });
    const fields = renderToStaticMarkup(<SceneContentBlocks content={content} locale="en" />);
    if (index === 4) expect(fields).toContain("data-additional-result");
  }
  expect(outcomeEmblem(undefined)).toBe("unknown");
});
test("legacy explicit faction winner selects only its emblem and null never invents no-winner or winning members", () => {
  const doc = document();
  doc.events[2] = {
    ...doc.events[2]!,
    type: "game_over",
    payload: {
      winner: "wolf",
      reason: "recorded_terminal",
      outcome: outcomes[1]!,
      decidedAt: { day: 1, phase: "night", checkpoint: "night_settled" },
    },
  };
  const scene = structuredClone(compileVideoPlan(doc).shots.at(-1)!.scene);
  scene.visual!.victory = { winner: "wolf", winningPlayerIds: [] };
  const original = JSON.stringify(scene);
  expect(sceneArt(scene)).toBe("judgement-seal");
  expect(sceneArt(scene, { revealed: true })).toBe("victory-wolf");
  expect(JSON.stringify(scene)).toBe(original);
  for (const [winner, emblem] of [
    ["good", "good"],
    ["wolf", "wolf"],
    ["third_party", "third-party"],
    [null, "unknown"],
    ["future", "unknown"],
  ] as const)
    expect(outcomeEmblem(undefined, winner)).toBe(emblem);
  expect(outcomeEmblem(outcomes[0], "wolf")).toBe("good");
  scene.visual!.victory.winner = null;
  expect(sceneArt(scene, { revealed: true })).toBe("judgement-seal");
  expect(scene.visual!.victory.winningPlayerIds).toEqual([]);
});
test("minimal terminal keeps a neutral emblem until the typed primary is revealed", () => {
  const doc = document();
  doc.events[2] = {
    ...doc.events[2]!,
    type: "game_over",
    payload: {
      winner: null,
      reason: "recorded_terminal",
      outcome: outcomes[4]!,
      decidedAt: { day: 1, phase: "night", checkpoint: "night_settled" },
    },
  };
  const plan = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    theme: { id: "minimal-v1" },
  });
  const shot = plan.shots.at(-1)!;
  const before = renderToStaticMarkup(<VideoFrame plan={plan} frame={shot.from + 23} />);
  const after = renderToStaticMarkup(<VideoFrame plan={plan} frame={shot.from + 24} />);
  expect(before).toContain('data-end-emblem="unknown"');
  expect(after).toContain('data-end-emblem="relationship"');
  expect(after).not.toContain('data-end-emblem="good"');
});
test("terminal emphasis-only edits retain the exact original caption as an explicitly requested annotation", () => {
  const doc = document();
  doc.events[2] = {
    ...doc.events[2]!,
    type: "game_over",
    payload: {
      winner: "wolf",
      reason: "recorded_terminal",
      outcome: outcomes[1]!,
      decidedAt: { day: 1, phase: "night", checkpoint: "night_settled" },
    },
  };
  const plan = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    edits: [{ anchor: { seq: 3, type: "game_over" }, emphasis: [{ text: "狼人" }] }],
  });
  const shot = plan.shots.at(-1)!;
  expect(shot.scene.bodySource).toBe("event");
  expect(shot.scene.emphasis[0]!.text).toBe("狼人");
  const html = renderToStaticMarkup(<VideoFrame plan={plan} frame={shot.from + 24} />);
  expect(html).toContain("data-end-editorial");
  expect(html).toContain("<mark");
  expect(html).toContain('data-content-block="outcome"');
});
test("a partial God initial roster is display-only and original source identity never changes", () => {
  const doc = document();
  doc.players = [];
  doc.events[0] = {
    ...doc.events[0]!,
    type: "god_private_game_info",
    payload: {
      boardSize: 2,
      players: [
        { id: 1, seat: 2, role: "witch", camp: "good" },
        { id: 2, seat: 1, role: "wolf", camp: "wolf" },
      ],
    },
  };
  const original = getVideoSourceIdentity(doc);
  expect(replayDisplayRoster(doc).source).toBe("recorded_initialization");
  const plan = compileVideoPlan(doc);
  expect(plan.source).toEqual(original);
  expect(plan.playersPresentation.map((player) => [player.playerId, player.seat])).toEqual([
    [2, 1],
    [1, 2],
  ]);
  expect(doc.players).toEqual([]);
  doc.events[0]!.payload.players = [
    { id: 1, role: "witch", camp: "good" },
    { id: 1, role: "wolf", camp: "wolf" },
  ];
  expect(replayDisplayRoster(doc).source).toBe("missing");
});
test("reader diagnostics distinguish known payloads, unknown types and malformed known records", () => {
  const doc = document();
  expect(interpretVideoEvent(doc.events[1], [1, 2]).readerStatus).toBe("known");
  expect(
    interpretVideoEvent({ ...doc.events[0]!, type: "future_event" }, [1, 2]).readerStatus,
  ).toBe("unrecognized");
  expect(
    interpretVideoEvent({ ...doc.events[1]!, payload: { actorId: 90 } }, [1, 2]).readerStatus,
  ).toBe("invalid_payload");
  const facts: ReplayFact[] = doc.facts!;
  expect(facts[0]!.afterSeq).toBe(0);
});
