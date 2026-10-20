/**
 * 单元测试负责JSONL语音稿、真实采样驱动与连续人声轨验收。输入为独立手写对局、台词和PCM，不调用游戏或语音服务。
 * 字面帧数核对固定停留被替换、增量时钟、警徽与死亡揭晓、字幕和损坏音频拒绝；不以实现自产预期。
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  compileVideoPlan,
  buildVideoFrame,
  getVideoSourceIdentity,
  type VideoScript,
} from "../../../src/video/plan";
import {
  applySpeechScript,
  parseSpeechScriptJsonl,
  speechScriptJsonl,
  speechProjectFromScript,
  type SpeechScript,
} from "../../../src/speech-script";
import {
  bindVideoSpeech,
  preparedSpeech,
  videoSpeechLineId,
  type SpeechManifest,
  type VoiceProfile,
} from "../../../src/speech";
import { LEGACY_SPEECH_TIMING } from "../../../src/speech-clock";
import { VideoFrame } from "../../../src/video/VideoComposition";
import { speechScriptReport } from "../../../../../apps/video/scripts/generate-speech-script";
import { speechRequests } from "../../../../../apps/video/scripts/tts/prepare";
import { compileSpeechVideo } from "../../../../../apps/video/scripts/compile-speech-video";
import { prepareVideo } from "../../../../../apps/video/scripts/prepare-video";
import { assembleSpeechAudio } from "../../../../../apps/video/scripts/tts/assemble";
import { writePcmWav, readPcmWav } from "../../../../../apps/video/scripts/tts/wav";

function fixture() {
  const doc: ReplayDocument = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "speech-script-test",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players: [1, 2].map((player_id) => ({ player_id, role: "villager", camp: "good" })),
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
        type: "day_speech",
        payload: { actorId: 1, text: "玩家完整原话🐾。" },
        timestamp: "t",
        day: 1,
        phase: "day",
      },
      {
        seq: 3,
        type: "sheriff_vote_summary",
        payload: {
          votes: [
            { actorId: 1, targetId: 2, abstain: false },
            { actorId: 2, targetId: 2, abstain: false },
          ],
          winnerId: 2,
        },
        timestamp: "t",
        day: 1,
        phase: "day",
      },
      {
        seq: 4,
        type: "sheriff_elected",
        payload: { winnerId: 2, candidates: [1, 2], tally: { "2": 2 } },
        timestamp: "t",
        day: 1,
        phase: "day",
      },
      {
        seq: 5,
        type: "night_resolved",
        payload: { deaths: [1] },
        timestamp: "t",
        day: 2,
        phase: "day",
      },
    ],
    factCoverage: { committedDeaths: 1 },
    facts: [
      {
        seq: 1,
        afterSeq: 5,
        kind: "life_committed",
        day: 2,
        playerId: 1,
        alive: false,
        causes: ["wolf_kill"],
        waveId: 1,
      },
    ],
  };
  const source = getVideoSourceIdentity(doc);
  const script: VideoScript = {
    source,
    layout: "broadcast-v1",
    fps: 30,
    intro: [
      {
        id: "title",
        durationFrames: 900,
        scene: { title: "测试片头", body: "片头", speaker: "god" },
      },
    ],
  };
  const document: SpeechScript = {
    header: { type: "script", version: 1, source, chunkGapMs: 0 },
    scenes: [
      {
        type: "scene",
        id: "intro:title",
        title: "测试片头",
        source: { eventSeqs: [], factSeqs: [] },
        lines: [
          { id: "opening", kind: "narration", speaker: "god", text: "片头。", cue: "impact" },
        ],
      },
      {
        type: "scene",
        id: "event:1",
        title: "夜晚",
        source: { eventSeqs: [1], factSeqs: [] },
        lines: [
          { id: "night", kind: "narration", speaker: "god", text: "天黑请闭眼。", cue: "impact" },
        ],
      },
      {
        type: "scene",
        id: "event:2",
        title: "发言",
        source: { eventSeqs: [2], factSeqs: [] },
        lines: [
          {
            id: "player",
            kind: "dialogue",
            speaker: "player:1",
            text: "玩家完整原话🐾。",
            cue: "impact",
          },
        ],
      },
      {
        type: "scene",
        id: "event:3",
        title: "警长票型",
        source: { eventSeqs: [3, 4], factSeqs: [] },
        lines: [
          { id: "votes", kind: "narration", speaker: "god", text: "投票结束。" },
          {
            id: "elected",
            kind: "narration",
            speaker: "god",
            text: "2号当选警长。",
            cue: "result",
          },
        ],
      },
      {
        type: "scene",
        id: "event:5",
        title: "夜报",
        source: { eventSeqs: [5], factSeqs: [1] },
        lines: [
          { id: "morning", kind: "narration", speaker: "god", text: "天亮了。" },
          { id: "death", kind: "narration", speaker: "god", text: "昨夜1号出局。", cue: "impact" },
        ],
      },
    ],
  };
  const voice: VoiceProfile = {
    provider: "tencent",
    voiceId: 402002,
    name: "测试",
    tier: "ultra-natural",
    sampleRate: 24000,
  };
  const project = speechProjectFromScript(document, { god: voice, "player:1": voice });
  const manifest: SpeechManifest = Object.fromEntries(
    project.lines.map((line) => [
      line.id,
      {
        key: line.id,
        text: line.text,
        voice,
        take: "1",
        gapMs: 0,
        src: `audio/${line.id}.wav`,
        sha256: "test",
        samples: line.id === "player" || line.id === "elected" ? 48000 : 24000,
        sampleRate: 24000,
        chunks: [],
        alignment: {
          source: "provider" as const,
          spans: [{ text: line.text, startMs: 0, endMs: 900 }],
        },
      },
    ]),
  );
  return { doc, script, document, project, manifest, voice };
}
test("JSONL retains raw Unicode dialogue, rejects absolute author clocks and duplicate line IDs", () => {
  const { document } = fixture();
  expect(parseSpeechScriptJsonl(speechScriptJsonl(document))).toEqual(document);
  expect(() => parseSpeechScriptJsonl("{broken}")).toThrow("speech_script_jsonl_invalid");
  const wrong = structuredClone(document) as SpeechScript & {
    scenes: Array<Record<string, unknown>>;
  };
  Object.assign(wrong.scenes[0]!, { from: 300 });
  expect(() => parseSpeechScriptJsonl(speechScriptJsonl(wrong))).toThrow(
    "speech_script_scene_invalid",
  );
  const duplicate = structuredClone(document);
  duplicate.scenes[1]!.lines[0]!.id = "opening";
  expect(() => parseSpeechScriptJsonl(speechScriptJsonl(duplicate))).toThrow(
    "speech_script_line_invalid",
  );
});
test("legacy and JSONL binding use the same explicitly selected clock, including the final tail", () => {
  const { doc, script, document, project, manifest } = fixture();
  document.header.timing = LEGACY_SPEECH_TIMING;
  const plan = compileVideoPlan(doc, script);
  const bound = applySpeechScript(script, plan, document, { project, manifest });
  const lineId = videoSpeechLineId(plan.shots[0]!.id, 0);
  const legacy = bindVideoSpeech(
    script,
    plan,
    {
      ...project,
      timing: LEGACY_SPEECH_TIMING,
      lines: plan.shots.flatMap((shot, index) =>
        document.scenes[index]!.lines.map((line, i) => ({
          ...line,
          id: videoSpeechLineId(shot.id, i),
        })),
      ),
    },
    Object.fromEntries(
      plan.shots.flatMap((shot, index) =>
        document.scenes[index]!.lines.map((line, i) => [
          videoSpeechLineId(shot.id, i),
          manifest[line.id]!,
        ]),
      ),
    ),
  );
  expect(lineId).toBe("intro-title-0");
  expect(bound.timeline.scenes[0]!.durationFrames).toBe(48);
  expect(legacy.shotEdits![0]!.durationFrames).toBe(48);
});
test("life facts are rejected outside an event edit rather than silently ignored", () => {
  const { doc, script } = fixture();
  Object.assign(script.intro![0]!, { lifeFacts: [{ seq: 999, kind: "life_committed" }] });
  expect(() => compileVideoPlan(doc, script)).toThrow("video_intro_life_facts_unavailable");
  const factScript = fixture().script;
  Object.assign(factScript, {
    factEdits: [{ anchor: { seq: 1, kind: "life_committed" }, lifeFacts: [] }],
  });
  expect(() => compileVideoPlan(doc, factScript)).toThrow("video_fact_edit_life_facts_unavailable");
  const holdScript = fixture().script;
  Object.assign(holdScript, {
    holds: [
      { id: "hold", after: { seq: 1, type: "phase_changed" }, durationFrames: 30, lifeFacts: [] },
    ],
  });
  expect(() => compileVideoPlan(doc, holdScript)).toThrow("video_hold_life_facts_unavailable");
  const invalidEventScript = fixture().script;
  Object.assign(invalidEventScript, {
    edits: [{ anchor: { seq: 1, type: "phase_changed" }, lifeFacts: null }],
  });
  expect(() => compileVideoPlan(doc, invalidEventScript)).toThrow("video_life_fact_anchor_invalid");
});
test("author narration keeps independent casting, audio, subtitles and labels before the God host", () => {
  const { doc, script, document, project, manifest, voice } = fixture();
  document.scenes[0]!.lines[0]!.speaker = "narrator";
  const authorVoice: VoiceProfile = {
    provider: "tencent",
    voiceId: 403003,
    name: "作者",
    tier: "ultra-natural",
    sampleRate: 24000,
  };
  const parsed = parseSpeechScriptJsonl(speechScriptJsonl(document));
  const speech = speechProjectFromScript(parsed, { ...project.casting, narrator: authorVoice });
  manifest.opening!.voice = authorVoice;
  const requests = speechRequests(speech);
  expect(requests[0]!.voice.voiceId).toBe(403003);
  expect(requests[1]!.voice.voiceId).toBe(402002);
  const bound = applySpeechScript(script, compileVideoPlan(doc, script), parsed, {
    project: speech,
    manifest,
  });
  const plan = compileVideoPlan(doc, bound.script);
  expect(plan.shots[0]!.scene.speaker).toBe("narrator");
  expect(plan.audio.slice(0, 2).map((cue) => [cue.speaker, cue.from])).toEqual([
    ["narrator", 0],
    ["god", 30],
  ]);
  expect(plan.subtitles![0]!.speaker).toBe("narrator");
  expect(bound.timeline.scenes[0]!.lines[0]!.speaker).toBe("narrator");
  const opening = renderToStaticMarkup(createElement(VideoFrame, { plan, frame: 0 }));
  expect(opening).toContain("作者旁白");
  expect(opening).not.toContain("上帝播报");
  expect(renderToStaticMarkup(createElement(VideoFrame, { plan, frame: 30 }))).toContain(
    "上帝播报",
  );
  const openingReport = speechScriptReport(parsed).split("<article>")[1]!.split("</article>")[0]!;
  expect(openingReport).toContain("<b>作者旁白</b>");
  expect(openingReport).not.toContain("上帝");
  speech.casting.god = { ...voice, voiceId: 402001 };
  expect(preparedSpeech(speech, manifest, "opening", 30).cue.speaker).toBe("narrator");
  expect(() => preparedSpeech(speech, manifest, "night", 30)).toThrow("speech_stale:night");
  const invalid = structuredClone(parsed);
  invalid.scenes[0]!.lines[0]!.kind = "dialogue";
  expect(() => parseSpeechScriptJsonl(speechScriptJsonl(invalid))).toThrow(
    "speech_script_line_invalid",
  );
});
test("audio replaces all reading floors, stays contiguous and reveals absorbed results at the spoken result", () => {
  const { doc, script, document, project, manifest } = fixture();
  const base = compileVideoPlan(doc, script);
  expect(base.shots.map((s) => s.id)).toEqual([
    "intro:title",
    "event:1",
    "event:2",
    "event:3",
    "event:5",
  ]);
  const bound = applySpeechScript(script, base, document, { project, manifest });
  const plan = compileVideoPlan(doc, bound.script);
  expect(plan.shots.map((s) => [s.from, s.durationFrames])).toEqual([
    [0, 30],
    [30, 30],
    [60, 60],
    [120, 90],
    [210, 60],
  ]);
  expect(plan.durationFrames).toBe(270);
  expect(plan.audio.map((c) => [c.from, c.durationFrames])).toEqual([
    [0, 30],
    [30, 30],
    [60, 60],
    [120, 30],
    [150, 60],
    [210, 30],
    [240, 30],
  ]);
  expect(buildVideoFrame(plan, 149).currentView.players[1]!.isSheriff).toBe(false);
  expect(buildVideoFrame(plan, 150).currentView.players[1]!.isSheriff).toBe(true);
  expect(buildVideoFrame(plan, 239).currentView.players[0]!.alive).toBe(true);
  expect(buildVideoFrame(plan, 240).currentView.players[0]!.alive).toBe(false);
  expect(plan.shots[2]!.speech[0]!.text).toBe("玩家完整原话🐾。");
  expect(plan.subtitles!.map((c) => c.from)).toEqual([0, 30, 60, 120, 150, 210, 240]);
  manifest.night!.samples = 48000;
  const longer = compileVideoPlan(
    doc,
    applySpeechScript(script, base, document, { project, manifest }).script,
  );
  expect(longer.shots.map((s) => s.from)).toEqual([0, 30, 90, 150, 240]);
  expect(longer.durationFrames).toBe(300);
  expect(longer.shots[2]!.sourceSeqs).toEqual([2]);
  const separate = structuredClone(document);
  separate.scenes[3]!.lines[0]!.cue = "impact";
  const twoStages = compileVideoPlan(
    doc,
    applySpeechScript(script, base, separate, { project, manifest }).script,
  );
  const ballot = twoStages.shots[3]!;
  expect(buildVideoFrame(twoStages, ballot.from + 29).sourceSeq).toBe(3);
  expect(buildVideoFrame(twoStages, ballot.from + 30).sourceSeq).toBe(4);
  expect(buildVideoFrame(twoStages, ballot.from + 29).scene.ballot?.tally).toBeNull();
  expect(buildVideoFrame(twoStages, ballot.from + 30).scene.ballot?.tally).toEqual({ 2: 2 });
});
test("missing audio, stale text and changed source order never fall back to estimated audio timing", () => {
  const { doc, script, document, project, manifest } = fixture();
  const base = compileVideoPlan(doc, script);
  delete manifest.night;
  expect(() => applySpeechScript(script, base, document, { project, manifest })).toThrow(
    "speech_not_prepared:night",
  );
  const changed = structuredClone(document);
  changed.scenes[0]!.lines[0]!.text = "改过台词。";
  expect(() => applySpeechScript(script, base, changed, { project, manifest })).toThrow(
    "speech_stale:opening",
  );
  changed.scenes.reverse();
  expect(() => applySpeechScript(script, base, changed)).toThrow(
    "speech_script_scene_order_mismatch",
  );
});
test("local pipeline writes one voice track, complete SRT and a real sample timeline without contacting a provider", async () => {
  const { doc, script, document, project, manifest, voice } = fixture();
  const dir = await mkdtemp(path.join(os.tmpdir(), "awa-speech-script-"));
  try {
    manifest.opening!.samples = 24001;
    await mkdir(path.join(dir, "audio"));
    await writeFile(path.join(dir, "replay.json"), JSON.stringify(doc));
    await writeFile(
      path.join(dir, "project.ts"),
      `export default ${JSON.stringify({ input: "replay.json", script })};`,
    );
    await writeFile(path.join(dir, "script.jsonl"), speechScriptJsonl(document));
    await writeFile(
      path.join(dir, "casting.ts"),
      `export const casting=${JSON.stringify({ god: voice, "player:1": voice })};`,
    );
    for (const [index, line] of project.lines.entries()) {
      const entry = manifest[line.id]!;
      const pcm = Buffer.alloc(entry.samples * 2);
      for (let i = 0; i < entry.samples; i++) pcm.writeInt16LE(index + 1, i * 2);
      const bytes = writePcmWav(pcm, 24000);
      entry.sha256 = createHash("sha256").update(bytes).digest("hex");
      await writeFile(path.join(dir, entry.src), bytes);
    }
    await writeFile(path.join(dir, "manifest.ts"), `export default ${JSON.stringify(manifest)};`);
    const result = await compileSpeechVideo({
      project: path.join(dir, "project.ts"),
      script: path.join(dir, "script.jsonl"),
      casting: path.join(dir, "casting.ts"),
      manifest: path.join(dir, "manifest.ts"),
      directory: path.join(dir, "out"),
      requireSubtitles: true,
    });
    expect(result.seconds).toBe(271 / 30);
    expect(result.missingTiming).toBe(0);
    expect(result.subtitles).not.toBeNull();
    const prepared = await prepareVideo({ project: result.output });
    expect(prepared.plan.audio).toHaveLength(1);
    expect(prepared.plan.audio[0]).toMatchObject({ from: 0, durationFrames: 271, track: "voice" });
    const wav = readPcmWav(await readFile(result.audio));
    expect(wav.samples).toBe(216800);
    expect(wav.pcm.readInt16LE(0)).toBe(1);
    expect(wav.pcm.readInt16LE(24001 * 2)).toBe(0);
    expect(wav.pcm.readInt16LE(24800 * 2)).toBe(2);
    expect(wav.pcm.readInt16LE(48800 * 2)).toBe(3);
    expect(await readFile(result.subtitles!, "utf8")).toContain("玩家完整原话🐾。");
    const timeline = JSON.parse(
      await readFile(path.join(path.dirname(result.output), "speech-timeline.json"), "utf8"),
    );
    expect(timeline.timing).toBe("audio");
    expect(timeline.scenes[2].lines[0].audioDurationMs).toBe(2000);
    await writeFile(path.join(dir, "audio/opening.wav"), "corrupt");
    await expect(
      assembleSpeechAudio({
        timeline,
        manifest,
        manifestDirectory: dir,
        directory: path.join(dir, "bad"),
      }),
    ).rejects.toThrow("speech_assembly_digest_mismatch");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
