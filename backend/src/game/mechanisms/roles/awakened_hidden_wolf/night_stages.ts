/**
 * 负责觉醒隐狼开夜、学习、技能、额外刀和激活阶段。
 * 输入为原 native/copy scope 与已验证工具；输出为原已付事实及有来源的盾、刀和原毒 intent。
 * 复用原捕获 life/day/目标，保留付款位置以及允许首次死亡的 paid callback。
 * 不以新来源数据替代资格、库存或重试规则，不恢复撤销的原 owner，不改变阶段优先级或归档。
 */
import { COMPONENT } from "../../../../domain/components/names";
import type { RoleComponent } from "../../../../domain/components/role";
import { Phase, StatusMark, type EntityId, type ToolName } from "../../../../domain/model";
import {
  captureNightLife,
  livingNightLife,
  awakenedNightIntent,
  originalPoisonIntent,
} from "../../../../domain/night-effects";
import type { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import { allNightAbilities, findNightAbility, retiredNightAbilityIds } from "../abilities";
import { installNativeAbility } from "../ability_changes";
import { setNightAbilityStartDay } from "../abilities";
import { canAwakenedKnife } from "./inheritance";
import {
  beginAwakenedNight,
  bindAwakenedSkill,
  captureAwakenedOwner,
  currentAwakenedNight,
  recordAwakenedNightCommit,
} from "./night_scope";
import {
  activateAwakenedLearning,
  awakenedSkillForNight,
  canAwakenedExtraKnife,
  canAwakenedMimic,
  chooseAwakenedAttack,
  chooseAwakenedGuard,
  closeAwakenedMimic,
  learnAwakenedRole,
  skipAwakenedSkill,
  useAwakenedPoison,
} from "./state";

function owners(ctx: NightStageContext, day: number, opening = false) {
  return ctx.world.getAliveEntityIds().flatMap((id) => {
    const owner = captureAwakenedOwner(
      ctx.world,
      id,
      () => ctx.isCurrent() && ctx.currentDay() === day,
    );
    return owner && (opening || currentAwakenedNight(ctx.world, owner.role) === day) ? [owner] : [];
  });
}
const targets = (ctx: NightStageContext, actorId: EntityId, excludeSelf: boolean) =>
  new Map(
    ctx.world
      .getAliveEntityIds()
      .filter((id) => !excludeSelf || id !== actorId)
      .map((id) => [id, captureNightLife(ctx.world, id)!] as const),
  );
const effects = (ctx: NightStageContext) =>
  (ctx.state.awakenedEffects ??= { shields: [], attacks: [] });
const retry = (attempt: number) => (attempt ? { retry_attempt: attempt, retry_max: 2 } : {});

const openingStage: NightStageHandler = {
  id: "awakened_opening",
  priority: 250,
  async execute(ctx) {
    const day = ctx.currentDay();
    beginAwakenedNight(ctx.world, day, owners(ctx, day, true));
  },
};
const mimicStage: NightStageHandler = {
  id: "awakened_mimic",
  priority: 580,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx, day)) {
      if (!canAwakenedMimic(owner.state, day)) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!owner.isCurrent() || !canAwakenedMimic(owner.state, day) || !owner.canAct()) break;
        const candidates = targets(ctx, owner.actorId, true);
        const roles = new Map(
          [...candidates.keys()].map((id) => {
            const component = ctx.world.getComponent(id, COMPONENT.Role)!;
            return [id, { component, role: component.role, camp: ctx.world.getComponent(id, COMPONENT.Camp)?.camp }] as const;
          }),
        );
        if (!owner.canAct()) break;
        const action = candidates.size
          ? await ctx.actionProvider.getAction(
              ctx.makeRequest(owner.actorId, ["awakened_mimic"], {
                stage: "awakened_mimic",
                requiresAction: false,
                action_failure_policy: "error",
                allow_fallback: false,
                ...retry(attempt),
              }),
            )
          : null;
        if (!owner.isCurrent() || !canAwakenedMimic(owner.state, day) || !owner.canAct()) break;
        if (action === null) {
          if (!closeAwakenedMimic(owner.state, day, owner.canAct)) break;
          recordAwakenedNightCommit(ctx.world, day);
          ctx.events.push({
            timestamp: Date.now(),
            type: "awakened_mimic_skipped",
            payload: { actorId: owner.actorId, day },
          });
          completed = true;
          break;
        }
        if (action.name !== "awakened_mimic") continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (
          !owner.isCurrent() ||
          !canAwakenedMimic(owner.state, day) ||
          !valid.ok ||
          valid.sanitizedCall?.name !== "awakened_mimic" ||
          !owner.canAct()
        )
          continue;
        const targetId = valid.sanitizedCall.args.target_id,
          target = candidates.get(targetId),
          origin = roles.get(targetId);
        if (
          !target ||
          !livingNightLife(ctx.world, target) ||
          !origin ||
          ctx.world.getComponent(targetId, COMPONENT.Role) !== origin.component ||
          origin.component.role !== origin.role ||
          ctx.world.getComponent(targetId, COMPONENT.Camp)?.camp !== origin.camp
        )
          continue;
        // 原候选 Role／Camp／生命复验后才检查墓碑；不提前读取或重新捕获目标。
        if (!owner.canAct()) break;
        if (!learnAwakenedRole(owner.state, targetId, origin.role, day, owner.canAct)) continue;
        recordAwakenedNightCommit(ctx.world, day);
        ctx.events.push({
          timestamp: Date.now(),
          type: "awakened_mimicked",
          payload: { actorId: owner.actorId, day, targetId, role: owner.state.learned!.role },
        });
        completed = true;
        break;
      }
      if (!completed && owner.isCurrent() && canAwakenedMimic(owner.state, day) && owner.canAct()) {
        if (targets(ctx, owner.actorId, true).size)
          throw new Error("awakened_mimic_valid_action_missing");
        if (!owner.canAct()) continue;
        if (!closeAwakenedMimic(owner.state, day, owner.canAct)) continue;
        recordAwakenedNightCommit(ctx.world, day);
        ctx.events.push({
          timestamp: Date.now(),
          type: "awakened_mimic_skipped",
          payload: { actorId: owner.actorId, day },
        });
      }
    }
  },
};

