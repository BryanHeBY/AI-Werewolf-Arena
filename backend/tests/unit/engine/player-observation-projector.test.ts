/**
 * 单元测试验证完整观察捕获 owner 的已知存活、上下文裁剪、晚查询和脱离冻结。
 * 输入为内存 World、手写请求、未公开死亡和带访问器的旧 policy；预期来自独立字段与调用前缀，
 * 不用生产投影生成 oracle，不执行模型或完整对局。捕获不调用角色原文／人设，不授予行动写权限。
 */
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { Camp, Phase, Role, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import {
  bindRolePresentation,
  createRoleComponent,
} from "../../../src/agents/observation/role-presentation";

import { createIdentityComponent } from "../../../src/domain/entities/player";
import { capturePlayerObservation } from "../../../src/agents/observation/player-observation-projector";
import {
  freezeObservation,
  type PlayerObservation,
} from "../../../src/agents/observation/player-observation";
import { PlayerPromptPolicy } from "../../../src/agents/player/player-prompt-policy";
import {
  getDefaultConfigRenderRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultRoleCatalog,
  getDefaultTargetHintRegistry,
  getDefaultToolSpecRegistry,
} from "../../../src/rulesets/mechanism-api";

function fixture() {
  const world = new World();
  world.createEntity();
  world.createEntity();
  const role = createRoleComponent(Role.Villager);
  world.addComponent(1, COMPONENT.Role, role);
  world.addComponent(1, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(1, COMPONENT.Identity, createIdentityComponent(1, 1, "原文 Player"));
  world.addComponent(2, COMPONENT.Alive, createAliveComponent(false));
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Voting,
    allowedTools: ["vote"],
    context: {
      day: 1,
      stage: "voting",
      visible_events: [],
      turn_constraints: {},
      wall_id: "wall:1",
      death_action_id: 2,
      debate_id: "debate:3",
      wolf_target: null,
    },
  };
  return { world, role, request };
}

test("unannounced deaths remain knowledge candidates and only the three original context IDs are removed", () => {
  const f = fixture();
  const queries = {
    world: () => f.world,
    catalog: () => getDefaultRoleCatalog(),
    role: (actorId: () => number) => f.world.getComponent(actorId(), COMPONENT.Role),
    wolfTeammates: (actorId: () => number) => {
      expect(actorId()).toBe(1);
      return [8];
    },
  };
  const view = capturePlayerObservation(f.request, queries);
  expect(view.identity).toEqual({ role: Role.Villager, camp: Camp.Good, name: "原文 Player" });
  expect(view.knownAliveIds).toEqual([1, 2]);
  expect(view.teammateIds).toEqual([8]);
  expect(view.ownState).toEqual({});
  expect(view.abilities).toEqual([]);
  expect(view.deathAbilities).toEqual([]);
  expect(view.request.context).toEqual({
    day: 1,
    stage: "voting",
    visible_events: [],
    turn_constraints: {},
    wolf_target: null,
  });
  f.request.context.visible_events.push({
    seq: 1,
    type: "additional_deaths",
    payload: { deaths: [2] },
  });
  expect(capturePlayerObservation(f.request, queries).knownAliveIds).toEqual([1]);
  expect(view.request.context.visible_events).toEqual([]);
  expect(Object.isFrozen(view.request.context)).toBe(true);
});

test("policy methods are looked up before actor getters and capture does not invoke custom role or persona text", () => {
  const f = fixture();
  const trace: string[] = [];
  let roleText = 0,
    personaText = 0;
  bindRolePresentation(f.role, () => {
    roleText++;
    return "custom raw text";
  });
  const policy = new PlayerPromptPolicy(f.world, {
    personalityPromptResolver: () => {
      personaText++;
      return "custom personality";
    },
    boardConfig: {
      boardSize: 2,
      roleSetups: [{ role: Role.Villager, count: 2 }],
      enableSheriff: false,
      hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    },
    roleCatalog: getDefaultRoleCatalog(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
  });
  Object.defineProperty(policy, "role", {
    get() {
      trace.push("role-method");
      return (actorId: number) => {
        trace.push("role-call");
        return f.world.getComponent(actorId, COMPONENT.Role);
      };
    },
  });
  Object.defineProperty(policy, "wolfTeammates", {
    get() {
      trace.push("team-method");
      return (actorId: number) => {
        trace.push("team-call");
        expect(actorId).toBe(1);
        return [8];
      };
    },
  });
  Object.defineProperty(f.request, "actorId", {
    enumerable: true,
    get() {
      trace.push("actor");
      return 1;
    },
  });
  const view = policy.buildObservation(f.request);
  expect(trace.slice(0, 3)).toEqual(["role-method", "actor", "role-call"]);
  const team = trace.indexOf("team-method");
  expect(trace.slice(team, team + 3)).toEqual(["team-method", "actor", "team-call"]);
  expect(view.teammateIds).toEqual([8]);
  expect(roleText).toBe(0);
  expect(personaText).toBe(0);
});

test("canonical observation freezing retains nullable knowledge and detaches every nested original field", () => {
  const f = fixture();
  const original: PlayerObservation = {
    request: f.request,
    identity: { role: Role.Villager, camp: Camp.Good },
    players: [],
    knownAliveIds: [1, 2],
    teammateIds: [],
    currentWolfActions: { canChat: false, canVoteForKill: false },
    abilities: [],
    deathAbilities: [],
    ownNightActions: [],
    ownState: { foxCub: { remaining: 1, lastChoice: null } },
  };
  const frozen = freezeObservation(original);
  original.knownAliveIds.push(3);
  original.ownState.foxCub!.remaining = 0;
  expect(frozen.knownAliveIds).toEqual([1, 2]);
  expect(frozen.ownState.foxCub).toEqual({ remaining: 1, lastChoice: null });
  expect(Object.isFrozen(frozen)).toBe(true);
  expect(Object.isFrozen(frozen.knownAliveIds)).toBe(true);
  expect(Object.isFrozen(frozen.ownState.foxCub)).toBe(true);
});
