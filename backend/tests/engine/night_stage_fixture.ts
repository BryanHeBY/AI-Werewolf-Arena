/**
 * 负责测试中构造内存夜间上下文和提取已完成摘要。输入为明确 World／Provider 覆盖；输出保留 typed 阶段端口和原 World getter 时点，未配置依赖直接抛错。本 builder 不拥有规则预期、不改 fixture、不运行完整对局。
 */
import { bindNightAbilityActorQuery } from "../../src/game/mechanisms/roles/night-ability-actors";
import { bindNativeNightFailurePolicy } from "../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../src/rulesets/native-night-effects";
import { COMPONENT, type World } from "../../src/core";
import { StatusMarksComponent } from "../../src/core/domain/components/status_marks";
import { getDefaultRoleCatalog } from "../../src/game/mechanisms/roles/role-catalog-assembly";
import type { NightStageContext } from "../../src/game/mechanisms/stages/night/contracts";
import { ToolGateway } from "../../src/game/gateway/tool_gateway";
import type { NightPipelineResult } from "../../src/game/engine/phase_pipeline/night_pipeline";

const unused = (): never => {
  throw new Error("unused_night_stage_fixture_dependency");
};

/** Isolated stages keep a full typed context; unexpected dependencies fail explicitly. */
export function nightStageContext(
  input: Partial<NightStageContext> & { world: World },
): NightStageContext {
  return {
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
      dreamLinks: [],
    },
    ...input,
  };
}

export function completedNight(
  result: NightPipelineResult,
): Extract<NightPipelineResult, { interrupted: false }> {
  if (result.interrupted) throw new Error("expected_completed_night_fixture");
  return result;
}
