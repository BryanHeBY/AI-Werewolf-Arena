/**
 * 负责录制封装与旧裸档的包级兼容测试；输入为手写公开 v0／v1／v2、严格 Tape 2／3、版本变体与属性描述符。
 * 输出由字面机器 ID、原用户文本、缺席身份和拒绝路径核对，不调用后端或 renderer 生成预期。
 * 严格新内层 3 不能扩成公开／玩家 3，显式版本不提前执行 payload getter；声明不证明构建兼容，不读写历史 golden。
 */
import { expect, test } from "bun:test";
import {
  createRecordingEnvelope,
  readReplayArchive,
  readReplayDocument,
  unwrapRecordingEnvelope,
  type ReplayDocument,
  type RecordingIdentities,
} from "../src/index";
const identities: RecordingIdentities = {
  request: { id: "awa-action-request", version: "1" },
  presentation: { id: "awa-game-presentation", version: "1" },
  ruleset: null,
  build: null,
};
function document(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "literal_archive",
    meta: { board: "literal_board", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: null },
    players: [{ player_id: 1, role: "wolf", camp: "wolf", name: "古风 Nerd" }],
    events: [
      {
        seq: 1,
        timestamp: "t1",
        phase: "day",
        day: 1,
        type: "day_speech",
        payload: { actorId: 1, text: "原文 / Original speech" },
      },
    ],
  };
}
for (const version of [undefined, 1, 2])
  test(`public raw ${version ?? "unrecorded"} remains readable with no invented identities`, () => {
    const raw = { ...document(), schemaVersion: version };
    const before = JSON.stringify(raw),
      archive = readReplayArchive(raw);
    expect(archive.identities).toBeNull();
    expect(archive.replay.schemaVersion).toBe(2);
    expect(archive.replay.players[0]!.name).toBe("古风 Nerd");
    expect(archive.replay.events[0]!.payload.text).toBe("原文 / Original speech");
    expect(JSON.stringify(raw)).toBe(before);
  });
test("declared public envelope preserves original payload and detached declared identities", () => {
  const raw = document(),
    archived = createRecordingEnvelope("public_replay", raw, identities);
  expect(archived.envelopeVersion).toBe(1);
  expect(archived.payload.schemaVersion).toBe(2);
  const read = readReplayArchive(archived);
  expect(read.replay).toEqual(raw);
  expect(read.identities).toEqual(identities);
  read.identities!.request.version = "changed";
  expect(archived.identities.request.version).toBe("1");
  expect(readReplayDocument(archived)).toEqual(raw);
});
for (const field of ["format", "envelopeVersion", "kind", "payloadSchemaVersion"])
  test(`declared unknown ${field} is refused before legacy interpretation`, () => {
    const raw = createRecordingEnvelope("public_replay", document(), identities);
    const bad = { ...raw, [field]: field === "format" || field === "kind" ? "future" : 99 };
    expect(() => readReplayArchive(bad)).toThrow("archive.version");
  });
test("new envelope rejects wrong payload schema and never executes accessor data", () => {
  const raw = createRecordingEnvelope("public_replay", document(), identities);
  expect(() =>
    readReplayArchive({ ...raw, payload: { ...raw.payload, schemaVersion: 99 } }),
  ).toThrow("archive.payload.schemaVersion");
  let calls = 0;
  Object.defineProperty(raw.identities, "presentation", {
    enumerable: true,
    get() {
      calls++;
      return identities.presentation;
    },
  });
  expect(() => unwrapRecordingEnvelope(raw, "public_replay")).toThrow("archive");
  expect(calls).toBe(0);
});

test("legacy custom format stays raw while accessor declaration is never executed", () => {
  const raw = { ...document(), format: "legacy-custom-extension" };
  const original = JSON.stringify(raw);
  const archive = readReplayArchive(raw);
  expect(archive.identities).toBeNull();
  expect(JSON.stringify(archive.replay)).toBe(original);
  let calls = 0;
  const accessor = { ...raw };
  Object.defineProperty(accessor, "format", {
    enumerable: true,
    get() {
      calls++;
      return "awa-recording";
    },
  });
  expect(() => readReplayArchive(accessor)).toThrow("document");
  expect(calls).toBe(0);
});

// 只测试封装版本配对；这里的最小 payload 不是完整 Tape，也不代替后端严格格式审计。
test("strict envelope v1 pairs explicit inner versions 2 and 3 while the writer default stays 2", () => {
  for (const version of [2, 3] as const) {
    const payload = { schemaVersion: version, marker: "literal strict payload" };
    const archive = createRecordingEnvelope("strict_reproduction", payload, identities, version);
    expect(archive.envelopeVersion).toBe(1);
    expect(archive.payloadSchemaVersion).toBe(version);
    expect(unwrapRecordingEnvelope(archive, "strict_reproduction").payload).toEqual(payload);
  }
  expect(
    createRecordingEnvelope("strict_reproduction", { schemaVersion: 2 }, identities)
      .payloadSchemaVersion,
  ).toBe(2);
  // 缺少显式第 4 参不会从 payload 猜 3；外 2／内 3 必须仍拒绝。
  expect(() =>
    createRecordingEnvelope("strict_reproduction", { schemaVersion: 3 }, identities),
  ).toThrow("archive.payload.schemaVersion");
});

test("strict envelope versions must match and public or player inner version 3 remains unsupported", () => {
  const two = createRecordingEnvelope("strict_reproduction", { schemaVersion: 2 }, identities);
  const three = createRecordingEnvelope("strict_reproduction", { schemaVersion: 3 }, identities, 3);
  expect(() =>
    unwrapRecordingEnvelope({ ...two, payload: { schemaVersion: 3 } }, "strict_reproduction"),
  ).toThrow("archive.payload.schemaVersion");
  expect(() =>
    unwrapRecordingEnvelope({ ...three, payload: { schemaVersion: 2 } }, "strict_reproduction"),
  ).toThrow("archive.payload.schemaVersion");
  for (const kind of ["public_replay", "player_view"] as const)
    expect(() => createRecordingEnvelope(kind, { schemaVersion: 3 }, identities, 3)).toThrow(
      "archive.version",
    );
});

test("explicit or default writer versions never evaluate a payload schema accessor", () => {
  let calls = 0;
  const payload = Object.defineProperty({}, "schemaVersion", {
    enumerable: true,
    get() {
      calls++;
      return 3;
    },
  });
  expect(() => createRecordingEnvelope("strict_reproduction", payload, identities)).toThrow(
    "archive",
  );
  expect(() => createRecordingEnvelope("strict_reproduction", payload, identities, 3)).toThrow(
    "archive",
  );
  expect(calls).toBe(0);
});
