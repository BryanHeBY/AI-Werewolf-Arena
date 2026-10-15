/**
 * 文件系统 agent 集成测试将受控非法工具调用送入真实会话输出及临时录制器，核对必需回合重试被拒。预期为字面重试次数和已录领域拒绝诊断；provider 传输不执行动作，不运行完整对局或模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Phase, Role, type ActionRequest } from "../../../src/domain";
import { LlmActionProvider } from "../../../src/agents/llm/llm-action-provider";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../src/recording/session/context";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];

const request = (strict: boolean): ActionRequest => ({
  actorId: 5,
  phase: Phase.Night,
  allowedTools: ["guard"],
  context: {
    day: 1,
    stage: "guard",
    visible_events: [],
    turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 },
    ...(strict ? { action_failure_policy: "error" } : {}),
  },
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: required-turn retry domain rejection retains a no_valid_action reason instead of transport diagnostics`, async () => {
    const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale });
    let attempts = 0;
    const client: any = {
      async chat() {
        throw new Error("unexpected_chat");
      },
      async runToolLoop(_m: any, _t: any, callbacks: any) {
        attempts++;
        if (attempts > 1)
          for (let i = 0; i < 3; i++)
            await callbacks.onToolCall({
              name: "submit_action",
              args: {
                turn_id: "t1",
                action: "guard",
                arguments: { target_id: 999, abstain: false },
              },
            });
        return { finalAction: null, assistantText: "End" };
      },
    };
    const provider = new LlmActionProvider(world, client, { llmTimeoutMs: 1500 });
    const input = request(true);
    input.context.turn_constraints.min_valid_actions = 1;
    const manager = await SessionRecordManager.create(
      {
        sessionId: `strict-retry-${locale}`,
        board: "synthetic",
        locale,
        startedAtIso: new Date(0).toISOString(),
      },
      await createTestTempDirectory("awa-strict-retry-"),
    );
    await runWithSessionRecorder(manager, async () => {
      await expect(provider.getAction(input)).rejects.toThrow("action_turn_failed");
      await provider.close();
    });
    expect(attempts).toBe(2);
    const summary = await manager.finalize({
      endedAtIso: new Date(1).toISOString(),
      winner: null,
      finishReason: "test",
      players: [],
    });
    const view = summary.playerViews.find((player) => player.player_id === 5)!;
    expect(JSON.stringify(view)).toContain("turn_invalid_action_limit");
    expect(JSON.stringify(view)).not.toContain("transport_error");
    expect(
      view.timeline.some(
        (entry) =>
          entry.kind === "turn" &&
          entry.delta_messages.some((message) => message.kind === "constraint_warning"),
      ),
    ).toBe(true);
  });
