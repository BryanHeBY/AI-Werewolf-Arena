/**
 * 负责 狼王 的原资料、初始化与运行贡献装配，内建展示只登记语言中立的具体角色标识。
 * 输入为原板子参数、角色组件与请求上下文；输出为分别登记的资料、运行及展示贡献，工具、阶段、初始化和特权 mock 回调保留原引用与顺序。
 * 展示在实际调用时由角色捕获读取原状态并逐片段交纯展示所有者；本模块不授予租约、执行归档或复制状态。
 * 失败和关闭时仍遵守原机制权限与已付费前缀，不把文案当授权。
 */
import { nativeRolePresentation } from "../presentation-contribution";
import { deathActionConfiguration, renderDeathActionPolicy } from "../death_action_policy";
import { roleName, text } from "@ai-werewolf-arena/game-text";
import { Role, permitsDeathShot } from "../../../../domain/model";
import type { NativeRoleContributions } from "../contracts";
import { getWolfKingState, setWolfKingState, createWolfKingState } from "../native-death-gun-resources";
import {
  DEATH_SHOT_TOOL_SPECS,
  DEATH_SHOT_REPAIR,
  validateDeathShot,
} from "../death_shot";
import { resolveNativeDeathShots } from "../native-death-shot-settlement";
import { ORDINARY_WOLF_CONTRIBUTIONS } from "../wolf/ability-ports";

/** AWA 狼王 1.0：普通狼队权限，加一次满足死亡来源条件的开枪机会。 */
export const WOLF_KING_ROLE_PROFILE: NativeRoleContributions = {
  metadata: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.metadata,
    role: Role.WolfKing,
    label: roleName("wolf_king"),
    skillBrief: text("zh-CN", "role.wolf_king.brief"),
  },
  runtime: {
    ...ORDINARY_WOLF_CONTRIBUTIONS.runtime,
    configuration: deathActionConfiguration("wolfKing"),
    init: (role, ctx) => {
      // 保原安装 callee／角色参数先于配置读取；状态由资源 owner 创建并同引用安装。
      setWolfKingState(role, createWolfKingState(ctx));
    },
    toolSpecs: [...ORDINARY_WOLF_CONTRIBUTIONS.runtime.toolSpecs!, ...DEATH_SHOT_TOOL_SPECS],
    validationRules: {
      ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules,
      shoot: (ctx) =>
        validateDeathShot(
          ctx,
          ctx.role.role === Role.WolfKing && getWolfKingState(ctx.role)?.canShoot === true,
        ),
    },
    llmRepair: {
      coerce: { ...ORDINARY_WOLF_CONTRIBUTIONS.runtime.llmRepair?.coerce, ...DEATH_SHOT_REPAIR.coerce },
    },
    deathHook: (world, ids, sources, choose, events, context) =>
      resolveNativeDeathShots(
        world,
        ids,
        sources,
        choose,
        events,
        {
          role: Role.WolfKing,
          state: getWolfKingState,
          permits: (sources) => permitsDeathShot(sources),
          policy: (state) => state.deathActionPolicy ?? "awa_qualified_sources_v1",
          shotEvent: (actorId, targetId) => ({
            timestamp: Date.now(),
            type: "wolf_king_shot",
            payload: { actorId, targetId },
          }),
        },
        context,
      ),
    baselineAction: (role, request, pickAliveNotSelf, pickAliveByCamp, locale, _world, currentCamp) =>
      request.allowedTools.includes("shoot")
        ? { name: "shoot", args: { target_id: pickAliveByCamp("good") ?? pickAliveNotSelf() } }
        : ORDINARY_WOLF_CONTRIBUTIONS.runtime.baselineAction!(
            role,
            request,
            pickAliveNotSelf,
            pickAliveByCamp,
            locale,
            undefined,
            currentCamp,
          ),
  },
  presentation: nativeRolePresentation("wolf_king"),
};
