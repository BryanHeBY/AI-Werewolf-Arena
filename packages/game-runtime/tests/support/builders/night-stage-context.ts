/**
 * 负责测试可信装配输入与已完成摘要。fixture 可持原 World／状态，但执行可替换 handler 必须走实际程序身份绑定；未配置依赖原样抛错。此对象不是公开 NightStageContext，不拥有规则预期或运行整局。
 */
import { bindNightAbilityActorQuery } from "../../../src/features/night-abilities/night-ability-actors";
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { COMPONENT, type World } from "../../../src/domain";
import { StatusMarksComponent } from "../../../src/domain/components/status-marks";
import { getDefaultRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import type { TrustedNightStageRuntime as NightStageContext } from "../../../src/engine/night/trusted-runtime";
import type { NightStageDefinition as NightStageHandler } from "../../../src/engine/night/contracts";
import { executePreparedNightStage } from "../../../src/rulesets/night-stage-bindings";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import type { NightPipelineResult } from "../../../src/engine/phases/night-pipeline";

const unused = (): never => {
  throw new Error("unused_night_stage_fixture_dependency");
};

/** 单独执行夜间阶段时仍提供完整类型上下文；未声明的依赖一旦被使用便明确抛错。 */
export function nightStageContext(
  input: Partial<NightStageContext> & { world: World },
): NightStageContext {
  return {
    // 延迟绑定到调用时的 World／上下文，保留测试覆盖后的对象身份及依赖读取时点。
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
    },
    get nativeNightFailure() {
      return bindNativeNightFailurePolicy(() => this.world);
    },
    get nativeNightTargets() {
      return bindNativeNightTargetPolicy(() => this);
    },
    get nativeNightEffects() {
      return bindNativeNightEffects(() => this);
    },
    previousExile: null,
    events: [],
    roleCatalog: getDefaultRoleCatalog(),
    toolGateway: new ToolGateway(),
    isCurrent: () => true,
    currentDay: () => 1,
    get requestFactory() {
      return GameActionRequestFactory;
    },
    actionProvider: { getAction: unused },
    makeRequest: unused,
    getAliveByRole: unused,
    pickMajorityTarget: unused,
    shuffleWolves: unused,
    ensureMarks: (id) => {
      let marks = input.world.getComponent(id, COMPONENT.StatusMarks);
      if (!marks) {
        marks = new StatusMarksComponent();
        input.world.addComponent(id, COMPONENT.StatusMarks, marks);
      }
      return marks;
    },
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
    },
    // 覆盖最后应用：场景可提供自己的规则端口、阶段状态和 getter，默认值不抢占这些依赖。
    ...input,
  };
}

export function completedNight(
  result: NightPipelineResult,
): Extract<NightPipelineResult, { interrupted: false }> {
  if (result.interrupted) throw new Error("expected_completed_night_fixture");
  return result;
}

/** 原 .execute 点先准备同一函数，fixture 参数后求值；实际 receiver 和可信程序／公开 callback 分界走生产 owner。 */
export function executeNightStage(
  handler: NightStageHandler,
): (runtime: NightStageContext) => Promise<void> {
  const callee = handler.execute;
  return (runtime) => executePreparedNightStage(handler, callee, runtime);
}
