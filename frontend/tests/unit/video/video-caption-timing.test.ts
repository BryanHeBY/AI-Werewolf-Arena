/**
 * 单元测试负责字幕与自动配音元数据的揭晓时钟。输入为双页正文、晚impact与极短显式镜头，输出独立字面页边界和编译冲突。
 * 不从默认实现计算预期；广播phase／fallback／结算／God事实在100帧揭晓，80帧阅读区的第二页应从140帧开始，旧布局与发言仍从0计时。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { buildVideoFrame } from "../../../src/video/frame";
import { getVideoSourceIdentity } from "../../../src/video/source";
import type { VideoSceneCues, VideoScript } from "../../../src/video/types";

const body = "x".repeat(216) + "y".repeat(216);
function replay(event: Pick<ReplayEvent, "type" | "payload">): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "caption-timing",
    meta: { board: "test", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: "villager", camp: "good" }],
    events: [{ seq: 1, day: 1, phase: "night", timestamp: "2026-01-01T00:00:00Z", ...event }],
  };
}
function options(document: ReplayDocument, value: Omit<VideoScript, "source">): VideoScript {
  return { source: getVideoSourceIdentity(document), ...value };
}
const cues: VideoSceneCues = { establish: 0, travel: 8, impact: 100, settled: 120 };

test("phase, fallback and settlement caption pages start after the reveal instead of discarding the first page", () => {
  for (const event of [
    { type: "phase_changed", payload: { phase: "night" } },
    { type: "future_unknown", payload: {} },
    { type: "night_resolved", payload: { deaths: [] } },
  ]) {
    const document = replay(event);
    const plan = compileVideoPlan(
      document,
      options(document, {
        layout: "broadcast-v1",
        edits: [
          {
            anchor: { seq: 1, type: event.type },
            caption: body,
            durationFrames: 180,
            scene: { cues },
          },
        ],
      }),
    );
    expect(buildVideoFrame(plan, 99).captionPageIndex).toBe(0);
    expect(buildVideoFrame(plan, 100).caption).toBe("x".repeat(216));
    expect(buildVideoFrame(plan, 139).captionPageIndex).toBe(0);
    expect(buildVideoFrame(plan, 140).caption).toBe("y".repeat(216));
    expect(buildVideoFrame(plan, 179).captionPageIndex).toBe(1);
    expect(buildVideoFrame(plan, 100).captionRange).toEqual({ from: 100, durationFrames: 80 });
    expect(plan.shots[0]!.speech).toEqual([
      { speaker: "god", text: body, from: 100, durationFrames: 80 },
    ]);
  }
});

test("God fact captions use the same reveal interval while an explicit speech scene retains the whole-shot clock", () => {
  const document = replay({ type: "phase_changed", payload: { phase: "night" } });
  document.events = [];
  document.factCoverage = { committedDeaths: 1 };
  document.facts = [
    {
      seq: 1,
      afterSeq: 0,
      kind: "potion_stock",
      day: 1,
      actorId: 1,
      abilityId: "witch",
      heal: 1,
      poison: 1,
    },
  ];
  const plan = compileVideoPlan(
    document,
    options(document, {
      layout: "broadcast-v1",
      factEdits: [
        {
          anchor: { seq: 1, kind: "potion_stock" },
          caption: body,
          durationFrames: 180,
          scene: { cues },
        },
      ],
    }),
  );
  expect(buildVideoFrame(plan, 100).caption).toBe("x".repeat(216));
  expect(buildVideoFrame(plan, 140).captionOffset).toBe(216);
  expect(buildVideoFrame(plan, 140).caption).toBe("y".repeat(216));
  const speech = replay({ type: "phase_changed", payload: { phase: "night" } });
  const spoken = compileVideoPlan(
    speech,
    options(speech, {
      layout: "broadcast-v1",
      edits: [
        {
          anchor: { seq: 1, type: "phase_changed" },
          durationFrames: 180,
          caption: body,
          scene: { kind: "speech", cues },
        },
      ],
    }),
  );
  expect(buildVideoFrame(spoken, 89).captionPageIndex).toBe(0);
  expect(buildVideoFrame(spoken, 90).captionPageIndex).toBe(1);
  expect(buildVideoFrame(spoken, 90).captionRange).toEqual({ from: 0, durationFrames: 180 });
});

test("short automatic cues reserve a frame per page, while impossible explicit reveal timing reports a conflict", () => {
  const document = replay({ type: "phase_changed", payload: { phase: "night" } });
  const edit = { anchor: { seq: 1, type: "phase_changed" }, caption: body, durationFrames: 10 };
  const plan = compileVideoPlan(
    document,
    options(document, { layout: "broadcast-v1", edits: [edit] }),
  );
  expect(plan.shots[0]!.scene.cues.impact).toBe(8);
  expect(buildVideoFrame(plan, 8).caption).toBe("x".repeat(216));
  expect(buildVideoFrame(plan, 9).caption).toBe("y".repeat(216));
  expect(() =>
    compileVideoPlan(
      document,
      options(document, {
        layout: "broadcast-v1",
        edits: [{ ...edit, scene: { cues: { impact: 9 } } }],
      }),
    ),
  ).toThrow("video_caption_reveal_conflict");
  expect(() =>
    compileVideoPlan(
      document,
      options(document, { layout: "broadcast-v1", edits: [{ ...edit, durationFrames: 1 }] }),
    ),
  ).toThrow("video_caption_duration_too_short");
});

test("legacy pages and default explanatory holds stay readable from the start", () => {
  const document = replay({ type: "phase_changed", payload: { phase: "night" } });
  const legacy = compileVideoPlan(
    document,
    options(document, {
      edits: [
        {
          anchor: { seq: 1, type: "phase_changed" },
          caption: body,
          durationFrames: 180,
          scene: { cues },
        },
      ],
    }),
  );
  expect(buildVideoFrame(legacy, 90).captionPageIndex).toBe(1);
  expect(buildVideoFrame(legacy, 90).captionRange).toEqual({ from: 0, durationFrames: 180 });
  const held = compileVideoPlan(
    document,
    options(document, {
      layout: "broadcast-v1",
      holds: [
        {
          id: "explain",
          after: { seq: 1, type: "phase_changed" },
          caption: body,
          durationFrames: 180,
        },
      ],
    }),
  );
  const shot = held.shots.find((item) => item.id === "hold:explain")!;
  expect(buildVideoFrame(held, shot.from).caption).toBe("x".repeat(216));
  expect(buildVideoFrame(held, shot.from).captionRange).toEqual({ from: 0, durationFrames: 180 });
  expect(buildVideoFrame(held, shot.from + 90).caption).toBe("y".repeat(216));
});
