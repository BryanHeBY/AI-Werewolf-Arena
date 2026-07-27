import { buildTurnConstraintContext } from "../../src/game/engine/turn_constraints_context";

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
