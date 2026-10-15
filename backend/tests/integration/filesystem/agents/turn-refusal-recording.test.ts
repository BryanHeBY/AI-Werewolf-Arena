/**
 * 集成测试验证 turn-refusal-recording 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { PotionType } from "../../../../src/domain";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/domain/components/names";
import { RoleComponent } from "../../../../src/domain/components/role";
import { Phase } from "../../../../src/domain/model";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import path from "path";
import { promises as fs } from "fs";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { REQUIRED_ACTION_CONSTRAINTS, FallbackProvider } from "../../../support/drivers/agents/llm-clients";

describe("LlmActionProvider protocol", () => {

  test("returns actionable turn-id feedback and accepts a corrected witch action", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const root = await createTestTempDirectory("turn-id-feedback-");
    const recorder = await SessionRecordManager.create(
      {
        sessionId: "session_turn_id_feedback",
        board: "twelve_player_standard",
        startedAtIso: new Date().toISOString(),
      },
      root,
    );
    const witchId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent(id, COMPONENT.Role)?.role === "witch",
      )!;
    const client = {
      chat: async () => "",
      async runToolLoop<T>(_messages: unknown, _tools: unknown, callbacks: any) {
        const submit = (turnId: string) =>
          callbacks.onToolCall({
            id: `call-${turnId}`,
            name: "submit_action",
            rawArgs: "{}",
            args: {
              turn_id: turnId,
              action: "use_potion",
              arguments: { target_id: witchId, potion_type: PotionType.None },
            },
          });
        const rejected = await submit("t2");
        expect(rejected.toolResult).toMatchObject({
          ok: false,
          error: "turn_id_mismatch",
          expected_turn_id: "t1",
          received_turn_id: "t2",
        });
        expect(rejected.finalAction).toBeUndefined();
        const accepted = await submit(rejected.toolResult.expected_turn_id);
        expect(accepted.toolResult.ok).toBe(true);
        return { finalAction: accepted.finalAction as T, assistantText: "" };
      },
    };
    const provider = new LlmActionProvider(context.world, client, {
      privilegedFallbackProvider: new FallbackProvider(null),
    });
    await expect(
      runWithSessionRecorder(recorder, () =>
        provider.getAction({
          phase: Phase.Night,
          actorId: witchId,
          allowedTools: ["use_potion"],
          context: {
            visible_events: [],
            day: 1,
            stage: "witch",
            turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
          },
        }),
      ),
    ).resolves.toEqual({
      name: "use_potion",
      args: { target_id: witchId, potion_type: PotionType.None },
    });
    await recorder.flushNow();
    const logic = JSON.parse(
      await fs.readFile(path.join(recorder.sessionDir, "logic_ops.json"), "utf8"),
    );
    expect(logic.ops).toContainEqual(
      expect.objectContaining({
        op: "tool_call_rejected",
        status: "rejected",
        reason: "turn_id_mismatch",
        input: expect.objectContaining({ args: expect.objectContaining({ turn_id: "t2" }) }),
        output: expect.objectContaining({ expected_turn_id: "t1", received_turn_id: "t2" }),
      }),
    );
  });
});
