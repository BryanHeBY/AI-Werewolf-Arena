/**
 * Unit tests for turn-constraints; In-memory turn-constraints decision/turn/client control with supplied mocks or DTOs; no physical transport.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { ActionRequest, Phase } from "../../../src/core/domain/model";
import {
  evaluateTurnConstraints,
  resolveTurnConstraints,
} from "../../../src/ai/agents/player/turn_constraints";

describe("turn_constraints", () => {
  test("permits no action when turn_constraints is absent", () => {
    const request: ActionRequest = {
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    };
    const resolved = resolveTurnConstraints(request);
    expect(resolved.minValidActions).toBe(0);
    expect(resolved.maxValidActions).toBe(1);
  });

  test("honors explicit turn_constraints payload", () => {
    const request: ActionRequest = {
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak", "vote"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        turn_constraints: {
          min_valid_actions: 1,
          max_valid_actions: 2,
          required_any_tools: ["vote"],
          summary: "本轮必须完成投票动作。",
        },
      },
    };
    const resolved = resolveTurnConstraints(request);
    expect(resolved.minValidActions).toBe(1);
    expect(resolved.maxValidActions).toBe(2);
    expect(resolved.requiredAnyTools).toEqual(["vote"]);
    expect(resolved.summary).toBe("本轮必须完成投票动作。");
  });

  test("evaluateTurnConstraints rejects when required tool is missing", () => {
    const evaluation = evaluateTurnConstraints(
      {
        validActions: [{ name: "speak", args: { text: "x" } }],
      },
      {
        minValidActions: 1,
        maxValidActions: 2,
        requiredAnyTools: ["vote"],
      },
    );
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors.join(" ")).toContain("结束前必须至少执行以下工具之一");
  });
});