const skillStage: NightStageHandler = {
  id: "awakened_skill",
  priority: 650,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx, day)) {
      const bound = bindAwakenedSkill(owner, day),
        skill = bound?.skill;
      if (!bound || !skill || skill.kind === "wolf") continue;
      const tool: ToolName = skill.kind === "poison" ? "awakened_poison" : "awakened_guard";
      const current = () => bound.isCurrent() && awakenedSkillForNight(owner.state, day) === skill && owner.canAct();
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const candidates = targets(ctx, owner.actorId, false);
        if (!owner.canAct()) break;
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(owner.actorId, [tool], {
            stage: "awakened_skill",
            requiresAction: false,
            action_failure_policy: "error",
            allow_fallback: false,
            ...retry(attempt),
          }),
        );
        if (!current()) break;
        if (action === null) {
          if (!skipAwakenedSkill(owner.state, day, owner.canAct)) break;
          recordAwakenedNightCommit(ctx.world, day);
          ctx.events.push({
            timestamp: Date.now(),
            type: "awakened_skill_skipped",
            payload: { actorId: owner.actorId, day },
          });
          completed = true;
          break;
        }
        if (action.name !== tool) continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !valid.ok || !valid.sanitizedCall) continue;
        const call = valid.sanitizedCall;
        if (call.name !== "awakened_poison" && call.name !== "awakened_guard") continue;
        const targetId = call.args.target_id,
          target = targetId === null ? null : candidates.get(targetId);
        if (targetId !== null && (!target || !livingNightLife(ctx.world, target))) continue;
        if (call.name === "awakened_poison" && skill.kind === "poison" && target) {
          // 首次扣库存前拒绝晚退休；后续 claim／印记／事实仍按原非事务次序完成。
          if (!owner.canAct()) break;
          if (!useAwakenedPoison(owner.state, day, owner.canAct)) break;
          (ctx.state.poisonClaims ??= []).push(
            originalPoisonIntent(
              {
                source: owner.life,
                target,
                isCurrent: () => bound.isCurrent(true),
              },
              {
                family: "awakened",
                day,
                stage: "awakened_skill",
                actorLife: owner.life,
                requestedTargetId: targetId,
                abilityId: "learned:awakened",
              },
            ),
          );
          ctx.ensureMarks(target.id).add(StatusMark.PoisonMark);
          ctx.events.push({
            timestamp: Date.now(),
            type: "awakened_poison_used",
            payload: { actorId: owner.actorId, day, targetId: target.id },
          });
        } else if (call.name === "awakened_guard" && skill.kind === "guard") {
          if (!owner.canAct()) break;
          if (!chooseAwakenedGuard(owner.state, targetId, day, owner.canAct)) continue;
          if (target)
            effects(ctx).shields.push(
              awakenedNightIntent(
                "awakened-shield",
                {
                  actorId: owner.actorId,
                  target,
                  isCurrent: () => bound.isCurrent(true),
                },
                {
                  family: "awakened",
                  day,
                  stage: "awakened_skill",
                  actorLife: owner.life,
                  requestedTargetId: targetId,
                  abilityId: "learned:awakened",
                },
              ),
            );
          ctx.events.push({
            timestamp: Date.now(),
            type: "awakened_guard_chosen",
            payload: { actorId: owner.actorId, day, targetId },
          });
        } else continue;
        recordAwakenedNightCommit(ctx.world, day);
        completed = true;
        break;
      }
      if (!completed && current()) throw new Error("awakened_skill_valid_action_missing");
    }
  },
};

