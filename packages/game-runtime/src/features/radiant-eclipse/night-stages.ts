/**
 * 负责黯月吞噬与明辉庇护的既定夜间请求顺序。
 * 输入为安装后的 frame、活动能力查询和验证目标；输出保留借用／庇护提交及原事实。
 * frame 保有已付效果有效性与借用实例所有权，共享 use 提交只处理原 metadata。
 * 不因 provider 返回而推断资格，也不移动租约、库存、记录或清理位置。
 */
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Phase, Role } from "../../domain/identity";
import type { TrustedNightStageHandler as NightStageHandler } from "../../engine/night/trusted-runtime";
import { recordNightAbilityUse } from "../night-abilities/inventory-ports";
import { captureNightAbilityScope } from "../night-abilities/scope-ports";
import { readShelterState, selectShelter } from "./shelter-state";
import { SHELTER_STATE_SLOT } from "./shelter-state-slot";
import {
  assertRadiantRosterCurrent,
  eclipseSwallowTargets,
  openEclipseChoice,
  commitEclipseChoice,
  shelterTargets,
  commitRadiantShelter,
} from "./night-frame";
export const ECLIPSE_SWALLOW_STAGE: NightStageHandler = {
  id: "eclipse_swallow",
  priority: 110,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day < 2) return;
    const actorId = ctx.world
      .getAliveEntityIds()
      .find((id) => ctx.world.getComponent(id, COMPONENT.Role)?.role === Role.EclipseMaid);
    if (actorId === undefined) return;
    openEclipseChoice(ctx.world, day);
    const request = ctx.makeRequest(actorId, ["swallow_skill"], {
      stage: "eclipse_swallow",
      swallow_candidates: eclipseSwallowTargets(ctx.world, day),
      allow_fallback: false,
      action_failure_policy: "error",
    });
    assertRadiantRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertRadiantRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("eclipse_swallow_stale");
    if (action?.name !== "swallow_skill") throw new Error("eclipse_swallow_action_missing");
    const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    if (!ctx.isCurrent() || !result.ok || result.sanitizedCall?.name !== "swallow_skill")
      throw new Error("eclipse_swallow_action_invalid");
    commitEclipseChoice(ctx.world, day, result.sanitizedCall.args.target_id, ctx.events);
  },
};
export const RADIANT_SHELTER_STAGE: NightStageHandler = {
  id: "radiant_shelter",
  priority: 120,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day < 2) return;
    for (const { actorId, ability } of ctx.nightActors.actors("shelter", day)) {
      const scope = captureNightAbilityScope(
        ctx.world,
        actorId,
        ability,
        day,
        () => ctx.isCurrent() && ctx.currentDay() === day,
      );
      if (!scope?.isEligible()) throw new Error("radiant_shelter_owner_stale");
      const request = ctx.makeRequest(actorId, ["cast_shelter"], {
        stage: "radiant_shelter",
        ability_id: ability.id,
        shelter_candidates: shelterTargets(ctx.world, day, actorId, ability.id),
        allow_fallback: false,
        action_failure_policy: "error",
      });
      const action = await ctx.actionProvider.getAction(request);
      if (!scope.isEligible()) throw new Error("radiant_shelter_owner_stale");
      if (action?.name !== "cast_shelter") throw new Error("radiant_shelter_action_missing");
      const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
        abilityId: ability.id,
      });
      if (!scope.isEligible() || !result.ok || result.sanitizedCall?.name !== "cast_shelter")
        throw new Error("radiant_shelter_action_invalid");
      const target = result.sanitizedCall.args.target_id;
      const next = selectShelter(
        readShelterState(ability.state)!,
        day,
        target,
        actorId,
        ctx.world.getAliveEntityIds(),
      );
      commitRadiantShelter(ctx.world, day, actorId, ability, target, ctx.events);
      recordNightAbilityUse(ability, day, target !== null);
      SHELTER_STATE_SLOT.allowedWrites.recordShelterSelection(ability, next);
    }
  },
};

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [ECLIPSE_SWALLOW_STAGE, RADIANT_SHELTER_STAGE].map((handler) =>
    Object.freeze([handler, handler.execute] as const),
  ),
);
