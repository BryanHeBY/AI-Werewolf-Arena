/**
 * 单元测试用字面单回合脚本和请求，验证严格脚本 provider 拒绝重复、意外及缺失回合；预期为原精确错误串和消耗断言。不运行 World、录制、传输、文件系统或模型。
 */
import { expect, test } from "bun:test";
import { Phase, type ActionRequest } from "../../../src/domain";
import { StrictScriptedPlayers, type ScriptStep } from "../../support/drivers/scripted-players";

test("strict scripts reject unexpected, duplicate and missing player turns", async () => {
  const step: ScriptStep = { actorId: 1, day: 1, stage: "day_speech", turn: 1, action: null };
  expect(() => new StrictScriptedPlayers([step, step])).toThrow("script_duplicate_step");
  const provider = new StrictScriptedPlayers([step]);
  expect(() => provider.assertConsumed()).toThrow("script_missing_requests");
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
  };
  await provider.getAction(request);
  provider.assertConsumed();
  await expect(provider.getAction(request)).rejects.toThrow("script_unexpected_request");
});
