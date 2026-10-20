/** 导演片头和显式结算测试；独立手写死亡波验证开场无未来状态、追加波不提前提交。 */
import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoFrame } from "../../../src/video/VideoComposition";
import { compileVideoPlan, getVideoSourceIdentity, buildVideoFrame } from "../../../src/video/plan";
import {
  bindVideoSpeech,
  speechProjectFromPlan,
  type SpeechManifest,
  type VoiceProfile,
} from "../../../src/speech";

function recording(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "editorial",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players: [1, 2, 3].map((player_id) => ({ player_id, role: "villager", camp: "good" })),
    events: [
      {
        seq: 1,
        type: "phase_changed",
        payload: { phase: "night", day: 1 },
        timestamp: "t",
        day: 1,
        phase: "night",
      },
      {
        seq: 2,
        type: "night_resolved",
        payload: { deaths: [1, 2] },
        timestamp: "t",
        day: 1,
        phase: "day",
      },
    ],
    factCoverage: { committedDeaths: 1 },
    facts: [
      {
        seq: 1,
        afterSeq: 2,
        kind: "life_committed",
        day: 1,
        playerId: 1,
        alive: false,
        causes: ["poison"],
        waveId: 1,
      },
      {
        seq: 2,
        afterSeq: 2,
        kind: "life_committed",
        day: 1,
        playerId: 2,
        alive: false,
        causes: ["wolf_kill"],
        waveId: 1,
      },
      {
        seq: 3,
        afterSeq: 2,
        kind: "life_committed",
        day: 1,
        playerId: 3,
        alive: false,
        causes: ["charm"],
        waveId: 2,
      },
    ],
  };
}
test("an authored intro precedes all source events and an explicit settlement retains the next death wave", () => {
  const doc = recording();
  const plan = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    intro: [{ id: "title", durationFrames: 60, caption: "片头" }],
    edits: [
      {
        anchor: { seq: 2, type: "night_resolved" },
        durationFrames: 90,
        lifeFacts: [
          { seq: 1, kind: "life_committed" },
          { seq: 2, kind: "life_committed" },
        ],
      },
    ],
  });
  expect(plan.shots[0]!.id).toBe("intro:title");
  expect(plan.shots[0]!.stateCues[0]!.throughSeq).toBe(0);
  expect(buildVideoFrame(plan, 0).currentView.players.every((player) => player.alive)).toBe(true);
  const settlement = plan.shots.find((shot) => shot.eventSeq === 2)!;
  expect(settlement.sourceFacts).toEqual([1, 2]);
  const revealed = buildVideoFrame(plan, settlement.from + settlement.scene.cues.impact);
  expect(revealed.currentView.players.map((player) => player.alive)).toEqual([false, false, true]);
  expect(plan.shots.at(-1)!.id).toBe("fact:3");
});

