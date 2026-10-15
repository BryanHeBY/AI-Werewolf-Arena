/**
 * 单元测试验证普通狼共享装配的对象／handler 身份、派生字段覆盖及实际晚 runtime getter 调用。
 * 输入为真实角色贡献、手写请求与可恢复的宿主属性替换；输出以独立引用、工具顺序和读取轨迹断言。
 * 这里只验证装配与特权 mock，不提交工具、消费资源、授予租约或运行整局／模型；属性修改在 finally 恢复。
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/domain/components/role";
import type { RoleRuntimeContribution } from "../../../../src/rulesets/roles/contracts";
import { WOLF_ROLE_PROFILE } from "../../../../src/features/wolf/profile";
import {
  ORDINARY_WOLF_CONTRIBUTIONS,
  WOLF_NIGHT_STAGES,
  WOLF_TOOL_SPECS,
  WOLF_STAGE_DIRECTIVES,
  WOLF_VALIDATION_RULES,
  WOLF_LLM_REPAIR_PACK,
} from "../../../../src/features/wolf/ability-ports";
import { WOLF_KING_ROLE_PROFILE } from "../../../../src/features/wolf-king/profile";
import { HIDDEN_WOLF_ROLE_PROFILE } from "../../../../src/features/hidden-wolf/profile";
import { WOLF_BEAUTY_ROLE_PROFILE } from "../../../../src/features/wolf-beauty/profile";
import { GARGOYLE_ROLE_PROFILE } from "../../../../src/features/gargoyle/profile";
import { WILD_CHILD_ROLE_PROFILE } from "../../../../src/features/wild-child/profile";
import { SCHOLAR_ROLE_PROFILE, MENTOR_ROLE_PROFILE } from "../../../../src/features/scholar-mentor/profile";

function request(allowedTools: ActionRequest["allowedTools"]): ActionRequest {
  return {
    actorId: 1,
    phase: Phase.Night,
    allowedTools,
    context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: {} },
  };
}

test("ordinary wolf registration and derived spreads keep shared references and original overrides", () => {
  expect(WOLF_ROLE_PROFILE).toBe(ORDINARY_WOLF_CONTRIBUTIONS);
  expect(Object.keys(WOLF_ROLE_PROFILE)).toEqual(["metadata", "runtime", "presentation"]);
  expect(Object.keys(WOLF_ROLE_PROFILE.metadata)).toEqual(["role", "camp", "label", "skillBrief"]);
  expect(WOLF_ROLE_PROFILE.runtime.nightStages).toBe(WOLF_NIGHT_STAGES);
  expect(WOLF_ROLE_PROFILE.runtime.toolSpecs).toBe(WOLF_TOOL_SPECS);
  expect(WOLF_ROLE_PROFILE.runtime.stageDirectives).toBe(WOLF_STAGE_DIRECTIVES);
  expect(WOLF_ROLE_PROFILE.runtime.validationRules).toBe(WOLF_VALIDATION_RULES);
  expect(WOLF_ROLE_PROFILE.runtime.llmRepair).toBe(WOLF_LLM_REPAIR_PACK);
  expect(WOLF_ROLE_PROFILE.presentation).toEqual({ kind: "native", id: "wolf" });
  expect(Object.getOwnPropertyDescriptor(WOLF_ROLE_PROFILE, "runtime")?.writable).toBe(true);
  expect(WOLF_KING_ROLE_PROFILE.metadata.role).toBe(Role.WolfKing);
  expect(WOLF_KING_ROLE_PROFILE.runtime.nightStages).toBe(WOLF_NIGHT_STAGES);
  expect(WOLF_KING_ROLE_PROFILE.runtime.toolSpecs?.slice(0, 3)).toEqual(WOLF_TOOL_SPECS);
  expect(WOLF_KING_ROLE_PROFILE.runtime.toolSpecs?.[0]).toBe(WOLF_TOOL_SPECS[0]);
  expect(HIDDEN_WOLF_ROLE_PROFILE.runtime.canSelfDestruct).toBe(false);
  expect(HIDDEN_WOLF_ROLE_PROFILE.runtime.toolSpecs?.map((tool) => tool.name)).toEqual(["kill_vote"]);
  expect(HIDDEN_WOLF_ROLE_PROFILE.runtime.toolSpecs?.[0]).toBe(WOLF_TOOL_SPECS[1]);
  expect(MENTOR_ROLE_PROFILE.runtime.stageDirectives?.[0]).toBe(WOLF_STAGE_DIRECTIVES[0]);
  expect(MENTOR_ROLE_PROFILE.runtime.nightStages?.slice(-2)).toEqual(WOLF_NIGHT_STAGES);
  expect(SCHOLAR_ROLE_PROFILE.runtime.toolSpecs?.map((tool) => tool.name)).toEqual(["modify_skill", "bonus_action"]);
  expect(SCHOLAR_ROLE_PROFILE.runtime.nightStages?.some((stage) => stage.id === "wolf_discussion")).toBe(false);
});

test("derived mocks read a replaced runtime and method getter at each original call with the same receiver", () => {
  const original = Object.getOwnPropertyDescriptor(WOLF_ROLE_PROFILE, "runtime")!;
  const trace: string[] = [];
  const replacement: RoleRuntimeContribution = {
    get baselineAction() {
      trace.push("method");
      return function(this: RoleRuntimeContribution) {
        expect(this).toBe(replacement);
        trace.push("call");
        return { name: "kill_vote" as const, args: { target_id: 9, abstain: false } };
      };
    },
  };
  // 不把 runtime 替换当反射豁免：这是真实公开可写属性，原派生闭包必须继续晚读它。
  Object.defineProperty(WOLF_ROLE_PROFILE, "runtime", {
    configurable: true,
    get() { trace.push("runtime"); return replacement; },
  });
  try {
    for (const profile of [WOLF_BEAUTY_ROLE_PROFILE, GARGOYLE_ROLE_PROFILE, WILD_CHILD_ROLE_PROFILE, MENTOR_ROLE_PROFILE]) {
      trace.length = 0;
      const role = createRoleComponent(profile.metadata.role);
      const result = profile.runtime.baselineAction!(role, request(["kill_vote"]), () => 2, () => 3, undefined, undefined, () => ({ camp: profile.metadata.camp ?? Camp.Good }));
      expect(result).toEqual({ name: "kill_vote", args: { target_id: 9, abstain: false } });
      expect(trace).toEqual(["runtime", "method", "call"]);
    }
    // 同一闭包再调用时再次解析新属性，不缓存首次 runtime 或方法 getter 的结果。
    trace.length = 0;
    expect(MENTOR_ROLE_PROFILE.runtime.baselineAction!(createRoleComponent(Role.NightMentor), request(["kill_vote"]), () => 2, () => 3, undefined, undefined, () => ({ camp: Camp.Wolf }))).toEqual({ name: "kill_vote", args: { target_id: 9, abstain: false } });
    expect(trace).toEqual(["runtime", "method", "call"]);
  } finally {
    Object.defineProperty(WOLF_ROLE_PROFILE, "runtime", original);
  }
  expect(Object.getOwnPropertyDescriptor(WOLF_ROLE_PROFILE, "runtime")).toEqual(original);
});

test("ordinary mock keeps chat before knife and never defaults an optional self destruct", () => {
  const role = createRoleComponent(Role.Wolf), seen: string[] = [], actualCamp = { camp: Camp.Wolf };
  const mock = WOLF_ROLE_PROFILE.runtime.baselineAction!;
  const pick = (camp: "good" | "wolf" | "third_party") => { seen.push(camp); return 6; };
  const chat = mock(role, request(["kill_vote", "speak_to_wolves"]), () => 2, pick, "en", undefined, () => actualCamp);
  expect(chat?.name).toBe("speak_to_wolves");
  expect(seen).toEqual([]);
  expect(mock(role, request(["kill_vote"]), () => 2, pick, undefined, undefined, () => actualCamp)).toEqual({ name: "kill_vote", args: { target_id: 6, abstain: false } });
  expect(seen).toEqual(["good"]);
  expect(mock(role, request(["kill_vote"]), () => 2, () => null, undefined, undefined, () => actualCamp)).toEqual({ name: "kill_vote", args: { target_id: null, abstain: true } });
  expect(mock(role, request(["self_destruct"]), () => { throw new Error("pick_must_not_run"); }, () => { throw new Error("camp_pick_must_not_run"); }, undefined, undefined, () => actualCamp)).toBeNull();
});
