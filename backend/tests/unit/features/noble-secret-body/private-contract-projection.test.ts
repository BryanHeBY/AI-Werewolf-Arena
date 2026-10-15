/**
 * 单元测试负责验证字面贵族 owner 契约的精确字段投影及私有额外字段／getter 拒绝。受控 bootstrap／prompt、受众与状态包及零读取 canary 为输入；原断言保持，不执行真实日夜、记录器或模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, createRandom } from "../../../../src/domain";
import { nobleSecretBodyTwelveConfig } from "../../../../src/runtime/scenarios/noble_secret_body_twelve";
import { PlayerPromptPolicy } from "../../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../../src/game/mechanisms";
import { buildAgentVisibleEvent } from "../../../../src/game/engine/agent_visible_event_feed";
import { AgentEventVisibilityRegistry } from "../../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import { readNobleSecretBodyFact, NOBLE_SECRET_BODY_POLICY } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";

function setup(locale: "zh-CN" | "en") {
  const config = nobleSecretBodyTwelveConfig();
  const g = bootstrapGame(config, {
    locale,
    fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    random: createRandom("noble-delivery-private"),
  });
  const policy = new PlayerPromptPolicy(g.world, {
    boardConfig: config,
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  });
  return { ...g, config, policy };
}

test("flat nested known contract is accepted; private snapshots whitelist source and authorization", () => {
  const g = setup("en"),
    registry = new AgentEventVisibilityRegistry();
  const e = {
    timestamp: 1,
    type: "noble_night_notified",
    payload: {
      policy: NOBLE_SECRET_BODY_POLICY,
      actorId: 1,
      day: 3,
      wolfActionPolicy: "standard",
      lastNotifiedNight: 3,
      lastChoice: { day: 2, targetId: 6 },
      contracts: [
        {
          id: "servant:night:2",
          targetId: 6,
          createdNight: 2,
          expiresNight: 3,
          status: { kind: "cleared", day: 2 },
        },
      ],
    },
    audience: [1],
  } as any;
  expect(readNobleSecretBodyFact(e.type, e.payload)).not.toBeNull();
  expect(buildAgentVisibleEvent(g.world, e, 1, 1)?.payload).toEqual(e.payload);
  for (const actor of [2, 4, 5, 6, 10]) {
    expect(registry.canView(g.world, e, actor)).toBe(false);
    expect(buildAgentVisibleEvent(g.world, e, actor, 1)).toBeNull();
  }
  for (const audience of [[], [6], [1, 6], [1, 1]])
    expect(buildAgentVisibleEvent(g.world, { ...e, audience }, 1, 1)).toBeNull();
  for (const key of ["cause", "camp", "source", "rawUses", "lastUsedDay"]) {
    const f = structuredClone(e);
    f.payload.contracts[0].status[key] = "CANARY";
    expect(readNobleSecretBodyFact(f.type, f.payload)).toBeNull();
    expect(buildAgentVisibleEvent(g.world, f, 1, 1)).toBeNull();
  }
  let getters = 0;
  const f = structuredClone(e);
  Object.defineProperty(f.payload.contracts[0].status, "kind", {
    enumerable: true,
    get() {
      getters++;
      return "cleared";
    },
  });
  expect(buildAgentVisibleEvent(g.world, f, 1, 1)).toBeNull();
  expect(getters).toBe(0);
});
