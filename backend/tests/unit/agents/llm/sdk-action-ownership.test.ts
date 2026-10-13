/**
 * 单元测试：验证 SDK 行动接收的原生所有权与接收一致性。输入为原内存请求、mock 组件和非法调用；既有字面预期及引用断言检查边界，不调用模型或完整对局。
 */
import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { SdkGameToolLoop } from "../../../../src/ai/agents/llm/sdk_game_tool_loop";
import { PlayerPromptSession } from "../../../../src/ai/agents/llm/player_prompt_session";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import { LlmObserver } from "../../../../src/ai/agents/player/player_observer";
import {
  getDefaultToolCallRepairRegistry,
  getDefaultToolSpecRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../../src/game/mechanisms";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import {
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type RoleComponent,
} from "../../../../src/core";
import { getWitchState } from "../../../../src/game/mechanisms/roles/witch/ports";
import type {
  ChatModelClient,
  ToolLoopCallbacks,
  ToolLoopStepTrace,
} from "../../../../src/ai/integrations/llm/transport";

const roles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const request: ActionRequest = {
  actorId: 6,
  phase: Phase.Night,
  allowedTools: ["use_potion"],
  context: {
    day: 1,
    stage: "witch",
    wolf_target: 9,
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
};

function sdkLoop(
  world: ReturnType<typeof bootstrapGame>["world"],
  onTrace?: (trace: ToolLoopStepTrace[]) => void,
) {
  const policy = new PlayerPromptPolicy(world, {
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    roleCatalog: getDefaultRoleCatalog(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
  const observer = new LlmObserver({ trace: false, printLlmIo: false, printThinking: false });
  if (onTrace) observer.thinking = onTrace;
  return new SdkGameToolLoop(
    world,
    getDefaultToolCallRepairRegistry(),
    new PlayerPromptSession({ maxPromptEvents: 20, promptPolicy: policy }),
    observer,
  );
}

const submissions = [
  {
    turn_id: "t99",
    action: "use_potion",
    arguments: { target_id: 6, potion_type: PotionType.None },
  },
  { turn_id: "t1", action: "speak", arguments: { text: "wrong tool" } },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 9, potion_type: PotionType.Heal, private_override: "synthetic-secret" },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 6, potion_type: PotionType.Heal },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 9, potion_type: PotionType.Heal },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 999, potion_type: PotionType.Poison },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 6, potion_type: PotionType.None },
  },
  {
    turn_id: "t1",
    action: "use_potion",
    arguments: { target_id: 9, potion_type: PotionType.Poison },
  },
];

test("SDK owns its accepted action, rejects callbacks after completion/timeout, and ignores a fabricated transport finalAction", async () => {
  const game = bootstrapGame(twelvePlayerStandardConfig, { fixedRoles: roles, locale: "en" });
  let callback!: ToolLoopCallbacks<import("../../../../src/core").ToolCall>["onToolCall"];
  const submitted = { id: "synthetic", name: "submit_action", rawArgs: "{}", args: submissions[6] };
  const forgedClient = {
    chat: async () => "",
    async runToolLoop<T>(_messages: unknown, _tools: unknown, callbacks: any) {
      callback = callbacks.onToolCall;
      return {
        finalAction: {
          name: "use_potion",
          args: { target_id: 9, potion_type: PotionType.Poison },
        } as T,
        assistantText: "",
      };
    },
  } as ChatModelClient;
  expect((await sdkLoop(game.world).run(forgedClient, request, [], 1000, "t1")).action).toBeNull();
  expect((await callback(submitted)).toolResult).toMatchObject({
    ok: false,
    error: "turn_not_open_or_session_invalid",
  });
  const hanging = {
    chat: async () => "",
    async runToolLoop<T>(_messages: unknown, _tools: unknown, callbacks: any) {
      callback = callbacks.onToolCall;
      return new Promise<never>(() => {});
    },
  } as ChatModelClient;
  await expect(sdkLoop(game.world).run(hanging, request, [], 30, "t1")).rejects.toThrow(
    "llm_request_timeout_30ms",
  );
  expect((await callback(submitted)).toolResult).toMatchObject({
    ok: false,
    error: "turn_not_open_or_session_invalid",
  });
  expect(
    (
      await callback({
        id: "late-report",
        name: "report_bug",
        rawArgs: "{}",
        args: {
          turn_id: "t1",
          category: "state",
          severity: "high",
          message: "late synthetic report",
        },
      })
    ).toolResult,
  ).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(getWitchState(game.world.getComponent(6, COMPONENT.Role)!)!.poison).toBe(1);
});
