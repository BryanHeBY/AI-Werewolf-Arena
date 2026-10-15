/**
 * 单元测试负责动物完成单位的晚读取、实际关闭与发表失败前缀。
 * 输入是原authority名单夹具、真实skip token和字面访问器故障，预期来自明确字段／顺序和原错误身份。
 * 使用真实owner，不复制关闭或事实算法；跳过计数政策保持，不运行完整对局、模型或传输。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "../../../../src/domain/events";
import { animalRosterFixture } from "../../../support/features/animal-dream/builders/roster";
import { completeAndPublishAnimalExileUnit } from "../../../../src/features/animal-dream/ports";
import {
  installAnimalAuthority,
  beginAnimalNight,
  closeAnimalNight,
  beginAnimalExileUnit,
  prepareAnimalCatExpiry,
  animalAuthoritySnapshot,
} from "../../../../src/features/animal-dream/authority";

function fixture(prepare = true) {
  const f = animalRosterFixture(undefined, installAnimalAuthority);
  beginAnimalNight(f.world, 1, () => true);
  closeAnimalNight(f.world, 1, "normal");
  const token = beginAnimalExileUnit(f.world, 1, "skipped_day", () => true);
  if (prepare) prepareAnimalCatExpiry(f.world, token);
  return { ...f, token };
}

test("原三次World与token/events/day晚读取保序，完成跳过单位不推进实际放逐计数", () => {
  const f = fixture(), events: GameEvent[] = [], trace: string[] = [];
  // facts按数组自己的data槽追加；覆盖push不能冒充或阻止真实发表。
  Object.defineProperty(events, "push", { get() { throw new Error("literal_push_must_not_read"); } });
  completeAndPublishAnimalExileUnit({
    world() { trace.push("world"); return f.world; },
    events() { trace.push("events"); return events; },
    day() { trace.push("day"); return 1; },
  }, () => { trace.push("token"); return f.token; });
  expect(trace).toEqual(["world", "token", "world", "world", "events", "day"]);
  expect(events.map(({ type, payload }) => ({ type, payload }))).toEqual([{
    type: "animal_unit_completed", payload: { policy: "awa_animal_dream_v1", day: 1, unit: 1, kind: "skipped_day" },
  }]);
  expect(Object.isFrozen(events[0])).toBe(true);
  expect(Object.isFrozen(events[0]!.payload)).toBe(true);
  expect(animalAuthoritySnapshot(f.world)!.unit!.status).toBe("closed");
  expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(0);
});

test("token或关闭首失败不查询后继事件或day，不把缺到期准备的单位伪造为完成", () => {
  const failedToken = fixture(), failure = new Error("literal_token_lookup_failure"), trace: string[] = [];
  expect(() => completeAndPublishAnimalExileUnit({
    world() { trace.push("world"); return failedToken.world; },
    events(): never { throw new Error("literal_events_must_follow_close"); },
    day(): never { throw new Error("literal_day_must_follow_close"); },
  }, () => { trace.push("token"); throw failure; })).toThrow(failure);
  expect(trace).toEqual(["world", "token"]);
  expect(animalAuthoritySnapshot(failedToken.world)!.unit!.status).toBe("open");
  const incomplete = fixture(false);
  expect(() => completeAndPublishAnimalExileUnit({
    world: () => incomplete.world,
    events(): never { throw new Error("literal_events_must_follow_complete_close"); },
    day(): never { throw new Error("literal_day_must_follow_complete_close"); },
  }, () => incomplete.token)).toThrow("animal_exile_unit_not_complete");
  expect(animalAuthoritySnapshot(incomplete.world)!.unit!.status).toBe("open");
});

test("关闭后snapshot/events/day失败保原closed状态和未发表前缀，不重开或补发", () => {
  for (const point of ["snapshot", "events", "day"] as const) {
    const f = fixture(), events: GameEvent[] = [], trace: string[] = [];
    const failure = new Error(`literal_completion_${point}_failure`);
    let worldReads = 0;
    expect(() => completeAndPublishAnimalExileUnit({
      world() {
        trace.push("world");
        if (++worldReads === 2 && point === "snapshot") throw failure;
        return f.world;
      },
      events() { trace.push("events"); if (point === "events") throw failure; return events; },
      day() { trace.push("day"); if (point === "day") throw failure; return 1; },
    }, () => { trace.push("token"); return f.token; })).toThrow(failure);
    expect(trace).toEqual(point === "snapshot" ? ["world", "token", "world"]
      : point === "events" ? ["world", "token", "world", "world", "events"]
      : ["world", "token", "world", "world", "events", "day"]);
    expect(animalAuthoritySnapshot(f.world)!.unit!.status).toBe("closed");
    expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(0);
    expect(events).toHaveLength(0);
    expect(() => completeAndPublishAnimalExileUnit({ world: () => f.world, events: () => events, day: () => 1 }, () => f.token)).toThrow("animal_exile_unit_unavailable");
    expect(events).toHaveLength(0);
  }
});
