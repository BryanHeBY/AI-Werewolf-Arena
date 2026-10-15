/**
 * 单元测试验证查验结果事实接收、对应标签与事件前缀展示。输入为原字面量、畸形 payload、语言和用例表；手写字段、标签与效果预期作为独立 oracle，不执行真实游戏或重生成 golden。
 */
import { expect, test } from "bun:test";
import {
  readReplayDocument,
  readSeerInspectionResult,
  type ReplayEvent,
} from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";

const event = (payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-08T00:00:00Z",
  phase: "night",
  day: 1,
  type: "seer_checked",
  payload: { actorId: 3, targetId: 1, ...payload },
});
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: timeline/video labels show typed inspection results and compatible old booleans`, () => {
    const cases = [
      { kind: "camp", camp: "good" },
      { kind: "camp", camp: "wolf" },
      { kind: "camp", camp: "third_party" },
      { kind: "role", role: "seer" },
      { kind: "combined", camp: "wolf", role: "wolf" },
    ] as const;
    for (const result of cases) {
      expect(eventLabel(event({ result, isWerewolf: false }), locale)).toBe(
        text(locale, "replay.check", {
          actor: 3,
          target: 1,
          camp: inspectionLabel(result, locale),
        }),
      );
    }
    for (const isWerewolf of [true, false])
      expect(eventLabel(event({ isWerewolf }), locale)).toBe(
        text(locale, "replay.check", {
          actor: 3,
          target: 1,
          camp: inspectionLabel({ kind: "camp", camp: isWerewolf ? "wolf" : "good" }, locale),
        }),
      );
    const unknown = { kind: "future_mode", original: "原文 content" };
    for (const payload of [
      { result: unknown, isWerewolf: false },
      { result: null, isWerewolf: false },
      {},
    ]) {
      const input = event(payload),
        before = structuredClone(input);
      expect(eventLabel(input, locale)).toContain(text(locale, "common.unknown"));
      expect(eventLabel(input, locale)).not.toMatch(/future_mode|original|[{}]/);
      expect(input).toEqual(before);
    }
  });

test("public replay loading keeps the complete typed result and unknown extensions without mutating the source", () => {
  const input = {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "inspection",
    meta: { board: "synthetic", locale: "en", startedAt: "start", endedAt: "end" },
    result: { winner: null, reason: null },
    players: [],
    events: [event({ result: { kind: "combined", camp: "wolf", role: "wolf" } })],
  };
  const before = structuredClone(input),
    loaded = readReplayDocument(input);
  expect(readSeerInspectionResult(loaded.events[0].payload)).toEqual({
    kind: "combined",
    camp: "wolf",
    role: "wolf",
  });
  loaded.events[0].payload.result = { kind: "camp", camp: "good" };
  expect(input).toEqual(before);
});

test("unknown result fallback does not execute a foreign result accessor", () => {
  let reads = 0;
  const value = event({});
  Object.defineProperty(value.payload, "result", {
    get() {
      reads++;
      throw new Error("must-not-read");
    },
  });
  expect(eventLabel(value, "en")).toBe(text("en", "replay.unknown"));
  expect(reads).toBe(0);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: ability changes share timeline/video text and preserve unknown future fields`, () => {
    const changed = {
      ...event({}),
      type: "ability_changed",
      payload: { actorId: 5, abilityId: "gift:one", kind: "seer_check", operation: "granted" },
    };
    expect(eventLabel(changed, locale)).toBe(
      text(locale, "ability.change", {
        actor: 5,
        id: "gift:one",
        kind: text(locale, "ability.kind.seer_check"),
        operation: text(locale, "ability.operation.granted"),
      }),
    );
    expect(
      eventLabel(
        {
          ...changed,
          payload: { ...changed.payload, kind: "future_power", operation: "future_action" },
        },
        locale,
      ),
    ).toContain("future_power");
  });
