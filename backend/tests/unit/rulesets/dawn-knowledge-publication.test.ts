/**
 * 单元测试验证熊夜前捕获和黎明熊事实／Animal 知识／Beauty 通知的同步组合。
 * 输入是测试自有原体 fixture、原事件数组、null frame 与明确访问器故障；字面顺序和失败前缀独立验收。
 * 缺 frame 仍保 Animal gate，原 frame 拥有采样／历史／租约；本测试不标死结算、推进阶段或运行模型。
 * 规则依据 docs/rules/awa-bear-v1.md 与 docs/rules/awa-animal-dream-twelve-v1.md。
 */
import { expect, test } from "bun:test";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { GameEvent } from "../../../src/domain/events";
import { animalRosterFixture } from "../../support/features/animal-dream/builders/roster";
import { BearNightFrame, getBearState } from "../../../src/game/mechanisms/roles/bear/ports";
import { animalBearKnowledge } from "../../../src/game/mechanisms/roles/animal_dream/ports";
import { captureDawnKnowledge, publishDawnKnowledge } from "../../../src/rulesets/dawn-knowledge-publication";

const animal: NonNullable<ReadonlyBoardConfig["animalDream"]> = { policy: "awa_animal_dream_v1", eliminationPriority: "awa_wolf_priority_v1" };

test("null frame skips publish parameters but still scans only new Animal events before Beauty notice", () => {
  const f = animalRosterFixture(), trace: string[] = [], events: GameEvent[] = [{ timestamp: 1, type: "bear_roared", payload: { day: 9, roared: true } }];
  Object.defineProperty(events, "slice", { get() { trace.push("slice"); return Array.prototype.slice; } });
  publishDawnKnowledge(null, {
    world() { trace.push("world"); return f.world; },
    events() { trace.push("events"); return events; },
    animalDream() { trace.push("animal"); return animal; },
  }, 1, () => { throw new Error("literal_null_frame_must_not_check_current"); });
  expect(trace).toEqual(["events", "animal", "world", "events", "slice", "world", "events"]);
  expect(events.map(e => e.type)).toEqual(["bear_roared", "animal_beauty_notified"]);
  expect(animalBearKnowledge(f.world) as unknown).toEqual({ history: [] });
  // 前一字面断言已核事件类型；这里只收窄测试数组元素，不变样本或生产事件类型。
  expect((events[1]! as Extract<GameEvent, { type: "animal_beauty_notified" }>).audience).toEqual([1]);
  expect(events[1]!.payload).toMatchObject({ day: 1, actorId: 1, targetId: null, lastActedDay: null, history: [] });
  trace.length = 0;
  publishDawnKnowledge(null, {
    world() { throw new Error("literal_no_frame_no_animal_world_must_not_read"); },
    events() { trace.push("events"); return events; },
    animalDream() { trace.push("animal"); return undefined; },
  }, 2, () => false);
  expect(trace).toEqual(["events", "animal"]);
  expect(events).toHaveLength(2);
});

test("capture reads World before policy and dawn publication precedes knowledge and private notice", () => {
  const f = animalRosterFixture(), captureTrace: string[] = [], events: GameEvent[] = [], trace: string[] = [];
  const frame = captureDawnKnowledge({
    world() { captureTrace.push("world"); return f.world; },
    signalPolicy() { captureTrace.push("policy"); return "netease_dawn_live_v1"; },
  }, 1);
  expect(captureTrace).toEqual(["world", "policy"]);
  expect(frame).toBeInstanceOf(BearNightFrame);
  expect(getBearState(f.role(11))!.history).toEqual([]);
  f.life(12).alive = false;
  Object.defineProperty(events, "slice", { get() {
    trace.push("slice");
    expect(events.map(e => e.type)).toEqual(["bear_roared"]);
    expect(getBearState(f.role(11))!.history).toEqual([{ day: 1, roared: true }]);
    return Array.prototype.slice;
  } });
  publishDawnKnowledge(frame, {
    world() { trace.push("world"); return f.world; },
    events() { trace.push("events"); return events; },
    animalDream() { trace.push("animal"); return animal; },
  }, 1, () => true);
  expect(trace).toEqual(["events", "world", "events", "animal", "world", "events", "slice", "world", "events"]);
  expect(events.map(e => e.type)).toEqual(["bear_roared", "animal_beauty_notified"]);
  expect(animalBearKnowledge(f.world) as unknown).toEqual({ history: [{ day: 1, roared: true }] });
  expect(events[0]!.payload).toEqual({ day: 1, roared: true });
});

test("publication or knowledge failure keeps its original prefix and prevents later notices", () => {
  for (const point of ["push", "slice"] as const) {
    const f = animalRosterFixture(), events: GameEvent[] = [], trace: string[] = [], failure = new Error(`literal_dawn_${point}_failure`);
    const frame = captureDawnKnowledge({ world: () => f.world, signalPolicy: () => undefined }, 1);
    Object.defineProperty(events, point, { get() { trace.push(point); throw failure; } });
    expect(() => publishDawnKnowledge(frame, {
      world() { trace.push("world"); return f.world; },
      events() { trace.push("events"); return events; },
      animalDream() { trace.push("animal"); return animal; },
    }, 1, () => true)).toThrow(failure);
    expect(trace).toEqual(point === "push"
      ? ["events", "world", "events", "push"]
      : ["events", "world", "events", "animal", "world", "events", "slice"]);
    expect(getBearState(f.role(11))!.history).toEqual([{ day: 1, roared: false }]);
    expect(events.map(e => e.type)).toEqual(point === "push" ? [] : ["bear_roared"]);
    expect(animalBearKnowledge(f.world) as unknown).toEqual({ history: [] });
  }
});
