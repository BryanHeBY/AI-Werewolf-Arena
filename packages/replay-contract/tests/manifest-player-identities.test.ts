/**
 * 单元兼容测试负责 manifest 内联声明、玩家封装和原无声明／v1／v2 的原文保留。
 * 输入为手写字段、私有seed、原prompt／工具和未知版本变体；预期为字面字段、身份缺席与拒绝路径。
 * 不读取历史golden、运行对局或使用renderer计算预期；协议声明不授予真实构建兼容。
 */
import { expect, test } from "bun:test";
import {
  ACTION_REQUEST_CONTRACT,
  GAME_PRESENTATION_CONTRACT,
} from "@ai-werewolf-arena/game-contract";
import {
  createReplayManifest,
  readReplayManifest,
  createRecordingEnvelope,
  readReplayPlayerView,
  type RecordingIdentities,
  unwrapRecordingEnvelope,
} from "../src/index";
const identities: RecordingIdentities = {
  request: ACTION_REQUEST_CONTRACT,
  presentation: GAME_PRESENTATION_CONTRACT,
  ruleset: null,
  build: null,
};
const manifest = () => ({
  session_id: "literal",
  board: "literal_board",
  started_at: "t1",
  ended_at: "t2",
  winner: null,
  finish_reason: "literal_finish",
  players: [{ player_id: 1, role: "seer", camp: "good", alive: true, name: "古风Nerd" }],
  random: {
    seed: "literal_private_seed",
    algorithm: "literal_algorithm",
    streamPolicy: "literal_policy",
    path: [],
  },
  files: {
    replay: "replay.json",
    logic_ops: "logic_ops.json",
    debug_reports: "debug_reports.json",
    debug_summary: "debug_summary.md",
    player_views: ["players/player_1.json"],
  },
});
const player = () => ({
  schemaVersion: 2 as const,
  player_id: 1,
  role: "seer",
  camp: "good",
  initial_prompt: {
    day: 1,
    phase: "night",
    stage: "seer",
    request_id: "literal_prompt",
    prompt_system: "欢乐原文 / User original",
    prompt_user: ["原始提示"],
  },
  timeline: [],
});
test("legacy raw manifest keeps fields and missing identities without inventing a schema or build", () => {
  const raw = { ...manifest(), custom: "raw extension" },
    before = JSON.stringify(raw),
    read = readReplayManifest(raw);
  expect(JSON.stringify(read)).toBe(before);
  expect(read.identities).toBeUndefined();
  expect(read.schemaVersion).toBeUndefined();
  expect(read.random!.seed).toBe("literal_private_seed");
  expect(JSON.stringify(raw)).toBe(before);
});
test("manifest inline1 validates declaration while retaining original private seed and root fields", () => {
  const raw = manifest(),
    current = createReplayManifest(raw, identities);
  expect(current.schemaVersion).toBe(1);
  expect(current.session_id).toBe("literal");
  expect(current.players[0]!.name).toBe("古风Nerd");
  expect(current.random.seed).toBe("literal_private_seed");
  expect(current.identities.build).toBeNull();
  expect(readReplayManifest(current)).toEqual(current);
  expect(Object.hasOwn(raw, "schemaVersion")).toBe(false);
});
test("manifest unknown declared schema or semantic protocol is refused by real reader", () => {
  const current = createReplayManifest(manifest(), identities);
  expect(() => readReplayManifest({ ...current, schemaVersion: 99 })).toThrow(
    "manifest.schemaVersion",
  );
  for (const key of ["request", "presentation"] as const) {
    const bad = structuredClone(current);
    bad.identities[key].version = "future";
    expect(() => readReplayManifest(bad)).toThrow(`identities.${key}`);
  }
});
for (const version of [undefined, 1, 2])
  test(`player raw ${version ?? "unrecorded"} preserves original history policy without a source declaration`, () => {
    const raw = { ...player(), schemaVersion: version },
      before = JSON.stringify(raw),
      read = readReplayPlayerView(raw);
    expect(read.schemaVersion).toBe(2);
    expect(read.initial_prompt!.prompt_system).toBe("欢乐原文 / User original");
    expect(read.initial_prompt!.prompt_user).toEqual(["原始提示"]);
    expect(JSON.stringify(raw)).toBe(before);
  });
test("player envelope1 leaves inner2 prompt and local record untouched", () => {
  const raw = player(),
    current = createRecordingEnvelope("player_view", raw, identities);
  expect(current.kind).toBe("player_view");
  expect(current.envelopeVersion).toBe(1);
  expect(current.payload.schemaVersion).toBe(2);
  expect(readReplayPlayerView(current)).toEqual(raw);
  expect(JSON.stringify(current)).not.toContain("literal_private_seed");
});
test("player actual reader refuses unknown outer or semantic declarations before interpreting the inner content", () => {
  const current = createRecordingEnvelope("player_view", player(), identities);
  expect(() => readReplayPlayerView({ ...current, envelopeVersion: 99 })).toThrow(
    "archive.version",
  );
  for (const key of ["request", "presentation"] as const) {
    const bad = structuredClone(current);
    bad.identities[key].version = "future";
    expect(() => readReplayPlayerView(bad)).toThrow(`identities.${key}`);
  }
  expect(() => readReplayPlayerView({ ...player(), schemaVersion: 99 })).toThrow(
    "player.schemaVersion",
  );
});

// 编译反例只约束新协议结构，不修改旧档或运行未知格式。
if (false) {
  // @ts-expect-error manifest 声明只使用其独立 schema 1，不能把 player／Tape schema 2 当作清单版本。
  createReplayManifest({ ...manifest(), schemaVersion: 2 }, identities);
  // @ts-expect-error 新封装 kind 是明确的数据集合，未知类别不能伪装成播放器输入。
  createRecordingEnvelope("future_player", player(), identities);
}

test("invalid envelope payload is refused before any identity clone side effect", () => {
  const malformed = {
    format: "awa-recording",
    envelopeVersion: 1,
    kind: "public_replay",
    payloadSchemaVersion: 2,
    identities,
    payload: { schemaVersion: 99 },
  };
  const original = globalThis.structuredClone,
    calls: string[] = [];
  try {
    globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
      calls.push("clone");
      return original(value, options);
    }) as typeof structuredClone;
    expect(() => unwrapRecordingEnvelope(malformed, "public_replay")).toThrow(
      "archive.payload.schemaVersion",
    );
    expect(calls).toEqual([]);
  } finally {
    globalThis.structuredClone = original;
  }
});
