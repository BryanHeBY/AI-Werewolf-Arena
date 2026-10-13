/**
 * 负责公开新封装与旧裸档的包级兼容测试；输入为手写 v0／v1／v2 数据、版本变体与属性描述符。
 * 输出由字面机器 ID、原用户文本、缺席身份和拒绝路径核对，不调用后端或 renderer 生成预期。
 * 新版本只封装原 schema 2，声明不证明构建兼容；不读写历史 golden 或真实文件。
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
