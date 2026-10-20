/**
 * 负责普通狼刀收票之后的完整刀口路由组合。输入为原夜上下文、已接受的原生命引用、票序和弃票集合；
 * 输出为原多数／迷雾目标，并按原时点写刀口、投票者、映射后的印记和生命范围。
 * 炼金魔女的雾圈与原生命、魔术师映射和已付加成各由原本族所有者复验；此组合不持有库存或发放许可。
 * 狼阶段仍负责聊天、逐票复验、等待与末尾贵族事实发布；这里不增加等待、随机抽取、退款或失败清理。
 */
import { recordReplayFact } from "../domain/replay-fact-log";
import { EntityId, Phase, StatusMark } from "../domain/model";
import { COMPONENT } from "../domain/components/names";
import { aliveLifeVersion } from "../domain/components/alive";
import { safeRecordLogicOp } from "../recording/session/recorder";
import { wolfTeamEvent } from "../features/wolf-team/permissions";
import { bindWolfKnifeTargetQuery } from "../features/wolf/ports";
import {
  isMistRavenBoard,
  mistKnifeTargets,
  originalMistTarget,
} from "../features/mist-raven/knife-ports";
import type { WolfKnifeTargetScope } from "../engine/night/contracts";
import type { TrustedNightStageRuntime as NightStageContext } from "../engine/night/trusted-runtime";

/** 已接受的票只携带原目标身体与生命版本，不是新的付款凭据或 JSON 快照。 */
export type AcceptedWolfKnifeTarget = Pick<
  WolfKnifeTargetScope,
  "targetId" | "life" | "version"
> & {
  actorId: EntityId;
};

/** 只限制此组合实际使用的字段；调用方传原对象，各 getter 与方法 receiver 保留到原表达式点。 */
type WolfKnifeRoutingRuntime = Pick<
  NightStageContext,
  | "world"
  | "state"
  | "roleCatalog"
  | "events"
  | "pickMajorityTarget"
  | "pickMistKnife"
  | "currentDay"
  | "nativeNightEffects"
  | "nativeNightTargets"
  | "ensureMarks"
>;

export function resolveOrdinaryWolfKnife(
  ctx: WolfKnifeRoutingRuntime,
  acceptedTargets: AcceptedWolfKnifeTarget[],
  voteOrder: EntityId[],
  explicitPasses: Set<EntityId>,
  participantIds: readonly EntityId[] = voteOrder,
): EntityId | null {
  let wolfTarget = ctx.pickMajorityTarget(ctx.state.wolfVotes);
  let mistRandomScope: import("../domain/night-effects").NightLifeScope | null = null;
  // 先查询原板身份，再判断空刀；只有原雾圈可用且全部弃票时才使用一次原随机源。
  if (isMistRavenBoard(ctx.world) && wolfTarget === null) {
    const circle = mistKnifeTargets(ctx.world);
    if (circle !== null) {
      if (voteOrder.length === 0 || explicitPasses.size !== voteOrder.length)
        throw new Error("mist_knife_requires_explicit_passes");
      if (!ctx.pickMistKnife) throw new Error("mist_knife_rng_missing");
      wolfTarget = ctx.pickMistKnife(circle);
      mistRandomScope =
        wolfTarget === null ? null : originalMistTarget(ctx.world, ctx.currentDay(), wolfTarget);
      if (wolfTarget !== null && !mistRandomScope) throw new Error("mist_knife_target_stale");
      ctx.events.push(
        wolfTeamEvent(ctx.world, ctx.roleCatalog, {
          timestamp: Date.now(),
          type: "mist_knife_drawn",
          payload: { day: ctx.currentDay(), candidates: [...circle], targetId: wolfTarget },
        }),
      );
    }
  }
  // 抽刀事件先发布；随后刀口写入、加成命令、投票者与诊断依次执行，失败不回滚已写前缀。
  ctx.state.wolfTarget = wolfTarget;
  ctx.nativeNightEffects.recordKnifeModifierTarget(() => wolfTarget);
  ctx.state.wolfTargetVoters = acceptedTargets
    .filter((target) => target.targetId === wolfTarget)
    .map((target) => target.actorId);
  safeRecordLogicOp({
    scope: "phase_pipeline",
    op: "wolf_kill_vote_resolved",
    phase: Phase.Night,
    status: "ok",
    output: { tally: ctx.state.wolfVotes, wolf_target: wolfTarget },
  });
  let effectiveTargetId: EntityId | null = null;
  if (wolfTarget !== null) {
    const target =
      (mistRandomScope
        ? { targetId: wolfTarget, life: mistRandomScope.life, version: mistRandomScope.version }
        : undefined) ??
      acceptedTargets.find(
        (item) =>
          item.targetId === wolfTarget &&
          ctx.world.getComponent(item.targetId, COMPONENT.Alive) === item.life &&
          item.life.alive &&
          aliveLifeVersion(item.life) === item.version &&
          bindWolfKnifeTargetQuery(ctx.world).allows(item.targetId),
      );
    if (target) {
      // 映射在原目标复验后读取；先核映射当前性，再加印记，最后保存原生命／映射生命的运行引用。
      const mapping = ctx.nativeNightTargets.mappedTarget(
        () => ctx.currentDay(),
        () => wolfTarget,
      );
      if (mapping && !mapping.isCurrent()) throw new Error("magician_knife_target_stale");
      const effectiveId = mapping?.effectiveId ?? wolfTarget;
      const marks = ctx.ensureMarks(effectiveId);
      marks.add(StatusMark.WolfKillMark);
      effectiveTargetId = effectiveId;
      ctx.state.wolfTargetScope = mapping
        ? {
            ...target,
            targetId: effectiveId,
            life: mapping.scope.life,
            version: mapping.scope.version,
            marks,
          }
        : { ...target, marks };
    }
  }
  // 普通刀口提交后才捕获，participants 来自实际已发表刀票，不从阵营或当前存活反推。
  recordReplayFact(ctx.events, {
    kind: "wolf_knife_committed",
    day: ctx.currentDay(),
    participantIds: [...participantIds],
    requestedTargetId: wolfTarget,
    effectiveTargetId,
  });
  return wolfTarget;
}
