/**
 * 负责 觉醒隐狼 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { COMPONENT } from "../../domain/components/names";
import { nativeRolePresentation } from "../../rulesets/roles/presentation-contribution";
import { z } from "zod";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Camp, Role } from "../../domain/model";
import type { NativeRoleContributions } from "../../rulesets/roles/contracts";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";
import { DEATH_SHOT_TOOL_SPECS, DEATH_SHOT_REPAIR, validateDeathShot } from "../death-actions/death-shot";
import {
  ROLE_INSPECTION_TOOL,
  roleInspectionTargets,
  validateRoleInspection,
} from "../role-inspection/contribution-ports";
// 共用查验贡献仅提供原工具与目标／校验函数；觉醒技能的原实例、学习与夜资格仍由本族 owner 决定。
import { findNightAbility } from "../night-abilities/abilities";
import { numberOrNull } from "../../agents/tool-repair/helpers";
import { canAwakenedKnife } from "./inheritance";
import { awakenedDeathHook } from "./death-hook";
import { AWAKENED_NIGHT_STAGES } from "./night-stages";
import { AWAKENED_TOOL_SPECS } from "./tool-specs";
import { AWAKENED_TOOL_NAMES, AWAKENED_VALIDATION_RULES } from "./rules";
import {
  freshAwakenedState,
  getAwakenedState,
  projectAwakenedState,
  setAwakenedState,
} from "./state";

export const AWAKENED_HIDDEN_WOLF_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.AwakenedHiddenWolf,
    camp: Camp.Wolf,
    maxCount: 1,
    supportedBoardRoles: [
      Role.AwakenedHiddenWolf,
      Role.Wolf,
      Role.MirrorGirl,
      Role.Witch,
      Role.Hunter,
      Role.Guard,
      Role.Villager,
    ],
    label: roleName("awakened_hidden_wolf"),
    skillBrief: text("zh-CN", "role.awakened_hidden_wolf.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    canSelfDestruct: false,
    init: (role) => {
      if (!getAwakenedState(role)) setAwakenedState(role, freshAwakenedState());
    },
    wolfTeam: (role, world, currentCamp) => ({
      recognizedByPack: false,
      recognizes: "none",
      canChat: false,
      canVoteForKill: canAwakenedKnife(role, world, currentCamp),
    }),
    inspectionLabels: (role) => ({
      camp: Camp.Wolf,
      role: getAwakenedState(role)?.learned?.role ?? Role.AwakenedHiddenWolf,
    }),
    configuration: {
      schema: z.strictObject({}),
      defaults: {},
      apply: (config) => config,
      serialize: () => ({}),
    },
    possibleNightAbilities: ["role_check"],
    toolSpecs: [
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!.filter((spec) => spec.name === "kill_vote"),
      ...AWAKENED_TOOL_SPECS,
      ROLE_INSPECTION_TOOL,
      ...DEATH_SHOT_TOOL_SPECS,
    ],
    nightStages: [...AWAKENED_NIGHT_STAGES, ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.nightStages!],
    validationRules: {
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      ...AWAKENED_VALIDATION_RULES,
      inspect_role: validateRoleInspection,
      shoot: (ctx) => {
        const learned = getAwakenedState(ctx.role)?.learned,
          gun = learned?.skill;
        return validateDeathShot(
          ctx,
          ctx.role.role === Role.AwakenedHiddenWolf &&
            ctx.world.getComponent(ctx.actorId, COMPONENT.Camp)?.camp === Camp.Wolf &&
            learned?.role === Role.Hunter &&
            learned.activationNight != null &&
            gun?.kind === "hunter" &&
            gun.armed &&
            gun.canShoot,
        );
      },
    },
    deathHook: awakenedDeathHook,
    llmRepair: {
      coerce: {
        ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.llmRepair?.coerce,
        ...DEATH_SHOT_REPAIR.coerce,
        ...Object.fromEntries(
          [...AWAKENED_TOOL_NAMES, "inspect_role"].map((name) => [
            name,
            (args: Record<string, unknown>) => {
              if (args.target_id === null && ["awakened_guard", "awakened_attack"].includes(name))
                return { target_id: null };
              const target = numberOrNull(args.target_id);
              return target === null ? null : { target_id: target };
            },
          ]),
        ),
      },
    },
    baselineAction: (role, request, pick, byCamp, locale, world, currentCamp) => {
      if (request.allowedTools.includes("awakened_mimic")) {
        const target = pick();
        return target === null ? null : { name: "awakened_mimic", args: { target_id: target } };
      }
      if (request.allowedTools.includes("awakened_poison")) {
        const target = byCamp("good");
        return target === null ? null : { name: "awakened_poison", args: { target_id: target } };
      }
      if (request.allowedTools.includes("awakened_guard"))
        return { name: "awakened_guard", args: { target_id: null } };
      if (request.allowedTools.includes("awakened_attack"))
        return { name: "awakened_attack", args: { target_id: byCamp("good") } };
      if (request.allowedTools.includes("inspect_role")) {
        const ability = findNightAbility(role, "role_check", request.context.ability_id),
          target =
            world && ability
              ? roleInspectionTargets(world, request.actorId, ability.state)[0]
              : undefined;
        return target === undefined ? null : { name: "inspect_role", args: { target_id: target } };
      }
      if (request.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: byCamp("good") } };
      return ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction!(role, request, pick, byCamp, locale, world, currentCamp);
    },
  },
  presentation: nativeRolePresentation("awakened_hidden_wolf"),
};