test("a stage teaser uses its speaker for the native speech scene without an editorial actor label", () => {
  const doc = recording();
  const plan = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    intro: [
      {
        id: "teaser",
        durationFrames: 120,
        scene: { kind: "speech", title: "高能预告", body: "这是预告原话。", speaker: "player:3" },
        speech: [{ speaker: "player:3", text: "这是预告原话。" }],
      },
    ],
  });
  const html = renderToStaticMarkup(createElement(VideoFrame, { plan, frame: 30 }));
  expect(html).toContain("data-video-stage");
  expect(html).toContain('data-speech-speaker="3"');
  expect(html).not.toContain("data-editorial-actor");
  expect(html).not.toContain('data-layer-space="screen"');
});
test("opening credits survive plan serialization without entering narration or later scenes", () => {
  const doc = recording();
  const credits = {
    repository: "example/werewolf-arena",
    model: "test-model",
    agent: "Pi",
    features: ["独立会话", "工具调用"],
    description: "开源多智能体对局",
  };
  const intro = {
    id: "title",
    durationFrames: 270,
    scene: {
      kind: "phase" as const,
      title: "测试片名",
      body: "保留悬念的副标题",
      textLayout: "title" as const,
      credits,
    },
    speech: [{ speaker: "god" as const, text: "测试片名。" }],
  };
  const script = {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1" as const,
    intro: [intro],
  };
  const plan = JSON.parse(JSON.stringify(compileVideoPlan(doc, script)));
  expect(plan.shots[0].scene.credits).toEqual(credits);
  expect(
    plan.shots.slice(1).every((shot: { scene: { credits?: unknown } }) => !shot.scene.credits),
  ).toBe(true);
  const html = renderToStaticMarkup(createElement(VideoFrame, { plan, frame: 30 }));
  expect(html).toContain("data-announcement-title");
  expect(html).toContain("data-opening-credits");
  expect(html).toContain('href="https://github.com/example/werewolf-arena"');
  expect(html).toContain("test-model");
  expect(html).toContain("Pi");
  expect(html).toContain("独立会话");
  expect(plan.shots[0].speech.map((line: { text: string }) => line.text)).toEqual(["测试片名。"]);
  expect(buildVideoFrame(plan, 30).sourceSeq).toBe(0);
  expect(() =>
    compileVideoPlan(doc, {
      ...script,
      intro: [
        {
          ...intro,
          scene: { ...intro.scene, credits: { ...credits, repository: "https://example.com" } },
        },
      ],
    }),
  ).toThrow("video_scene_credits_invalid");
});
test("life references cannot pull a future prefix or merge distinct waves", () => {
  const doc = recording();
  const script = {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1" as const,
    edits: [
      {
        anchor: { seq: 1, type: "phase_changed" },
        lifeFacts: [{ seq: 1, kind: "life_committed" as const }],
      },
    ],
  };
  expect(() => compileVideoPlan(doc, script)).toThrow("life_fact_anchor_invalid");
  script.edits = [
    {
      anchor: { seq: 2, type: "night_resolved" },
      lifeFacts: [1, 2, 3].map((seq) => ({ seq, kind: "life_committed" as const })),
    },
  ];
  expect(() => compileVideoPlan(doc, script)).toThrow("life_fact_group_invalid");
});

test("shot overrides preserve native grouping and reject an ID that no longer exists", () => {
  const doc = recording();
  const original = compileVideoPlan(doc);
  const edited = compileVideoPlan(doc, {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1",
    shotEdits: [{ id: "event:2", scene: { title: "微调后的标题" } }],
  });
  expect(edited.shots.map((shot) => [shot.id, shot.sourceSeqs, shot.sourceFacts])).toEqual(
    original.shots.map((shot) => [shot.id, shot.sourceSeqs, shot.sourceFacts]),
  );
  expect(edited.shots.find((shot) => shot.id === "event:2")!.scene.title).toBe("微调后的标题");
  expect(doc.events[1]!.payload.deaths).toEqual([1, 2]);
  expect(() =>
    compileVideoPlan(doc, {
      source: getVideoSourceIdentity(doc),
      shotEdits: [{ id: "event:999", caption: "过期覆盖" }],
    }),
  ).toThrow("video_shot_edit_missing:event:999");
});

test("prepared audio changes the clock while retaining complete speech and source groups", () => {
  const doc = recording();
  const text = "这是一段需要完整保留的玩家发言。".repeat(30);
  doc.events.push({
    seq: 3,
    type: "day_speech",
    payload: { actorId: 3, text },
    day: 2,
    phase: "day",
    timestamp: "t",
  });
  const script = { source: getVideoSourceIdentity(doc), layout: "broadcast-v1" as const };
  const plan = compileVideoPlan(doc, script);
  const voice: VoiceProfile = {
    provider: "tencent",
    voiceId: 402002,
    name: "测试声线",
    tier: "ultra-natural",
  };
  const dialogue = speechProjectFromPlan(plan, { god: voice, "player:3": voice });
  const manifest: SpeechManifest = Object.fromEntries(
    dialogue.lines.map((line) => [
      line.id,
      {
        key: line.id,
        text: line.text,
        voice,
        take: "1",
        gapMs: 160,
        src: "voice.wav",
        sha256: "test",
        samples: 24000 * 100,
        sampleRate: 24000,
        chunks: [{ text: line.text, fromSample: 0, samples: 24000 * 100 }],
      },
    ]),
  );
  const voiced = compileVideoPlan(doc, bindVideoSpeech(script, plan, dialogue, manifest));
  expect(voiced.shots.map((shot) => [shot.id, shot.sourceSeqs, shot.sourceFacts])).toEqual(
    plan.shots.map((shot) => [shot.id, shot.sourceSeqs, shot.sourceFacts]),
  );
  const speech = voiced.shots.find((shot) => shot.id === "event:3")!;
  expect(speech.scene.body).toBe(text);
  expect(speech.captionPages).toEqual([text]);
  expect(speech.reading?.mode).toBe("flow");
  expect(speech.speech[0]!.durationFrames).toBe(3000);
  expect(voiced.audio.find((cue) => cue.speaker === "player:3")!.durationFrames).toBe(3000);
  expect(() =>
    compileVideoPlan(doc, {
      ...bindVideoSpeech(script, plan, dialogue, manifest),
      maxDurationFrames: 1800,
    }),
  ).toThrow("video_duration_budget_exceeded");
});

