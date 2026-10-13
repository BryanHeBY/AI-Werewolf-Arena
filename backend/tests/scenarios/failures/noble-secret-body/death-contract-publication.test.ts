/**
 * 故障场景测试：验证贵族／不死之身真实死亡不能与仆从契约关闭分离。输入为固定身份、两个真实周期及必需死亡操作故障；死者、闭合契约和原错误为明确预期，不从复盘 verifier 推导预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, COMPONENT, type ActionRequest, type ToolCall } from "../../../../src/core";
import { nobleSecretBodyTwelveConfig } from "../../../../src/runtime/scenarios/noble_secret_body_twelve";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { checkpointNobleBodyAuthority } from "../../../../src/game/mechanisms/roles/noble_secret_body/authority";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";

test("required death-op failure must not split actual death from closing its original servant contract", async () => {
  const c = nobleSecretBodyTwelveConfig();
  const g = bootstrapGame(c, {
    fixedRoles: c.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
  });
  let faultApplied = false;
  const ops: unknown[] = [];
  const recorder = {
    recordLogicOp(op: unknown) {
      ops.push(structuredClone(op));
    },
    recordRequiredLogicOp(op: any) {
      if (
        op.op === "noble_body_death_committed" &&
        op.output.day === 2 &&
        op.output.playerId === 6
      ) {
        faultApplied = true;
        throw new Error("injected_required_append_failed");
      }
      ops.push(structuredClone(op));
    },
  };
  const provider = {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      if (r.allowedTools.includes("protect_secret_body"))
        return { name: "protect_secret_body", args: { target_id: null } };
      if (r.allowedTools.includes("choose_servant"))
        return { name: "choose_servant", args: { target_id: 6 } };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 7 } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: r.context.day === 1 ? 10 : 6, abstain: false } };
      if (r.allowedTools.includes("speak"))
        return { name: "speak", args: { text: "Literal delivery review statement." } };
      return demonNightChoice(r, 3, { knife: null, hunt: null });
    },
  };
  await runWithSessionRecorder(recorder as any, () => g.phaseManager.runSingleCycle(provider, 8));
  await expect(
    runWithSessionRecorder(recorder as any, () => g.phaseManager.runSingleCycle(provider, 8)),
  ).rejects.toThrow("injected_required_append_failed");
  expect(faultApplied).toBe(true);
  expect(g.world.getComponent(6, COMPONENT.Alive)?.alive).toBe(false);
  const cp = checkpointNobleBodyAuthority(g.world, false);
  expect(cp.knowledge.noble.contracts[0]?.status).toEqual({ kind: "pending" });
  expect(cp.noble.contracts[0]?.status).toEqual({ kind: "target_dead", day: 2 });
});
