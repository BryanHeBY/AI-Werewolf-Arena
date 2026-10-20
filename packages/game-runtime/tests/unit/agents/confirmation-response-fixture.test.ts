/**
 * 单元测试负责核对合成传输驱动的确认回执处理。输入为独立手写的原提案、键重排回执和逐字段篡改，输出原样二次提交与精确拒绝断言。
 * 预期不调用生产校验器生成；参数键顺序不是行动变化，目标、理由和确认布尔值仍必须全部相同，不推进真实对局或改写冻结样本。
 */
import { expect, test } from "bun:test";
import { confirmationResponse } from "../../support/drivers/agents/confirmation-response";

const proposal = {
  turn_id: "t1",
  action: "self_destruct_with_target",
  arguments: { target_id: 1, confirm: true, reason: "Public blast" },
};
function request(argumentsOverride: Record<string, unknown> = {}) {
  return {
    messages: [
      {
        role: "assistant",
        tool_calls: [
          {
            id: "proposal",
            type: "function",
            function: { name: "submit_action", arguments: JSON.stringify(proposal) },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "proposal",
        content: JSON.stringify({
          ok: true,
          status: "confirmation_required",
          accepted: false,
          applied: false,
          action: "self_destruct_with_target",
          arguments: { reason: "Public blast", confirm: true, target_id: 1, ...argumentsOverride },
          confirmation_id: "independent-warning-id",
          warning: "This action is permanent.",
        }),
      },
    ],
  };
}

test("same arguments in schema key order preserve the original selected proposal on confirmation", async () => {
  const body = request(),
    original = structuredClone(body);
  const response = confirmationResponse(body);
  expect(response).toBeDefined();
  const output = await response!.json();
  const call = output.choices[0].message.tool_calls[0];
  expect(call.function.name).toBe("submit_action");
  expect(JSON.parse(call.function.arguments)).toEqual({
    ...proposal,
    confirmation_id: "independent-warning-id",
  });
  expect(call.function.arguments).toContain(
    '"arguments":{"target_id":1,"confirm":true,"reason":"Public blast"}',
  );
  expect(body).toEqual(original);
});

for (const [field, value] of [
  ["target_id", 2],
  ["reason", "Changed proposal"],
  ["confirm", false],
] as const)
  test(`confirmation rejects an altered ${field} even when the other arguments match`, () => {
    expect(() => confirmationResponse(request({ [field]: value }))).toThrow(
      "fixture_confirmation_proposal_changed",
    );
  });

test("confirmation still rejects a changed action name and extra or missing arguments", () => {
  const body = request();
  const receipt = JSON.parse(body.messages[1].content!);
  receipt.action = "self_destruct";
  body.messages[1].content = JSON.stringify(receipt);
  expect(() => confirmationResponse(body)).toThrow("fixture_confirmation_proposal_changed");
  expect(() => confirmationResponse(request({ extra: true }))).toThrow(
    "fixture_confirmation_proposal_changed",
  );
  const missing = request();
  const withoutReason = JSON.parse(missing.messages[1].content!);
  delete withoutReason.arguments.reason;
  missing.messages[1].content = JSON.stringify(withoutReason);
  expect(() => confirmationResponse(missing)).toThrow("fixture_confirmation_proposal_changed");
});
