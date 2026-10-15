/**
 * 单元测试验证 F01 的默认 SDK／ACP 与纯观察回退。输入是 P0 同一六席牌序、
 * 隐藏 camp 干预、手写请求和无网络假客户端；手写选择 2 号为独立新政策预期。
 * 同时验证严格窗口不调用策略、脱离冻结的观察及特权测试驱动的原请求身份。
 * 不运行完整对局、不调用模型、不修改旧 golden；旧 Baseline 反例保持独立。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { Camp, Phase, Role } from "../../../src/domain/identity";
import type { ActionRequest } from "../../../src/domain/actions";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { ObservationFallbackStrategy } from "../../../src/ai/agents/providers/observation-fallback";
import { PlayerPromptPolicy } from "../../../src/ai/agents/player/player_prompt_policy";
import type { PlayerObservation } from "../../../src/game/observation/player-observation";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
} from "../../../src/game/mechanisms";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { NoActionToolLoopClient } from "../../support/drivers/agents/llm-clients";

const roles = [Role.Wolf, Role.HiddenWolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard];
const board = {
  ...sixPlayerMvpConfig,
  roleSetups: [...new Set(roles)].map((role) => ({
    role,
    count: roles.filter((r) => r === role).length,
  })),
};
const fixture = () => bootstrapGame(board, { fixedRoles: roles });
const policy = (game: ReturnType<typeof fixture>) =>
  new PlayerPromptPolicy(game.world, {
    boardConfig: board,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
  });
function request(game: ReturnType<typeof fixture>, strict = false) {
  return new GameActionRequestFactory(game.world, [], 1).create({
    actorId: 1,
    phase: Phase.Night,
    stage: "wolf_vote",
    allowedTools: ["kill_vote"],
    requiresAction: true,
    summary: "Choose the visible target",
    context: strict ? { action_failure_policy: "error", allow_fallback: false } : {},
  });
}

for (const transport of ["sdk", "acp"] as const) {
  test(`${transport}: the default fallback chooses the same target when only hidden camp changes`, async () => {
    const actions = [];
    const observations = [];
    for (const hiddenCamp of [Camp.Wolf, Camp.Good]) {
      const game = fixture();
      game.world.getComponent(2, COMPONENT.Camp)!.camp = hiddenCamp;
      const input = request(game);
      observations.push(policy(game).buildObservation(input));
      const provider =
        transport === "sdk"
          ? new LlmActionProvider(game.world, new NoActionToolLoopClient(), {
              boardConfig: board,
              llmTimeoutMs: 2000,
            })
          : new AcpActionProvider(game.world, {
              boardConfig: board,
              turnTimeoutMs: 2000,
              sessionFactory: {
                async createSession() {
                  throw Error("synthetic_transport_unavailable");
                },
              },
            });
      try {
        actions.push(await provider.getAction(input));
      } finally {
        await provider.close();
      }
    }
    expect(observations[1]).toEqual(observations[0]);
    expect(actions).toEqual([
      { name: "kill_vote", args: { target_id: 2, abstain: false } },
      { name: "kill_vote", args: { target_id: 2, abstain: false } },
    ]);
  });

  test(`${transport}: a strict request never calls the observation fallback strategy`, async () => {
    const game = fixture();
    let calls = 0;
    const fallbackStrategy = {
      async decide() {
        calls++;
        throw Error("strict_fallback_must_not_run");
      },
    };
    const provider =
      transport === "sdk"
        ? new LlmActionProvider(game.world, new NoActionToolLoopClient(), {
            boardConfig: board,
            fallbackStrategy,
          })
        : new AcpActionProvider(game.world, {
            boardConfig: board,
            fallbackStrategy,
            sessionFactory: {
              async createSession() {
                throw Error("synthetic_transport_unavailable");
              },
            },
          });
    try {
      await expect(provider.getAction(request(game, true))).rejects.toThrow("action_turn_failed");
    } finally {
      await provider.close();
    }
    expect(calls).toBe(0);
  });
}

test("custom production strategies receive frozen detached observations, not original request authority", async () => {
  const game = fixture();
  const input = request(game);
  let seen: PlayerObservation | undefined;
  const provider = new LlmActionProvider(game.world, new NoActionToolLoopClient(), {
    boardConfig: board,
    fallbackStrategy: {
      async decide(observation) {
        seen = observation;
        return { name: "kill_vote", args: { target_id: 2, abstain: false } };
      },
    },
  });
  try {
    await provider.getAction(input);
  } finally {
    await provider.close();
  }
  expect(seen).toBeDefined();
  expect(seen!.request).not.toBe(input);
  expect(seen!.request.context).not.toBe(input.context);
  expect(Object.isFrozen(seen)).toBe(true);
  expect(Object.isFrozen(seen!.knownAliveIds)).toBe(true);
  expect("death_action_id" in seen!.request.context).toBe(false);
  expect(seen!.teammateIds).toEqual([]);
});

test("explicit privileged test overrides still receive the original request", async () => {
  const game = fixture();
  const input = request(game);
  let seen: ActionRequest | undefined;
  const provider = new LlmActionProvider(game.world, new NoActionToolLoopClient(), {
    boardConfig: board,
    privilegedFallbackProvider: {
      async getAction(original) {
        seen = original;
        return null;
      },
    },
  });
  try {
    await provider.getAction(input);
  } finally {
    await provider.close();
  }
  // SDK 仍可能添加 deadline alias；原 context 与绑定 authority 必须保持。
  expect(seen!.context).toBe(input.context);
  expect(seen!.actorId).toBe(input.actorId);
});

test("the pure strategy uses no game RNG and preserves localized default speech", async () => {
  const game = fixture();
  const projection = policy(game);
  const input = request(game);
  const observation = projection.buildObservation(input);
  const strategy = new ObservationFallbackStrategy("zh-CN");
  expect(await strategy.decide(observation)).toEqual(await strategy.decide(observation));
  const speech = projection.buildObservation({
    ...input,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { ...input.context, stage: "day_speech" },
  });
  expect(await strategy.decide(speech)).toEqual({
    name: "speak",
    args: { text: "我是1号，先听后位发言再判断。" },
  });
});