const attackStage: NightStageHandler = {
  id: "awakened_attack",
  priority: 660,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx, day)) {
      const bound = bindAwakenedSkill(owner, day);
      if (bound?.skill.kind !== "wolf") continue;
      const effectCurrent = () => bound.isCurrent() && canAwakenedKnife(owner.role, ctx.world, () => ctx.world.getComponent(owner.actorId, COMPONENT.Camp));
      const current = () => effectCurrent() && canAwakenedExtraKnife(owner.state, day) && owner.canAct();
      if (!current()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const candidates = targets(ctx, owner.actorId, false);
        if (!owner.canAct()) break;
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(owner.actorId, ["awakened_attack"], {
            stage: "awakened_attack",
            requiresAction: false,
            action_failure_policy: "error",
            allow_fallback: false,
            ...retry(attempt),
          }),
        );
        if (!current()) break;
        let targetId: number | null = null;
        if (action !== null) {
          if (action.name !== "awakened_attack") continue;
          const valid = ctx.toolGateway.validateAndSanitize(ctx.world, owner.actorId, action, {
            phase: Phase.Night,
            day,
          });
          if (!current() || !valid.ok || valid.sanitizedCall?.name !== "awakened_attack") continue;
          targetId = valid.sanitizedCall.args.target_id;
        }
        const target = targetId === null ? null : candidates.get(targetId);
        if (targetId !== null && (!target || !livingNightLife(ctx.world, target))) continue;
        // 目标读取可以触发受信任回调；真正扣刀之前只读原 Role 的退休标记。
        if (!owner.canAct()) break;
        if (!chooseAwakenedAttack(owner.state, targetId, day, owner.canAct)) break;
        if (target)
          effects(ctx).attacks.push(
            awakenedNightIntent(
              "awakened-attack",
              { actorId: owner.actorId, target, isCurrent: effectCurrent },
              {
                family: "awakened",
                day,
                stage: "awakened_attack",
                actorLife: owner.life,
                requestedTargetId: targetId,
                abilityId: "learned:awakened",
              },
            ),
          );
        recordAwakenedNightCommit(ctx.world, day);
        ctx.events.push({
          timestamp: Date.now(),
          type: "awakened_attack_chosen",
          payload: { actorId: owner.actorId, day, targetId },
        });
        completed = true;
        break;
      }
      if (!completed && current()) throw new Error("awakened_attack_valid_action_missing");
    }
  },
};

const activationStage: NightStageHandler = {
  id: "awakened_activation",
  priority: 900,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const owner of owners(ctx, day)) {
      const learned = owner.state.learned;
      if (!learned || learned.activationNight !== null || !owner.isCurrent() || !owner.canAct()) continue;
      let abilityId: string | undefined;
      let installedMirror = false;
      if (learned.skill.kind === "inspection") {
        if (
          allNightAbilities(owner.role).some(
            (ability) => ability.kind === "role_check" && ability.source.kind === "native",
          ) ||
          retiredNightAbilityIds(owner.role).some((id) => id.startsWith("native:role_check"))
        )
          throw new Error("awakened_mirror_native_binding_conflict");
        // 原冲突查询先完成；安装新的主动实例前再拒绝退休，不取消已经安装的实例。
        if (!owner.canAct()) continue;
        const installed = installNativeAbility(owner.role, "role_check", {
          policy: "mirror",
          lastTarget: null,
          lastDay: null,
          history: [],
        }, owner.canAct);
        if (installed === null) continue;
        installedMirror = true;
        const ability = findNightAbility(owner.role, "role_check")!;
        setNightAbilityStartDay(ability, day + 1);
        abilityId = ability.id;
      }
      if (!owner.isCurrent() || owner.state.learned !== learned)
        throw new Error("awakened_activation_commit_invalid");
      // 未装实例的退休是正常拒绝；已安装镜像进入原完成前缀，不能取消该次激活。
      if (!installedMirror && !owner.canAct()) continue;
      const activated = activateAwakenedLearning(owner.state, day, abilityId,
        installedMirror ? undefined : owner.canAct);
      if (activated === "retired") continue;
      if (!activated) throw new Error("awakened_activation_commit_invalid");
      recordAwakenedNightCommit(ctx.world, day);
      ctx.events.push({
        timestamp: Date.now(),
        type: "awakened_ready",
        payload: {
          actorId: owner.actorId,
          activationNight: day,
          activeFromNight: day + 1,
          role: learned.role,
        },
      });
    }
  },
};

export const AWAKENED_NIGHT_STAGES = [
  openingStage,
  mimicStage,
  skillStage,
  attackStage,
  activationStage,
];
