import { COMPONENT, type World } from "../../src/core";
import { StatusMarksComponent } from "../../src/core/domain/components/status_marks";
import { getDefaultRoleCatalog } from "../../src/game/mechanisms/roles/catalog";
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
      let marks = input.world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks);
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
