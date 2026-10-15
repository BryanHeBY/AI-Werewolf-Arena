/**
 * 单元测试以原单元实例、字面分派标志及带轨迹的终态调用为输入，核对周期持有的具体夜接收者和晚 manager 参数。接收者身份、配置读取及失败前缀预期均为字面值；不推进游戏、修改库存、运行传输或推导身份规则。
 */
import { expect, test } from "bun:test";
import { Role, type ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { NightManagerLifecycle } from "../../../src/rulesets/night-lifecycle-plan";
import { MagicianNightUnit } from "../../../src/features/magician/ports";
import { WolfSorcererNightUnit } from "../../../src/features/wolf-sorcerer/ports";
import { TricksterNightUnit } from "../../../src/features/trickster/ports";
import { TimeConsortNightUnit } from "../../../src/features/time-wolf-consort/ports";

function dispatchFlags(trace: string[], enabled: readonly string[]): ReadonlyBoardConfig {
  const board: ReadonlyBoardConfig = {
    boardSize: 1,
    enableSheriff: false,
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [{ role: Role.Villager, count: 1 }],
  };
  for (const key of [
    "animalDream", "nobleSecretBody", "trickster", "wolfSorcerer", "magician",
    "timeConsort", "scholarMentor", "mistRaven",
  ])
    Object.defineProperty(board, key, {
      get() {
        trace.push(`config:${key}`);
        return enabled.includes(key) ? {} : undefined;
      },
    });
  return board;
}

test("exchange handoff retains all original units and reads manager World at each terminal", () => {
  const trace: string[] = [],
    original = new World("en"),
    current = new World("en"),
    magician = new MagicianNightUnit({ world: original }),
    sorcerer = new WolfSorcererNightUnit({ world: original }, magician.cleanupOwnership),
    trickster = new TricksterNightUnit({ world: original }, magician.cleanupOwnership),
    board = dispatchFlags(trace, ["trickster", "wolfSorcerer", "magician"]);
  for (const [unit, name, operation] of [
    [trickster, "trickster", "finishNormally"],
    [sorcerer, "sorcerer", "closeNormally"],
    [magician, "magician", "closeNormally"],
  ] as const)
    Object.defineProperty(unit, operation, {
      value(this: unknown, world: World, day: number) {
        expect(this).toBe(unit);
        expect(world).toBe(current);
        expect(day).toBe(4);
        trace.push(name);
      },
    });
  const cycle = new NightManagerLifecycle({
    get world() { trace.push("world"); return current; },
    get config() { return board; },
    abortMistPending() { throw Error("unexpected_pending_cleanup"); },
  });
  magician.transferToManager(true);
  cycle.receiveExchange(magician, sorcerer, trickster);
  expect(trace).toEqual([]);
  expect(magician.cleanupOwnership.isTransferred()).toBe(true);
  cycle.finishDay(4, () => true);
  expect(trace).toEqual([
    "config:trickster", "world", "trickster",
    "config:wolfSorcerer", "world", "sorcerer",
    "config:magician", "world", "magician",
    "config:timeConsort", "config:scholarMentor", "config:mistRaven",
  ]);
});

test("a terminal failure preserves its prefix and does not select later normal receivers", () => {
  const trace: string[] = [], world = new World("en"),
    magician = new MagicianNightUnit({ world }),
    sorcerer = new WolfSorcererNightUnit({ world }, magician.cleanupOwnership),
    trickster = new TricksterNightUnit({ world }, magician.cleanupOwnership),
    board = dispatchFlags(trace, ["trickster", "wolfSorcerer", "magician"]);
  Object.defineProperty(trickster, "finishNormally", {
    value() { trace.push("finish"); throw Error("original_finish_failure"); },
  });
  const cycle = new NightManagerLifecycle({
    get world() { trace.push("world"); return world; },
    get config() { return board; },
    abortMistPending() {},
  });
  cycle.receiveExchange(magician, sorcerer, trickster);
  expect(() => cycle.finishDay(2, () => true)).toThrow("original_finish_failure");
  expect(trace).toEqual(["config:trickster", "world", "finish"]);
});

test("each configured normal receiver rechecks currentness after earlier terminals", () => {
  const trace: string[] = [], world = new World("en"),
    magician = new MagicianNightUnit({ world }),
    sorcerer = new WolfSorcererNightUnit({ world }, magician.cleanupOwnership),
    trickster = new TricksterNightUnit({ world }, magician.cleanupOwnership),
    board = dispatchFlags(trace, ["trickster", "wolfSorcerer", "magician"]);
  let current = true;
  Object.defineProperty(trickster, "finishNormally", {
    value() { trace.push("finish"); current = false; },
  });
  const cycle = new NightManagerLifecycle({
    get world() { trace.push("world"); return world; },
    get config() { return board; },
    abortMistPending() {},
  });
  cycle.receiveExchange(magician, sorcerer, trickster);
  cycle.finishDay(2, () => { trace.push("current"); return current; });
  expect(trace).toEqual([
    "config:trickster", "current", "world", "finish",
    "config:wolfSorcerer", "current", "config:magician", "current",
    "config:timeConsort", "config:scholarMentor", "config:mistRaven",
  ]);
});

test("normal close never suppresses repeated inner and outer cleanup on the transferred unit", () => {
  const trace: string[] = [], original = new World("en"),
    current = new World("en"), unit = new TimeConsortNightUnit({ world: original }),
    board = dispatchFlags(trace, ["timeConsort"]);
  Object.defineProperty(unit, "closeNormally", {
    value(this: unknown, world: World) {
      expect(this).toBe(unit); expect(world).toBe(current); trace.push("close");
    },
  });
  Object.defineProperty(unit, "abort", {
    value(this: unknown, world: World) {
      expect(this).toBe(unit); expect(world).toBe(current); trace.push("abort");
    },
  });
  const cycle = new NightManagerLifecycle({
    get world() { trace.push("world"); return current; },
    get config() { return board; },
    abortMistPending() { throw Error("unexpected_pending_cleanup"); },
  });
  unit.transferToManager(true);
  cycle.receiveTimeConsort(unit);
  cycle.finishDay(3, () => true);
  cycle.abortInner();
  cycle.abortCycle(true);
  expect(trace).toEqual([
    "config:trickster", "config:wolfSorcerer", "config:magician",
    "config:timeConsort", "world", "close", "config:scholarMentor", "config:mistRaven",
    "config:mistRaven", "config:trickster", "config:wolfSorcerer", "config:magician",
    "config:timeConsort", "world", "abort", "config:scholarMentor",
    "config:animalDream", "config:mistRaven", "config:timeConsort", "world", "abort",
    "config:scholarMentor", "config:wolfSorcerer", "config:magician",
  ]);
});