test("an informational stage holds its full text longer than a short voice introduction", () => {
  const doc = recording();
  const text = "完整规则说明。".repeat(20);
  const script = {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1" as const,
    intro: [
      {
        id: "rules",
        durationFrames: 660,
        readingClock: "flow" as const,
        scene: { kind: "phase" as const, title: "规则", body: text, speaker: "god" as const },
        speech: [{ speaker: "god" as const, text: "规则看屏幕。" }],
      },
    ],
  };
  const plan = compileVideoPlan(doc, script);
  const voice: VoiceProfile = {
    provider: "tencent",
    voiceId: 402002,
    name: "云大围",
    tier: "ultra-natural",
  };
  const dialogue = speechProjectFromPlan(plan, { god: voice });
  const manifest: SpeechManifest = Object.fromEntries(
    dialogue.lines.map((line) => [
      line.id,
      {
        key: line.id,
        text: line.text,
        voice,
        take: "1",
        gapMs: 160,
        src: "voice.wav",
        sha256: "test",
        samples: 24000,
        sampleRate: 24000,
        chunks: [],
      },
    ]),
  );
  const voiced = compileVideoPlan(doc, bindVideoSpeech(script, plan, dialogue, manifest));
  expect(voiced.shots[0]!.durationFrames).toBe(660);
  expect(voiced.shots[0]!.captionPages).toEqual([text]);
  expect(voiced.shots[0]!.speech[0]!.durationFrames).toBe(30);
});

test("prepared voice preserves the current short animation and its recorded reveal boundary", () => {
  const doc = recording();
  const script = {
    source: getVideoSourceIdentity(doc),
    layout: "broadcast-v1" as const,
    pacing: "narration" as const,
  };
  const plan = compileVideoPlan(doc, script);
  const voice: VoiceProfile = {
    provider: "tencent",
    voiceId: 402002,
    name: "测试声线",
    tier: "ultra-natural",
  };
  const dialogue = speechProjectFromPlan(plan, { god: voice });
  const manifest: SpeechManifest = Object.fromEntries(
    dialogue.lines.map((line) => [
      line.id,
      {
        key: line.id,
        text: line.text,
        voice,
        take: "1",
        gapMs: 160,
        src: "voice.wav",
        sha256: "test",
        samples: 24000 * 5,
        sampleRate: 24000,
        chunks: [],
      },
    ]),
  );
  const voiced = compileVideoPlan(doc, bindVideoSpeech(script, plan, dialogue, manifest));
  const phase = voiced.shots[0]!;
  expect(phase.durationFrames).toBeGreaterThan(60);
  expect(phase.scene.cues).toEqual({ establish: 0, travel: 1, impact: 3, settled: 9 });
  expect(phase.speech[0]!.from).toBe(3);
  expect(phase.speech[0]!.durationFrames).toBe(150);
  expect(buildVideoFrame(voiced, 2).sourceSeq).toBe(0);
  expect(buildVideoFrame(voiced, 3).sourceSeq).toBe(1);
});
