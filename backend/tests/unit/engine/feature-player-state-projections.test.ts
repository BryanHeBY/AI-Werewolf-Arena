/**
 * 单元测试验证赤月使徒、梦魇、恶灵骑士各自拥有的玩家数据裁剪与实际观察消费。
 * 输入为手写合法／畸形私有状态及内存 World；预期使用独立字面字段，不调用投影生成 oracle。
 * 检查副本隔离、历史额外属性不执行、畸形字段拒绝及观察统一冻结；不运行模型或完整对局。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { projectRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/state-slot";
import { projectNightmareShadowState } from "../../../src/game/mechanisms/roles/nightmare_shadow/state";
import { projectEvilKnightState } from "../../../src/game/mechanisms/roles/evil_knight/state";
import { capturePlayerObservation } from "../../../src/game/observation/player-observation-projector";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/role-catalog-assembly";

test("red moon and evil knight return selected detached data and retain invalid-slot rejection", () => {
  const red = createRoleComponent(Role.RedMoonApostle, Camp.Wolf);
  const redState = {
    policy: "awa_red_moon_demon_v1",
    lastWolfBlastPolicy: "forbidden",
    blastDay: null,
    exileDay: 2,
    expirySettled: false,
  };
  Object.assign(red.privateState, { redMoon: redState });
  const redView = projectRedMoonState(red)!;
  expect(redView).toEqual({
    policy: "awa_red_moon_demon_v1",
    lastWolfBlastPolicy: "forbidden",
    blastDay: null,
    exileDay: 2,
    expirySettled: false,
  });
  expect(redView).not.toBe(redState);
  redView.expirySettled = true;
  expect(redState.expirySettled).toBe(false);
  Object.defineProperty(redState, "extra", { value: 1 });
  expect(projectRedMoonState(red)).toBeUndefined();

  const evil = createRoleComponent(Role.EvilKnight, Camp.Wolf);
  const evilState = {
    policy: "awa_evil_knight_v1",
    shotPolicy: "hunter_shot_bypasses",
    reflectionRemaining: 1,
  };
  Object.assign(evil.privateState, { evilKnight: evilState });
  expect(projectEvilKnightState(evil)).toEqual({
    policy: "awa_evil_knight_v1",
    shotPolicy: "hunter_shot_bypasses",
    reflectionRemaining: 1,
  });
  expect(projectEvilKnightState(evil)).not.toBe(evilState);
  evilState.reflectionRemaining = 3;
  expect(projectEvilKnightState(evil)).toBeUndefined();
});

test("nightmare copies ordered nullable history without array helpers or extra-entry accessors", () => {
  const role = createRoleComponent(Role.NightmareShadow, Camp.Wolf);
  const entry = { day: 1, targetId: null };
  const history = [entry, { day: 2, targetId: 4 }];
  Object.defineProperty(history, "map", {
    get() {
      throw new Error("array_map_must_not_run");
    },
  });
  Object.defineProperty(entry, "secret", {
    enumerable: true,
    get() {
      throw new Error("extra_entry_getter_must_not_run");
    },
  });
  Object.assign(role.privateState, {
    nightmareShadow: {
      policy: "awa_nightmare_dreamer_v1",
      fearActionPolicy: "required_when_legal",
      wolfActionPolicy: "no_blast_no_self_knife",
      packReady: true,
      lastDay: 2,
      lastTarget: 4,
      history,
    },
  });
  const view = projectNightmareShadowState(role)!;
  expect(view).toEqual({
    policy: "awa_nightmare_dreamer_v1",
    fearActionPolicy: "required_when_legal",
    wolfActionPolicy: "no_blast_no_self_knife",
    packReady: true,
    lastDay: 2,
    lastTarget: 4,
    history: [
      { day: 1, targetId: null },
      { day: 2, targetId: 4 },
    ],
  });
  expect(view.history).not.toBe(history);
  expect(view.history[0]).not.toBe(entry);
  view.history[0]!.targetId = 7;
  expect(entry.targetId).toBeNull();
  // 投影不是新的授权检查：既有槽位校验拒绝访问器时，不执行它或制造默认状态。
  Object.defineProperty(history[1]!, "targetId", {
    get() {
      throw new Error("malformed_target_getter_must_not_run");
    },
  });
  expect(projectNightmareShadowState(role)).toBeUndefined();
});

test("the observation consumer freezes the mechanism projection without changing live stock", () => {
  const world = new World();
  world.createEntity();
  const role = createRoleComponent(Role.EvilKnight, Camp.Wolf);
  const liveState = {
    policy: "awa_evil_knight_v1",
    shotPolicy: "night_shot_immune",
    reflectionRemaining: 0,
  };
  Object.assign(role.privateState, { evilKnight: liveState });
  world.addComponent(1, COMPONENT.Role, role);
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Night,
    allowedTools: [],
    context: { day: 1, stage: "witch", visible_events: [], turn_constraints: {} },
  };
  const view = capturePlayerObservation(request, {
    world: () => world,
    role: () => role,
    wolfTeammates: () => [],
    catalog: () => getDefaultRoleCatalog(),
  });
  expect(view.ownState.evilKnight).toEqual({
    policy: "awa_evil_knight_v1",
    shotPolicy: "night_shot_immune",
    reflectionRemaining: 0,
  });
  expect(Object.isFrozen(view.ownState.evilKnight)).toBe(true);
  expect(Object.isFrozen(liveState)).toBe(false);
  liveState.reflectionRemaining = 1;
  expect(view.ownState.evilKnight!.reflectionRemaining).toBe(0);
});
