/**
 * 单元测试验证同步周期／阶段跳转准入的原短路、现场读取次序和失败前缀。
 * 输入为真实 World、原初始身份设置及带字面 trace 的只读运行查询；输出以独立预期和原错误验收。
 * 不模拟机制谓词或执行整局；终局不读取日期，已开启设置不因拒绝撤销，身份错误在命中后才查询。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import {
  assertCycleAdmission,
  assertPhaseJumpAdmission,
} from "../../../src/rulesets/cycle-admission";
import {
  installInitialIdentityDeal,
  openInitialIdentitySetup,
  hasActiveInitialIdentitySetup,
} from "../../../src/game/mechanisms/roles/initial_identity/deal";

test("terminal cycle admission skips every day read but retains unconditional windows in order", () => {
  const world = new World(), trace: string[] = [];
  const state = {
    get gameOver() { trace.push("gameOver"); return true; },
    get day(): number { throw new Error("terminal_day_must_not_read"); },
  };
  expect(() => assertCycleAdmission({
    get world() { trace.push("world"); return world; },
    get state() { trace.push("state"); return state; },
  })).not.toThrow();
  expect(trace).toEqual([
    "state", "gameOver", "state", "gameOver",
    "world", "world", "state", "gameOver",
    "world", "state", "gameOver", "world", "state", "gameOver",
    "world", "world", "state", "gameOver", "world",
  ]);
});

test("an active setup queries kind only after its hit and preserves the original getter failure prefix", () => {
  const world = new World(), trace: string[] = [], failure = new Error("kind_world_failed");
  // 两张留底且没有参与者足以建立本机制真实设置；不生成虚构玩家或行动许可。
  installInitialIdentityDeal(world, [Role.Villager, Role.Villager], [], "shapeshifter");
  const deal = openInitialIdentitySetup(world);
  let reads = 0;
  expect(() => assertCycleAdmission({
    get world() {
      trace.push(`world:${++reads}`);
      if (reads === 6) throw failure;
      return world;
    },
    state: { gameOver: true, get day(): number { throw new Error("day_must_not_read"); } },
  })).toThrow(failure);
  expect(trace).toEqual(["world:1", "world:2", "world:3", "world:4", "world:5", "world:6"]);
  expect(hasActiveInitialIdentitySetup(world)).toBe(true);
  expect(deal.status).toBe("pending");
  expect(() => assertCycleAdmission({ world, state: { gameOver: true, day: 1 } }))
    .toThrow("shapeshifter_setup_reentry");
});

test("phase admission reads gameOver before Demon arguments and terminal readiness still reads each World", () => {
  const world = new World(), failure = new Error("game_over_failed"), failedTrace: string[] = [];
  expect(() => assertPhaseJumpAdmission({
    get world(): World { throw new Error("world_must_not_read"); },
    get state() {
      failedTrace.push("state");
      return { get gameOver(): boolean { failedTrace.push("gameOver"); throw failure; }, day: 1 };
    },
  })).toThrow(failure);
  expect(failedTrace).toEqual(["state", "gameOver"]);
  const trace: string[] = [];
  expect(() => assertPhaseJumpAdmission({
    get world() { trace.push("world"); return world; },
    get state() {
      trace.push("state");
      return { get gameOver() { trace.push("gameOver"); return true; },
        get day(): number { throw new Error("terminal_day_must_not_read"); } };
    },
  })).not.toThrow();
  expect(trace).toEqual([
    "state", "gameOver", "world", "world", "state", "gameOver",
    "world", "world", "state", "gameOver",
  ]);
});
