import { ActionRequest, Phase } from "../../../src/core/domain/model";
import {
  evaluateTurnConstraints,
  resolveTurnConstraints,
} from "../../../src/ai/agents/llm/turn_constraints";

describe("turn_constraints", () => {
  test("falls back to legacy must_act when turn_constraints is absent", () => {
    const request: ActionRequest = {
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { must_act: true },
    };
    const resolved = resolveTurnConstraints(request);
    expect(resolved.minValidActions).toBe(1);
    expect(resolved.maxValidActions).toBe(1);
  });

  test("honors explicit turn_constraints payload", () => {
    const request: ActionRequest = {
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak", "vote"],
      context: {
        must_act: false,
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
