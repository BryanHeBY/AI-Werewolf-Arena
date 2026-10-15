/**
 * Unit tests: Turn constraints use optional self-destruct and required-action contexts;
 * exact minimum/maximum and allowed-tool assertions check request requirements without
 * inventing submissions. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
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
