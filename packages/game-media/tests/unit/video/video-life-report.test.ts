/**
 * 单元测试负责结算首波与后续连锁波的独立验收。输入为手写原事件/生命事实，输出镜头名单、揭晓游标及跳转锚点。
 * 不读取后端规则或私有归档；缺事实只能省略中间等待页，不能把名单推成死亡或吞掉后续波。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame, getVideoEventFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";

function recording(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "independent-life-report-waves",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players: [1, 2, 3].map((player_id) => ({ player_id, role: "villager", camp: "good" })),
    events: [
      {
        seq: 1,
        timestamp: "t",
        day: 4,
        phase: "day",
        type: "phase_changed",
        payload: { phase: "day", day: 4 },
      },
      {
        seq: 2,
        timestamp: "t",
        day: 4,
        phase: "day",
        type: "night_resolved",
        payload: { deaths: [1, 2] },
      },
      {
        seq: 3,
        timestamp: "t",
        day: 4,
        phase: "day",
        type: "additional_deaths",
        payload: { deaths: [3] },
      },
    ],
    factCoverage: { committedDeaths: 1 },
    facts: [
      {
        seq: 1,
        afterSeq: 2,
        kind: "life_committed",
        day: 4,
        playerId: 1,
        alive: false,
        causes: ["wolf_kill"],
        waveId: 6,
      },
      {
        seq: 2,
        afterSeq: 2,
        kind: "life_committed",
        day: 4,
        playerId: 2,
        alive: false,
        causes: ["poison"],
        waveId: 6,
      },
      {
        seq: 3,
        afterSeq: 2,
        kind: "life_committed",
        day: 4,
        playerId: 3,
        alive: false,
        causes: ["charm"],
        waveId: 7,
      },
    ],
  };
}
const lives = (plan: ReturnType<typeof compileVideoPlan>, frame: number) =>
  buildVideoFrame(plan, frame).currentView.players.map((player) => player.alive);

test("a confirmed first wave and a following charm or shot wave never create an intermediate waiting shot", () => {
  for (const single of [false, true]) {
    const doc = recording();
    if (single) {
      doc.events[1]!.payload.deaths = [1];
      const chained = doc.facts![2]!;
      if (chained.kind !== "life_committed") throw new Error("life_fixture_invalid");
      doc.facts = [doc.facts![0]!, { ...chained, seq: 2, causes: ["shot"] }];
    }
    const original = JSON.stringify(doc);
    const plan = compileVideoPlan(doc),
      first = plan.shots[1]!,
      chain = plan.shots[2]!;
    expect(plan.shots.map((shot) => shot.id)).toEqual([
      "event:1",
      "event:2",
      single ? "fact:2" : "fact:3",
    ]);
    expect(first.sourceFacts).toEqual(single ? [1] : [1, 2]);
    expect(chain.sourceFacts).toEqual([single ? 2 : 3]);
    expect(first.durationFrames).toBe(60);
    expect(first.scene.visual?.life?.committed).toBe(true);
    expect(first.scene.visual?.life?.waveId).toBe(6);
    expect(lives(plan, first.from + 2)).toEqual([true, true, true]);
    expect(lives(plan, first.from + 3)).toEqual([false, single, true]);
    expect(lives(plan, chain.from + 2)).toEqual([false, single, true]);
    expect(lives(plan, chain.from + 3)).toEqual([false, single, false]);
    expect(lives(plan, first.from + 2)).toEqual([true, true, true]);
    expect(getVideoEventFrame(plan, 3)).toBe(plan.durationFrames - 1);
    expect(buildVideoFrame(plan, plan.durationFrames - 1).sourceSeq).toBe(3);
    expect(
      plan.shots.some((shot) => /等待死亡确认|awaiting death confirmation/.test(shot.scene.body)),
    ).toBe(false);
    expect(JSON.stringify(doc)).toBe(original);
  }
});

test("a trailing fact edit does not disable the paired first wave, but an edited first fact keeps its own reveal", () => {
  const doc = recording();
  const source = getVideoSourceIdentity(doc);
  const trailing = compileVideoPlan(doc, {
    source,
    layout: "broadcast-v1",
    pacing: "narration",
    factEdits: [{ anchor: { seq: 3, kind: "life_committed" }, caption: "连锁结算" }],
  });
  expect(trailing.shots.map((shot) => shot.id)).toEqual(["event:1", "event:2", "fact:3"]);
  expect(trailing.shots[1]!.sourceFacts).toEqual([1, 2]);
  expect(trailing.shots[2]!.scene.body).toBe("连锁结算");
  const separate = compileVideoPlan(doc, {
    source,
    layout: "broadcast-v1",
    pacing: "narration",
    factEdits: [{ anchor: { seq: 1, kind: "life_committed" }, durationFrames: 90 }],
  });
  expect(separate.shots.map((shot) => shot.id)).toEqual(["event:1", "fact:1", "fact:2", "fact:3"]);
  expect(lives(separate, separate.shots[1]!.from + 23)).toEqual([true, true, true]);
  expect(lives(separate, separate.shots[1]!.from + 24)).toEqual([false, true, true]);
  expect(getVideoEventFrame(separate, 2)).toBe(separate.shots[1]!.from + 24);
});

test("missing commits omit provisional narration, retain source navigation and never mark a reported player dead", () => {
  const doc = recording();
  doc.events = [doc.events[1]!].map((event) => ({ ...event, seq: 1 }));
  doc.facts = [];
  const plan = compileVideoPlan(doc);
  expect(plan.shots.map((shot) => shot.id)).toEqual(["context"]);
  expect(getVideoEventFrame(plan, 1)).toBe(plan.durationFrames - 1);
  expect(lives(plan, plan.durationFrames - 1)).toEqual([true, true, true]);
  expect(buildVideoFrame(plan, plan.durationFrames - 1).sourceFactSeq).toBe(0);
  expect(plan.shots[0]!.scene.body).not.toContain("等待死亡确认");
  const explicit = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    edits: [{ anchor: { seq: 1, type: "night_resolved" }, caption: "导演保留的原始名单" }],
  });
  expect(explicit.shots[0]!.scene.body).toBe("导演保留的原始名单");
  expect(lives(explicit, explicit.durationFrames - 1)).toEqual([true, true, true]);
});

test("peaceful nights, old uncovered archives and invalid payloads remain distinguishable from provisional reports", () => {
  for (const kind of ["peaceful", "legacy", "invalid", "same-wave-tail"] as const) {
    const doc = recording();
    doc.events = doc.events.slice(0, 2);
    if (kind === "peaceful") {
      doc.events[1]!.payload.deaths = [];
      doc.facts = [];
    }
    if (kind === "legacy") {
      delete doc.factCoverage;
      delete doc.facts;
    }
    if (kind === "invalid") {
      doc.events[1]!.payload.deaths = [1, 99];
      doc.facts = [];
    }
    if (kind === "same-wave-tail") doc.facts = doc.facts!.map((fact) => ({ ...fact, waveId: 6 }));
    const plan = compileVideoPlan(doc);
    if (kind === "same-wave-tail") {
      expect(plan.shots.map((shot) => shot.id)).toEqual(["event:1", "fact:1"]);
      expect(plan.shots[1]!.sourceFacts).toEqual([1, 2, 3]);
    } else {
      expect(plan.shots.map((shot) => shot.id)).toEqual(["event:1", "event:2"]);
      if (kind === "legacy")
        expect(lives(plan, plan.durationFrames - 1)).toEqual([false, false, true]);
      if (kind === "invalid")
        expect(plan.shots[1]!.scene.visual?.fallbackReason).toBe("unknown_or_invalid_event");
    }
  }
});

test("a silent tail may advance an ordinary shot but never the author's fixed revisit state", () => {
  const doc = recording();
  doc.events = doc.events.slice(0, 2);
  doc.events.push({
    seq: 3,
    timestamp: "t",
    day: 4,
    phase: "day",
    type: "day_speech",
    payload: { actorId: 3, text: "原话中的等待确认应完整保留" },
  });
  doc.facts = [];
  const plan = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    pacing: "narration",
    edits: [{ anchor: { seq: 3, type: "day_speech" }, skip: true }],
    holds: [
      {
        id: "past",
        after: { seq: 3, type: "day_speech" },
        stateAt: { seq: 1, type: "phase_changed" },
        durationFrames: 30,
      },
    ],
  });
  const hold = plan.shots.at(-1)!;
  expect(hold.id).toBe("hold:past");
  expect(hold.stateCues.map((cue) => cue.throughSeq)).toEqual([1]);
  expect(buildVideoFrame(plan, plan.durationFrames - 1).sourceSeq).toBe(1);
  expect(getVideoEventFrame(plan, 2)).toBe(plan.shots[0]!.durationFrames - 1);
  const original = compileVideoPlan(doc);
  expect(original.shots.at(-1)!.scene.body).toBe("原话中的等待确认应完整保留");
});
