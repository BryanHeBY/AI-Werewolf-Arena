/**
 * 单元测试：验证预言家状态 owner 的原角色／能力构造。输入为手写查验数据、重复安装模板及抛错历史方法；原字段、同引用及读取日志为预期，不使用模型、对局驱动、归档 fixture 或生产生成期望。
 */
import type { SeerState, SeerReadState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Camp, Role, type InspectionResult } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { World } from "../../../../src/core/domain/world";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { captureNightAbilityScope } from "../../../../src/game/mechanisms/roles/ability_scope";
import {
  getSeerState,
  setSeerState,
  recordSeerInspection,
  recordRecipientSeerInspection,
} from "../../../../src/game/mechanisms/roles/seer/state";
import {
  getSeerState as legacyGetSeerState,
  setSeerState as legacySetSeerState,
} from "../../../../src/game/mechanisms/roles/seer/state";

const emptyState = (): SeerState => ({ lastTarget: null, lastIsWerewolf: null, history: [] });

test("the original ability slot owns installation copies and repeated reads; replacing state revokes its captured scope", () => {
  const world = new World("en"),
    id = world.createEntity(),
    role = createRoleComponent(Role.Seer, Camp.Good, "en"),
    template = emptyState();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Alive, createAliveComponent(true, "en"));
  const owned = setSeerState(role, template),
    ability = findNightAbility(role, "seer_check")!,
    scope = captureNightAbilityScope(world, id, ability, 1, () => true)!;

  expect(legacyGetSeerState).toBe(getSeerState);
  expect(legacySetSeerState).toBe(setSeerState);
  expect(owned).not.toBe(template);
  expect(owned.history).not.toBe(template.history);
  expect(getSeerState(role)).toBe(owned);
  expect(getSeerState(role, ability.id)).toBe(owned);
  expect(ability.state as SeerReadState).toBe(owned);
  expect(Object.hasOwn(role.privateState, "seer")).toBe(false);
  expect(Object.keys(owned)).toEqual(["lastTarget", "lastIsWerewolf", "history"]);
  (owned as SeerState).history.push({ targetId: 9, isWerewolf: true });
  expect(template.history).toEqual([]);
  expect(scope.isEligible()).toBe(true);

  const replacement = setSeerState(role, template);
  expect(findNightAbility(role, "seer_check")).toBe(ability);
  expect(ability.state as SeerReadState).toBe(replacement);
  expect(replacement).not.toBe(owned);
  expect(replacement.history).toEqual([]);
  expect(scope.isOwnerCurrent()).toBe(false);
  (ability as { disabled: boolean }).disabled = true;
  expect(getSeerState(role)).toBe(replacement);
});

test("ordinary inspection preserves the stored/history references and independent full-result copies", () => {
  const state = emptyState(),
    history = state.history,
    result: InspectionResult = { kind: "combined", camp: "wolf", role: "hidden_wolf" };
  recordSeerInspection(state, 7, true, result);
  expect(state).toEqual({
    lastTarget: 7,
    lastIsWerewolf: true,
    lastResult: { kind: "combined", camp: "wolf", role: "hidden_wolf" },
    history: [
      {
        targetId: 7,
        isWerewolf: true,
        result: { kind: "combined", camp: "wolf", role: "hidden_wolf" },
      },
    ],
  });
  expect(state.history).toBe(history);
  expect(state.lastResult).not.toBe(result);
  expect(state.history[0]!.result).not.toBe(result);
  expect(state.history[0]!.result).not.toBe(state.lastResult);
  result.camp = "good";
  expect(state.lastResult).toEqual({ kind: "combined", camp: "wolf", role: "hidden_wolf" });
  expect(Object.hasOwn(state, "uses")).toBe(false);
});

test("a history failure retains exactly the preceding scalar writes and the original error", () => {
  const state = emptyState(),
    failure = new Error("history_push_rejected");
  Object.defineProperty(state.history, "push", {
    value: () => {
      throw failure;
    },
  });
  let caught: unknown;
  try {
    recordSeerInspection(state, 4, false, { kind: "camp", camp: "good" });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(state).toEqual({
    lastTarget: 4,
    lastIsWerewolf: false,
    lastResult: { kind: "camp", camp: "good" },
    history: [],
  });
});

test("recipient inspection keeps repeated owner-field reads and their failure prefix", () => {
  const role = createRoleComponent(Role.Seer, Camp.Good, "en"),
    state = setSeerState(role, emptyState()),
    ability = findNightAbility(role, "seer_check")!,
    accesses: string[] = [],
    failure = new Error("recipient_history_push_rejected");
  Object.defineProperty(ability, "state", {
    get: () => {
      accesses.push("state");
      return state;
    },
  });
  const target = {
    get id() {
      accesses.push("target");
      return 6;
    },
  };
  Object.defineProperty(state.history, "push", {
    value: () => {
      accesses.push("push");
      throw failure;
    },
  });
  let caught: unknown;
  try {
    recordRecipientSeerInspection(ability, target, false, { kind: "camp", camp: "good" });
  } catch (error) {
    caught = error;
  }
  expect(accesses).toEqual(["state", "target", "state", "state", "state", "target", "push"]);
  expect(caught).toBe(failure);
  expect(state).toEqual({
    lastTarget: 6,
    lastIsWerewolf: false,
    lastResult: { kind: "camp", camp: "good" },
    history: [],
  });
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBe(null);
});
