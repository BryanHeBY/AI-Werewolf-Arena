/**
 * 单元测试负责核对编译记录解释的隔离与事实边界。输入为同 seq 不同档案、不同名单、畸形载荷及双语场景，预期来自显式手写报告。
 * 不调用游戏规则或以另一生产路径生成预期；原始入口必须继续拒绝畸形数据，场景编辑不能污染共享解释。
 */
import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { createVideoRecordReader } from "../../../src/video/plan/records";
import { eventScene } from "../../../src/video/semantic-scenes";
import { eventVisualIntent } from "../../../src/video/visual-intent";
import { eventLabel, eventLabelFromRecord } from "../../../src/replay/event-labels";

function inspection(isWerewolf: boolean): ReplayEvent {
  return {
    seq: 1,
    type: "seer_checked",
    timestamp: "2026-10-17T00:00:00Z",
    day: 1,
    phase: "night",
    payload: { actorId: 1, targetId: 2, isWerewolf },
  };
}
test("same-seq archives and player whitelists cannot share cached reports", () => {
  const wolf = inspection(true);
  const good = inspection(false);
  const read = createVideoRecordReader([1, 2]);
  expect(read(wolf).visual.report).toEqual({ kind: "camp", camp: "wolf" });
  expect(read(good).visual.report).toEqual({ kind: "camp", camp: "good" });
  expect(createVideoRecordReader([1])(wolf).record).toBeNull();
  expect(createVideoRecordReader([1])(wolf).visual.report).toBeUndefined();
  // 列表也属于本次编译的输入快照，后续调用方编辑不能扩大已建立的解释范围。
  const ids = [1];
  const limited = createVideoRecordReader(ids);
  ids.push(2);
  expect(limited(wolf).record).toBeNull();
});

test("scene adaptation and source mutation cannot change the shared interpreted record", () => {
  const input = inspection(true);
  const record = createVideoRecordReader([1, 2])(input);
  const first = eventScene(input, [input], "第一次标签", "查验", [1, 2], "zh-CN", record);
  first.visual!.requestedTargetIds.push(1);
  first.visual!.report = { kind: "camp", camp: "good" };
  first.action!.kind = "generic";
  input.payload.isWerewolf = false;
  const second = eventScene(input, [input], "English label", "Inspection", [1, 2], "en", record);
  expect(second.visual!.requestedTargetIds).toEqual([2]);
  expect(second.visual!.report).toEqual({ kind: "camp", camp: "wolf" });
  expect(second.action).toEqual({ kind: "inspect", status: "recorded", result: "English label" });
  expect(createVideoRecordReader([1, 2])(input).visual.report).toEqual({
    kind: "camp",
    camp: "good",
  });
});

test("public raw readers still reject accessors without executing private payload code", () => {
  const input = inspection(true);
  let reads = 0;
  Object.defineProperty(input.payload, "isWerewolf", {
    enumerable: true,
    get() {
      reads++;
      return true;
    },
  });
  expect(eventLabel(input, "en", [1, 2])).toBe("Unknown");
  expect(eventVisualIntent(input, [1, 2]).fallbackReason).toBe("unknown_or_invalid_event");
  const interpreted = createVideoRecordReader([1, 2])(input);
  expect(interpreted.record).toBeNull();
  expect(interpreted.action).toBeUndefined();
  expect(eventLabelFromRecord(interpreted.record, "en", [1, 2])).toBe("Unknown");
  expect(reads).toBe(0);
});

test("an actual mapped target stays distinct from its recorded request", () => {
  const input: ReplayEvent = {
    seq: 1,
    type: "exile_target_mapped",
    timestamp: "2026-10-17T00:00:00Z",
    day: 1,
    phase: "voting",
    payload: { requestedId: 2, effectiveId: 1, missed: false },
  };
  const interpreted = createVideoRecordReader([1, 2])(input);
  expect(interpreted.record).not.toBeNull();
  expect(interpreted.visual.requestedTargetIds).toEqual([2]);
  expect(interpreted.visual.effectiveTargetIds).toEqual([1]);
  expect(interpreted.visual.effectiveTargetKnown).toBe(true);
});
