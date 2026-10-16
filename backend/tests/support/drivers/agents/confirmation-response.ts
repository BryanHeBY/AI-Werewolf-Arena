/**
 * 测试驱动消费合成模型刚收到的确认警示，重发字面计划中已选择的同一行动；不生成行动或预期结果。
 * 输入为真实 SDK HTTP 消息，输出为带原编号的第二次工具调用或 undefined。
 * 只接收最后一条工具回执，不修改冻结 fixture、领域状态、计划游标或时间预算。
 */
import { isDeepStrictEqual } from "node:util";

export function confirmationResponse(body: any): Response | undefined {
  const last = body.messages.at(-1);
  if (last?.role !== "tool" || typeof last.content !== "string") return;
  const receipt = JSON.parse(last.content);
  if (receipt.status !== "confirmation_required") return;
  if (
    receipt.ok !== true ||
    receipt.accepted !== false ||
    receipt.applied !== false ||
    typeof receipt.confirmation_id !== "string" ||
    typeof receipt.warning !== "string"
  )
    throw new Error("fixture_confirmation_receipt_invalid");
  const call = body.messages
    .flatMap((m: any) => m.tool_calls ?? [])
    .find((c: any) => c.id === last.tool_call_id);
  if (call?.function?.name !== "submit_action")
    throw new Error("fixture_confirmation_call_missing");
  const proposal = JSON.parse(call.function.arguments);
  // 校验后的回执可能按 schema 重排键；所有参数值仍须一致，不能把序列化顺序当成行动变更。
  if (
    proposal.action !== receipt.action ||
    !isDeepStrictEqual(proposal.arguments, receipt.arguments)
  )
    throw new Error("fixture_confirmation_proposal_changed");
  return Response.json({
    id: "synthetic-confirmation",
    object: "chat.completion",
    created: 1,
    model: "synthetic",
    choices: [
      {
        index: 0,
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `${call.id}-confirm`,
              type: "function",
              function: {
                name: "submit_action",
                arguments: JSON.stringify({
                  ...proposal,
                  confirmation_id: receipt.confirmation_id,
                }),
              },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}
