/**
 * 单元测试负责单局作者正文与语音覆盖契约。输入为独立原始发言、库存事实及event/fact两种脚本锚点，输出字面正文、来源和语音预期。
 * 不从编译结果生成期望；scene.body优先于caption，显式SpeechCue独立，旧布局没有覆盖时仍保留事件标签而不重复念前缀。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan } from "../../../src/video/compiler";
import { getVideoSourceIdentity } from "../../../src/video/source";
import type { VideoScript } from "../../../src/video/types";

function replay(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "text-overrides",
    meta: { board: "test", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: "witch", camp: "good" }],
    events: [
      {
        seq: 1,
        day: 1,
        phase: "day",
        timestamp: "2026-01-01T00:00:00Z",
        type: "day_speech",
        payload: { actorId: 1, text: "原始发言" },
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
        abilityId: "witch:potion",
        heal: 1,
        poison: 1,
      },
    ],
  };
}
function script(
  document: ReplayDocument,
  overrides: Omit<VideoScript, "source"> = {},
): VideoScript {
  return { source: getVideoSourceIdentity(document), ...overrides };
}

test("broadcast event and fact caption overrides reach body, caption pages and automatic narration in both locales", () => {
  const document = replay();
  const definition = script(document, {
    layout: "broadcast-v1",
    edits: [{ anchor: { seq: 1, type: "day_speech" }, caption: "导演发言说明" }],
    factEdits: [{ anchor: { seq: 1, kind: "potion_stock" }, caption: "导演库存说明" }],
  });
  for (const locale of ["zh-CN", "en"] as const) {
    const plan = compileVideoPlan(document, definition, { locale, timeZone: "UTC" });
    const event = plan.shots.find((shot) => shot.id === "event:1")!;
    const fact = plan.shots.find((shot) => shot.id === "fact:1")!;
    expect(event.captionPages).toEqual(["导演发言说明"]);
    expect(event.scene.body).toBe("导演发言说明");
    expect(event.scene.bodySource).toBe("script");
    expect(event.speech).toEqual([
      { speaker: "player:1", text: "导演发言说明", from: 0, durationFrames: 90 },
    ]);
    expect(fact.captionPages).toEqual(["导演库存说明"]);
    expect(fact.scene.body).toBe("导演库存说明");
    expect(fact.scene.bodySource).toBe("script");
    expect(fact.speech).toEqual([
      // 揭晓24后可读，落定40后仍有独立90帧静止阅读。
      { speaker: "god", text: "导演库存说明", from: 24, durationFrames: 106 },
    ]);
    expect(fact.scene.stock).toEqual({ actorId: 1, abilityId: "witch:potion", heal: 1, poison: 1 });
    expect(event.view.snapshot.event?.payload.text).toBe("原始发言");
  }
});

test("scene body wins over caption while hand-authored SpeechCue text and timing stay independent", () => {
  const document = replay();
  const narration = [{ speaker: "god" as const, text: "独立语音稿", from: 7, durationFrames: 11 }];
  const plan = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [
        {
          anchor: { seq: 1, type: "day_speech" },
          caption: "未选中的字幕",
          scene: { body: "场景正文优先" },
          speech: narration,
        },
      ],
      factEdits: [
        {
          anchor: { seq: 1, kind: "potion_stock" },
          caption: "未选中的库存字幕",
          scene: { body: "场景库存说明优先" },
          speech: narration,
        },
      ],
    }),
  );
  const event = plan.shots.find((shot) => shot.id === "event:1")!;
  const fact = plan.shots.find((shot) => shot.id === "fact:1")!;
  expect(event.captionPages).toEqual(["场景正文优先"]);
  expect(fact.captionPages).toEqual(["场景库存说明优先"]);
  expect(event.scene.body).toBe("场景正文优先");
  expect(fact.scene.body).toBe("场景库存说明优先");
  expect(event.scene.bodySource).toBe("script");
  expect(fact.scene.bodySource).toBe("script");
  expect(event.speech).toEqual(narration);
  expect(fact.speech).toEqual(narration);
  expect(plan.audio).toEqual([]);
});

test("empty authored text is intentional and old script default captions keep their event label", () => {
  const document = replay();
  const empty = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [{ anchor: { seq: 1, type: "day_speech" }, caption: "fallback", scene: { body: "" } }],
      factEdits: [{ anchor: { seq: 1, kind: "potion_stock" }, caption: "" }],
    }),
  );
  expect(empty.shots.find((shot) => shot.id === "event:1")!.captionPages).toEqual([""]);
  expect(empty.shots.find((shot) => shot.id === "fact:1")!.captionPages).toEqual([""]);
  expect(empty.shots.find((shot) => shot.id === "fact:1")!.scene.bodySource).toBe("script");
  const legacy = compileVideoPlan(document, script(document), { locale: "zh-CN", timeZone: "UTC" });
  const event = legacy.shots.find((shot) => shot.id === "event:1")!;
  expect(legacy.layout).toBe("legacy-ellipse-v1");
  expect(event.captionPages).toEqual(["1号发言：原始发言"]);
  expect(event.scene.bodySource).toBe("event");
  expect(event.speech).toEqual([
    { speaker: "player:1", text: "原始发言", from: 0, durationFrames: 90 },
  ]);
});

test("an editorial actor never changes the recorded dialogue author or its automatic voice", () => {
  const document = replay();
  document.players = Array.from({ length: 12 }, (_, index) => ({
    player_id: index + 1,
    role: "villager",
    camp: "good",
  }));
  document.events[0]!.payload = { actorId: 2, text: "这是2号的原话" };
  const original = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [{ anchor: { seq: 1, type: "day_speech" }, scene: { actorId: 12 } }],
    }),
  ).shots.find((shot) => shot.id === "event:1")!;
  expect(original.scene.bodySource).toBe("event");
  expect(original.scene.body).toBe("这是2号的原话");
  expect(original.scene.visual?.actorId).toBe(2);
  expect(original.scene.editorial).toEqual({ actorId: 12 });
  expect(original.speech).toEqual([
    { speaker: "player:2", text: "这是2号的原话", from: 0, durationFrames: 90 },
  ]);
  const authored = compileVideoPlan(
    document,
    script(document, {
      layout: "broadcast-v1",
      edits: [
        {
          anchor: { seq: 1, type: "day_speech" },
          scene: { actorId: 12, body: "编导改写说明" },
          speech: [{ speaker: "god", text: "独立旁白稿", from: 0, durationFrames: 31 }],
        },
      ],
    }),
  ).shots.find((shot) => shot.id === "event:1")!;
  expect(authored.scene.bodySource).toBe("script");
  expect(authored.scene.visual?.actorId).toBe(2);
  expect(authored.scene.editorial).toEqual({ actorId: 12 });
  expect(authored.speech).toEqual([
    { speaker: "god", text: "独立旁白稿", from: 0, durationFrames: 31 },
  ]);
});
