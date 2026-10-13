/**
 * 负责 机械狼 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为原 RoleProfile 与具名内建展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { z } from "zod";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../../../core/domain/model";
import type { RoleProfile } from "../contracts";
import { WOLF_ROLE_PROFILE } from "../wolf/profile";
import { DEATH_SHOT_TOOL_SPECS, DEATH_SHOT_REPAIR, validateDeathShot } from "../death_shot";
import { numberOrNull } from "../../llm/helpers";
import { canMechanicalKnife } from "./inheritance";
import { mechanicalDeathHook } from "./death_hook";
import { MECHANICAL_NIGHT_STAGES } from "./night_stages";
import { MECHANICAL_TOOL_SPECS } from "./tool_specs";
import { MECHANICAL_VALIDATION_RULES } from "./rules";
import {
  getMechanicalState,
  setMechanicalState,
  freshMechanicalState,
  projectMechanicalState,
} from "./state";

export const MECHANICAL_WOLF_ROLE_PROFILE: RoleProfile = {
  ...WOLF_ROLE_PROFILE,
  role: Role.MechanicalWolf,
  camp: Camp.Wolf,
  maxCount: 1,
  canSelfDestruct: false,
  supportedBoardRoles: [
    Role.Wolf,
    Role.Psychic,
    Role.Witch,
    Role.Hunter,
    Role.Guard,
    Role.Villager,
    Role.MechanicalWolf,
  ],
  label: roleName("mechanical_wolf"),
  skillBrief: text("zh-CN", "role.mechanical_wolf.brief"),
  init: (role) => {
    if (!getMechanicalState(role)) setMechanicalState(role, freshMechanicalState());
  },
  wolfTeam: (role, world) => ({
    recognizedByPack: false,
    recognizes: "none",
    canChat: false,
    canVoteForKill: canMechanicalKnife(role, world),
  }),
  inspectionLabels: (role) => ({
    camp: Camp.Wolf,
    role: getMechanicalState(role)?.learned?.role ?? Role.MechanicalWolf,
  }),
  configuration: {
    schema: z.strictObject({}),
    defaults: {},
    apply: (config) => config,
    serialize: () => ({}),
  },
  ...nativeRolePresentation("mechanical_wolf"),
  toolSpecs: [
    ...WOLF_ROLE_PROFILE.toolSpecs!.filter((spec) => spec.name === "kill_vote"),
    ...MECHANICAL_TOOL_SPECS,
    ...DEATH_SHOT_TOOL_SPECS,
  ],
  nightStages: [...MECHANICAL_NIGHT_STAGES, ...WOLF_ROLE_PROFILE.nightStages!],
  validationRules: {
    ...WOLF_ROLE_PROFILE.validationRules,
    ...MECHANICAL_VALIDATION_RULES,
    shoot: (ctx) => {
      const skill = getMechanicalState(ctx.role)?.learned?.skill;
      return validateDeathShot(
        ctx,
        ctx.role.role === Role.MechanicalWolf &&
          skill?.kind === "hunter" &&
          skill.armed &&
          skill.canShoot,
      );
    },
  },
  deathHook: mechanicalDeathHook,
  llmRepair: {
    coerce: {
      ...WOLF_ROLE_PROFILE.llmRepair?.coerce,
      ...DEATH_SHOT_REPAIR.coerce,
      ...Object.fromEntries(
        [
          "mimic_role",
          "mechanical_inspect",
          "mechanical_poison",
          "mechanical_guard",
          "mechanical_attack",
        ].map((name) => [
          name,
          (args: Record<string, unknown>) => {
            if (args.target_id === null && ["mechanical_guard", "mechanical_attack"].includes(name))
              return { target_id: null };
            const target = numberOrNull(args.target_id);
            return target === null ? null : { target_id: target };
          },
        ]),
      ),
    },
  },
  baselineAction: (role, request, pick, byCamp, locale, world) => {
    if (request.allowedTools.includes("mechanical_mode")) {
      const state = getMechanicalState(role);
      return {
        name: "mechanical_mode",
        args: {
          mode:
            state?.hasInheritedKnife &&
            state.firstKnifeNight !== null &&
            state.firstKnifeNight <= request.context.day
              ? "kill"
              : "skill",
        },
      };
    }
    if (request.allowedTools.includes("mimic_role")) {
      const target = pick();
      return target === null ? null : { name: "mimic_role", args: { target_id: target } };
    }
    if (request.allowedTools.includes("mechanical_inspect")) {
      const target = pick();
      return target === null ? null : { name: "mechanical_inspect", args: { target_id: target } };
    }
    if (request.allowedTools.includes("mechanical_poison")) {
      const target = byCamp("good");
      return target === null ? null : { name: "mechanical_poison", args: { target_id: target } };
    }
    if (request.allowedTools.includes("mechanical_guard"))
      return { name: "mechanical_guard", args: { target_id: pick() } };
    if (request.allowedTools.includes("mechanical_attack"))
      return { name: "mechanical_attack", args: { target_id: byCamp("good") } };
    if (request.allowedTools.includes("shoot"))
      return { name: "shoot", args: { target_id: byCamp("good") } };
    return WOLF_ROLE_PROFILE.baselineAction!(role, request, pick, byCamp, locale, world);
  },
};
