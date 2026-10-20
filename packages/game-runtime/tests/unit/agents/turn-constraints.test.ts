/**
 * 单元测试用原内存请求、约束 DTO 与明确畸形输入验证回合约束解析／评估。原字面预期、引用快照和拒绝断言构成 oracle；迁移不重新生成预期。测试组件／mock 不运行模型或物理传输，支持文件、fixture 字节、政策与状态行为保持。
 */
import { ActionRequest, Phase } from "../../../src/domain/model";
import {
  evaluateTurnConstraints,
  resolveTurnConstraints,
} from "../../../src/engine/actions/turn-constraints";

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
