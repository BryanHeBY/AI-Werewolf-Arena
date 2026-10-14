/**
 * 单元测试验证具名增益检查的配置短路、上下文晚读与首个名单读取错误。
 * 输入为手写 getter 轨迹和明确故障；预期由字面次序／原错误对象给出，不从生产结果生成 oracle。
 * 具体回执、生命和印记的顺序由原精准记录测试覆盖；这里不付款、关闭窗口或运行完整对局／模型。
 */
import { expect, test } from "bun:test";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { NightStageContext } from "../../../src/game/mechanisms/stages/night/contracts";
import { assertNightModifierBonusEffects } from "../../../src/rulesets/night-damage-composition";

test("未命中增益配置不读取阶段上下文，也不提前拍摄效果状态", () => {
  const trace: string[] = [];
  const config = { get scholarMentor() { trace.push("policy"); return undefined; } };
  assertNightModifierBonusEffects({
    config() { trace.push("config"); return config; },
    stageContext() { throw new Error("literal_context_must_not_read"); },
  });
  expect(trace).toEqual(["config", "policy"]);
});

test("配置命中后才读取原上下文，名单World首失败不读取效果数组且不替换错误", () => {
  const trace: string[] = [], failure = new Error("literal_roster_world_failure");
  const config = { get scholarMentor() { trace.push("policy"); return { policy: "awa_scholar_mentor_twelve_v1" } satisfies NonNullable<ReadonlyBoardConfig["scholarMentor"]>; } };
  const ctx = {
    get world(): never { trace.push("world"); throw failure; },
    get state(): never { throw new Error("literal_state_must_not_read"); },
  } as unknown as NightStageContext;
  expect(() => assertNightModifierBonusEffects({
    config() { trace.push("config"); return config; },
    stageContext() { trace.push("context"); return ctx; },
  })).toThrow(failure);
  expect(trace).toEqual(["config", "policy", "context", "world"]);
});
