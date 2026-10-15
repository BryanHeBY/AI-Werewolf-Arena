/**
 * 单元测试以可选自爆及必需行动 context 为输入，用精确最小／最大次数和允许工具断言核对请求要求，不虚构提交。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { buildTurnConstraintContext } from "../../../src/engine/actions/turn-constraints-context";

describe("turn constraint context", () => {
  test("optional self-destruct window can end without self_destruct", () => {
    expect(
      buildTurnConstraintContext({
        requiresAction: false,
        allowedTools: ["self_destruct"],
        summary: "可选择自爆，也可结束回合。",
      }),
    ).toEqual({
      min_valid_actions: 0,
      max_valid_actions: 1,
      required_any_tools: [],
      summary: "可选择自爆，也可结束回合。",
    });
  });

  test("required action still requires one allowed tool", () => {
    expect(
      buildTurnConstraintContext({
        requiresAction: true,
        allowedTools: ["vote"],
      }),
    ).toMatchObject({
      min_valid_actions: 1,
      required_any_tools: ["vote"],
    });
  });
});
