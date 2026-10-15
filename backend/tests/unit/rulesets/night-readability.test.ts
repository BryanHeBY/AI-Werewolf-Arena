/**
 * 单元测试验证夜间设置与可读性组合的现场读取顺序、短路及失败前缀。
 * 输入为真实空 World、原初始身份设置和手写抛错查询；输出依据独立字面轨迹与原错误。
 * 不模拟机制权威、不运行整局或模型；本测试不授予窗口，不用待测函数生成预期。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { assertNightSetupReady, assertNightReadable, type NightReadabilityRuntime } from "../../../src/rulesets/night-readability";
import { installInitialIdentityDeal, openInitialIdentitySetup, hasActiveInitialIdentitySetup } from "../../../src/game/mechanisms/roles/initial_identity/deal";

function runtime(world: World, trace: string[]): NightReadabilityRuntime {
  const config = {};
  return {
    world() { trace.push("world"); return world; },
    config() { trace.push("config"); return config; },
    ownsAnimal() { trace.push("animal"); return false; },
    ownsFragrant() { trace.push("fragrant"); return false; },
    ownsNoble() { trace.push("noble"); return false; },
    ownsRadiant() { trace.push("radiant"); return false; },
    ownsMist() { trace.push("mist"); return false; },
    ownsDemon() { trace.push("demon"); return false; },
  };
}

test("empty setup retains eight original World reads and an active deal is not cancelled by rejection", () => {
  const world = new World(), trace: string[] = [];
  assertNightSetupReady({ world() { trace.push("world"); return world; } });
  expect(trace).toEqual(Array(8).fill("world"));
  installInitialIdentityDeal(world, [Role.Villager, Role.Villager], [], "shapeshifter");
  const deal = openInitialIdentitySetup(world);
  trace.length = 0;
  expect(() => assertNightSetupReady({ world() { trace.push("world"); return world; } }))
    .toThrow("shapeshifter_setup_before_night_required");
  expect(trace).toEqual(Array(8).fill("world"));
  expect(hasActiveInitialIdentitySetup(world)).toBe(true);
  expect(deal.status).toBe("pending");
});

test("readability keeps captured ownership order and unconditional checks before Demon short circuit", () => {
  const trace: string[] = [];
  expect(() => assertNightReadable(runtime(new World(), trace))).not.toThrow();
  expect(trace).toEqual([
    "animal", "fragrant", "noble", "radiant", "mist",
    "config", "config", "config", "config", "config", "world", "world", "demon",
  ]);
});

test("a conditional roster failure preserves prior checks and skips all later query effects", () => {
  const trace: string[] = [], failure = new Error("first_roster_world_failed"), input = runtime(new World(), trace);
  input.ownsAnimal = () => { trace.push("animal"); return true; };
  input.world = () => { trace.push("world"); throw failure; };
  expect(() => assertNightReadable(input)).toThrow(failure);
  expect(trace).toEqual(["animal", "world"]);
});
