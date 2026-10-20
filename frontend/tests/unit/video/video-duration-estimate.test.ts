/** 视频时长估算测试负责核对实测语速和静默停顿。输入为手写镜头及试听测量，预期为独立算式秒数，不调用云服务。 */
import { expect, test } from "bun:test";
import type { VideoPlan } from "../../../src/video/plan";
import { compileVideoPlan, getVideoSourceIdentity } from "../../../src/video/plan";
import { speechProjectFromPlan } from "../../../src/speech";
import { estimateVideoDuration } from "../../../scripts/estimate-video-duration";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { tencentSpeedParameter, tencentSpeedRatio } from "../../../scripts/tts/tencent-speed";

function fixture(): VideoPlan {
  const replay: ReplayDocument = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "estimate",
    meta: { board: "test", startedAt: "s", endedAt: "e" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: "villager", camp: "good" }],
    events: [
      {
        seq: 1,
        type: "day_speech",
        payload: { actorId: 1, text: "一二三四五六七八" },
        timestamp: "t",
        day: 1,
        phase: "day",
      },
    ],
  };
  return compileVideoPlan(replay, {
    source: getVideoSourceIdentity(replay),
    layout: "broadcast-v1",
  });
}
test("measured voice rate replaces the reading clock and preserves non-spoken holds", () => {
  const plan = fixture();
  plan.shots.push({
    ...plan.shots[0]!,
    id: "hold:silent",
    kind: "hold",
    durationFrames: 90,
    speech: [],
  });
  const dialogue = speechProjectFromPlan(plan, {
    "player:1": { provider: "tencent", voiceId: 402002, name: "云大围", tier: "ultra-natural" },
  });
  const report = estimateVideoDuration(plan, dialogue, [
    { voiceId: 402002, speed: 0, characters: 40, seconds: 10 },
  ]);
  expect(report.characters).toBe(8);
  expect(report.calibratedCharacters).toBe(8);
  expect(report.estimatedSeconds).toBeCloseTo(8 / 4 + 0.2 + 0.4 + 3);
  expect(report.fasterSeconds).toBeCloseTo(161 / 30);
  expect(report.slowerSeconds).toBeCloseTo(179 / 30);
});
test("spoken-text corrections drive the estimate and unknown voices use the measured fallback", () => {
  const plan = fixture();
  const dialogue = speechProjectFromPlan(plan, {
    "player:1": { provider: "tencent", voiceId: 403005, name: "云雅琴", tier: "ultra-natural" },
  });
  dialogue.lines[0]!.spokenText = "一二三四";
  const report = estimateVideoDuration(plan, dialogue, [
    { voiceId: 402002, speed: 0, characters: 40, seconds: 10 },
  ]);
  expect(report.characters).toBe(4);
  expect(report.calibratedCharacters).toBe(0);
  expect(report.speakers["player:1"]!.calibrated).toBe(false);
  expect(report.estimatedSeconds).toBeCloseTo(4 / 4 + 0.6);
  expect(() =>
    estimateVideoDuration(plan, dialogue, [
      { voiceId: 402002, speed: 0, characters: 40, seconds: 0 },
    ]),
  ).toThrow("video_calibration_invalid");
});

test("Tencent Speed is converted using the published ratio rather than treated as a multiplier", () => {
  expect(tencentSpeedRatio(0)).toBe(1);
  expect(tencentSpeedRatio(1)).toBe(1.2);
  expect(tencentSpeedRatio(2)).toBe(1.5);
  expect(tencentSpeedRatio(1.5)).toBe(1.35);
  expect(tencentSpeedRatio(6)).toBe(2.5);
  expect(tencentSpeedParameter(1.5)).toBe(2);
  expect(() => tencentSpeedRatio(7)).toThrow("tts_speed_invalid");
  const plan = fixture();
  const dialogue = speechProjectFromPlan(plan, {
    "player:1": {
      provider: "tencent",
      voiceId: 402002,
      name: "云大围",
      tier: "ultra-natural",
      speed: 2,
    },
  });
  const report = estimateVideoDuration(plan, dialogue, [
    { voiceId: 402002, speed: 0, characters: 40, seconds: 10 },
  ]);
  expect(report.estimatedSeconds).toBeCloseTo(8 / (4 * 1.5) + 0.6);
});
test("Doubao calibration and target speed use their own parameter scale", () => {
  const plan = fixture();
  const dialogue = speechProjectFromPlan(plan, {
    "player:1": {
      provider: "volcengine",
      voiceId: "zh_female_vv_uranus_bigtts",
      name: "Vivi2.0",
      resourceId: "seed-tts-2.0",
      speechRate: 50,
    },
  });
  const report = estimateVideoDuration(plan, dialogue, [
    {
      provider: "volcengine",
      voiceId: "zh_female_vv_uranus_bigtts",
      speed: 20,
      characters: 48,
      seconds: 10,
    },
  ]);
  expect(report.calibratedCharacters).toBe(8);
  expect(report.estimatedSeconds).toBeCloseTo(8 / (4 * 1.5) + 0.6);
});
