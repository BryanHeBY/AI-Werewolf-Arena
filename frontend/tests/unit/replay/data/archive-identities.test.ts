/**
 * 负责前端文件／API 公共 reader 与直接视频输入的展示版本兼容单元测试。
 * 输入为字面新封装、原 schema 2 和未来展示声明；输出由原文、帧输入和原拒绝 key／路径核对。
 * 不启动浏览器、传输、视频渲染或模型，不修改历史 fixture；未知声明不能由当前 renderer 默许。
 */
import { expect, test } from "bun:test";
import { createRecordingEnvelope, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { GAME_PRESENTATION_CONTRACT } from "@ai-werewolf-arena/game-presentation";
import { parseOfflineReplayJson } from "../../../../src/replay/offline-replay";
import { createReplayRenderInput } from "../../../../src/replay/replay-frame";
const document: ReplayDocument = {
  schemaVersion: 2,
  perspective: "god",
  sessionId: "literal_frontend_archive",
  meta: { board: "literal", locale: "en", startedAt: "t1", endedAt: "t2" },
  result: { winner: null, reason: null },
  players: [],
  events: [
    {
      seq: 1,
      timestamp: "2026-10-13T00:00:00.000Z",
      phase: "day",
      day: 1,
      type: "day_speech",
      payload: { actorId: 1, text: "欢乐原文 / Original" },
    },
  ],
};
const archive = () =>
  createRecordingEnvelope("public_replay", document, {
    request: { id: "awa-action-request", version: "1" },
    presentation: GAME_PRESENTATION_CONTRACT,
    ruleset: null,
    build: null,
  });
test("actual offline and direct render entry accept the declared supported format", () => {
  expect(parseOfflineReplayJson(JSON.stringify(archive()))).toEqual(document);
  const input = createReplayRenderInput(archive());
  expect(input.locale).toBe("en");
  expect(input.replay.events[0]!.payload.text).toBe("欢乐原文 / Original");
  expect(parseOfflineReplayJson(JSON.stringify(document))).toEqual(document);
});
test("future presentation declaration is refused by both actual entry points", () => {
  const bad = archive();
  bad.identities.presentation.version = "future";
  expect(() => parseOfflineReplayJson(JSON.stringify(bad))).toThrow("不支持此复盘格式版本。");
  expect(() => createReplayRenderInput(bad)).toThrow("identities.presentation");
});
test("unknown outer version cannot fall back to the old inner document", () => {
  const bad = { ...archive(), envelopeVersion: 99 };
  expect(() => parseOfflineReplayJson(JSON.stringify(bad))).toThrow("不支持此复盘格式版本。");
});
