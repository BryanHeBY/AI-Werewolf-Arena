/**
 * 负责按原狼队权限执行夜聊轮次与刀票重试，捕获行动者与目标的原身体／生命版本。
 * 输入为原夜上下文、狼队资格和已校验工具；输出为夜聊、共识和带来源的刀口贡献。
 * 普通刀票、迷雾随机刀、映射和印记仍在原时点处理；贵族 God 刀口事实及必需记录归贵族发布 owner。
 * 不增加重试额度、重建已失效的身体或把发表事实当付款；首失败和已写前缀维持原边界。
 */
import { publishNobleNightKnife } from "../noble_secret_body/knife-ports";
import { isMistRavenBoard, mistKnifeTargets, originalMistTarget } from "../mist_raven/night_frame";
import { nightmareKnifeBlocked } from "../nightmare_shadow/ports";
import { bindWolfKnifeTargetQuery } from "./ports";
/** 文件说明：狼人夜聊与刀人投票阶段处理。 */
import { EntityId, Phase, StatusMark } from "../../../../core/domain/model";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import { NightStageHandler } from "../../stages/night/contracts";
import { wolfChatParticipants, wolfKnifeHolders, wolfTeamEvent } from "../wolf_team";
import { COMPONENT } from "../../../../core/domain/components/names";
import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { NightStageContext } from "../../stages/night/contracts";

const WOLF_DISCUSSION_MAX_ROUNDS = 3;
const WOLF_KILL_VOTE_MAX_RETRIES = 3;

/** 夜聊与刀票在原查询点读取具体板子的失败前缀，不缓存或改写首个错误。 */
function strictWolfFailurePrefix(ctx: NightStageContext): string | null {
  return ctx.nativeNightFailure.strictWolfFailurePrefix();
}

/** 捕获 Role、私有容器／顶层引用与原 Alive 版本；后续只复验同一身体，不复制或延长许可。 */
function captureActorScope(ctx: NightStageContext, actorId: EntityId): () => boolean {
  const role = ctx.world.getComponent(actorId, COMPONENT.Role),
    kind = role?.role,
    camp = role?.camp,
    state = role?.privateState,
    refs = state ? Object.entries(state) : [];
  const life = ctx.world.getComponent(actorId, COMPONENT.Alive),
    version = life && aliveLifeVersion(life);
  return () =>
    ctx.isCurrent() &&
    !!role &&
    ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
    role.role === kind &&
    role.camp === camp &&
    role.privateState === state &&
    refs.every(([key, value]) => (state! as Readonly<Record<string, unknown>>)[key] === value) &&
    !!life &&
    ctx.world.getComponent(actorId, COMPONENT.Alive) === life &&
    life.alive &&
    version !== undefined &&
    aliveLifeVersion(life) === version;
}

const wolfDiscussionStage: NightStageHandler = {
  id: "wolf_discussion",
  priority: 200,
  async execute(ctx): Promise<void> {
    const wolfIds = ctx.shuffleWolves(wolfChatParticipants(ctx.world, ctx.roleCatalog));
    ctx.state.wolfChatOrder = wolfIds;
    ctx.state.endedWolves = new Set<EntityId>();

    if (wolfIds.length > 0) {
      ctx.events.push(
        wolfTeamEvent(ctx.world, ctx.roleCatalog, {
          timestamp: Date.now(),
          type: "wolf_tactical_order",
          payload: { order: [...wolfIds] },
        }),
      );
    }

    // 轮转夜聊：每只狼最多发言 WOLF_DISCUSSION_MAX_ROUNDS 次，end_chat 后跳过后续轮次。
    for (let round = 1; round <= WOLF_DISCUSSION_MAX_ROUNDS; round++) {
      for (const wolfId of wolfIds) {
        if (!wolfChatParticipants(ctx.world, ctx.roleCatalog).includes(wolfId)) continue;
        if (ctx.state.endedWolves.has(wolfId)) {
          continue;
        }
        const actorCurrent = captureActorScope(ctx, wolfId);
        if (!actorCurrent() || !wolfChatParticipants(ctx.world, ctx.roleCatalog).includes(wolfId))
          continue;
        const req = ctx.makeRequest(wolfId, ["speak_to_wolves"], {
          stage: "wolf_discussion",
          round,
          max_rounds: WOLF_DISCUSSION_MAX_ROUNDS,
        });
        const action = await ctx.actionProvider.getAction(req);
        if (!ctx.isCurrent()) return;
        if (!actorCurrent() || !wolfChatParticipants(ctx.world, ctx.roleCatalog).includes(wolfId))
          continue;
        if (action?.name !== "speak_to_wolves") {
          if (strictWolfFailurePrefix(ctx))
            throw new Error(`${strictWolfFailurePrefix(ctx)}_wolf_chat_action_missing`);
          continue;
        }

        if (
          strictWolfFailurePrefix(ctx) &&
          (typeof action.args?.text !== "string" || typeof action.args?.end_chat !== "boolean")
        ) {
          throw new Error(`${strictWolfFailurePrefix(ctx)}_wolf_chat_action_invalid`);
        }
        const result = ctx.toolGateway.validateAndSanitize(ctx.world, wolfId, action, {
          phase: req.phase,
        });
        if (!ctx.isCurrent()) return;
        if (!actorCurrent() || !wolfChatParticipants(ctx.world, ctx.roleCatalog).includes(wolfId))
          continue;
        if (!result.ok || !result.sanitizedCall) {
          if (strictWolfFailurePrefix(ctx))
            throw new Error(`${strictWolfFailurePrefix(ctx)}_wolf_chat_action_invalid`);
          continue;
        }
        if (result.sanitizedCall.args.end_chat) {
          ctx.state.endedWolves.add(wolfId);
          ctx.events.push(
            wolfTeamEvent(ctx.world, ctx.roleCatalog, {
              timestamp: Date.now(),
              type: "wolf_discussion_ended",
              payload: {
                actorId: wolfId,
                reason: result.sanitizedCall.args.text,
                round,
              },
            }),
          );
        } else {
          ctx.events.push(
            wolfTeamEvent(ctx.world, ctx.roleCatalog, {
              timestamp: Date.now(),
              type: "wolf_discussion",
              payload: {
                actorId: wolfId,
                text: result.sanitizedCall.args.text,
                endChat: false,
                round,
              },
            }),
          );
        }
      }
      if (ctx.state.endedWolves.size === wolfIds.length) {
        break;
      }
    }
  },
};

const wolfKillVoteStage: NightStageHandler = {
  id: "wolf_kill_vote",
  priority: 400,
  async execute(ctx): Promise<void> {
    ctx.state.wolfVotes = {};
    if (nightmareKnifeBlocked(ctx.world, ctx.currentDay())) {
      ctx.state.wolfTarget = null;
      delete ctx.state.wolfTargetScope;
      ctx.state.wolfTargetVoters = [];
      return;
    }
    const acceptedTargets: Array<{
      actorId: EntityId;
      targetId: EntityId;
      life: AliveComponent;
      version: number;
    }> = [];
    // 顺序收集狼刀票，统一在阶段末做多数决结算，避免中途状态污染。
    const knifeHolders = wolfKnifeHolders(ctx.world, ctx.roleCatalog);
    // 保留普通狼队原次序；仅有刀权的角色在后半名单独立加入。
    const voteOrder = [
      ...ctx.state.wolfChatOrder.filter((id) => knifeHolders.includes(id)),
      ...knifeHolders.filter((id) => !ctx.state.wolfChatOrder.includes(id)),
    ];
    const mistVoteScopes = isMistRavenBoard(ctx.world)
      ? new Map(voteOrder.map((id) => [id, captureActorScope(ctx, id)] as const))
      : null;
    const explicitPasses = new Set<EntityId>();
    for (const wolfId of voteOrder) {
      if (!wolfKnifeHolders(ctx.world, ctx.roleCatalog).includes(wolfId)) {
        if (mistVoteScopes) throw new Error("mist_wolf_actor_stale");
        continue;
      }
      const actorCurrent = captureActorScope(ctx, wolfId);
      if (!actorCurrent()) {
        if (mistVoteScopes) throw new Error("mist_wolf_actor_stale");
        continue;
      }
      let voteResolved: {
        abstain: boolean;
        targetId: EntityId | null;
        fallback: boolean;
        targetLife?: { life: AliveComponent; version: number };
      } | null = null;
      let retryReason = "";
      for (let attempt = 1; attempt <= WOLF_KILL_VOTE_MAX_RETRIES + 1; attempt++) {
        if (!actorCurrent()) break;
        if (!wolfKnifeHolders(ctx.world, ctx.roleCatalog).includes(wolfId)) break;
        const req =
          attempt === 1
            ? ctx.makeRequest(wolfId, ["kill_vote"], { stage: "wolf_vote" })
            : ctx.makeRequest(wolfId, ["kill_vote"], {
                stage: "wolf_vote",
                retry_attempt: attempt - 1,
                retry_max: WOLF_KILL_VOTE_MAX_RETRIES,
                retry_reason: retryReason,
                retry_notice_message: { key: "request.retry.wolf_vote" },
              });
        const targetLives = new Map(
          ctx.world.getAliveEntityIds().map((id) => {
            const life = ctx.world.getComponent(id, COMPONENT.Alive)!;
            return [id, { life, version: aliveLifeVersion(life) }] as const;
          }),
        );
        const action = await ctx.actionProvider.getAction(req);
        if (!ctx.isCurrent()) return;
        if (!actorCurrent()) break;
        if (action?.name !== "kill_vote") {
          if (strictWolfFailurePrefix(ctx))
            throw new Error(`${strictWolfFailurePrefix(ctx)}_wolf_action_missing`);
          retryReason = "no_valid_kill_vote_tool_call";
          if (attempt <= WOLF_KILL_VOTE_MAX_RETRIES) {
            safeRecordLogicOp({
              scope: "phase_pipeline",
              op: "wolf_kill_vote_retry_requested",
              actorId: wolfId,
              phase: Phase.Night,
              status: "fallback",
              reason: retryReason,
              output: {
                attempt,
                max_retries: WOLF_KILL_VOTE_MAX_RETRIES,
              },
            });
            continue;
          }
          break;
        }

        const result = ctx.toolGateway.validateAndSanitize(ctx.world, wolfId, action, {
          phase: Phase.Night,
        });
        if (!ctx.isCurrent()) return;
        if (!actorCurrent()) break;
        const target = result.sanitizedCall?.args.target_id,
          snapshot = typeof target === "number" ? targetLives.get(target) : undefined;
        const targetCurrent =
          result.sanitizedCall?.args.abstain === true ||
          target === null ||
          (!!snapshot &&
            bindWolfKnifeTargetQuery(ctx.world).allows(target as number) &&
            ctx.world.getComponent(target as number, COMPONENT.Alive) === snapshot.life &&
            snapshot.life.alive &&
            snapshot.version !== undefined &&
            aliveLifeVersion(snapshot.life) === snapshot.version);
        if (!result.ok || !result.sanitizedCall || !targetCurrent) {
          if (strictWolfFailurePrefix(ctx))
            throw new Error(`${strictWolfFailurePrefix(ctx)}_wolf_action_invalid`);
          retryReason = "invalid_kill_vote_arguments";
          if (attempt <= WOLF_KILL_VOTE_MAX_RETRIES) {
            safeRecordLogicOp({
              scope: "phase_pipeline",
              op: "wolf_kill_vote_retry_requested",
              actorId: wolfId,
              phase: Phase.Night,
              status: "fallback",
              reason: retryReason,
              output: {
                attempt,
                max_retries: WOLF_KILL_VOTE_MAX_RETRIES,
              },
            });
            continue;
          }
          break;
        }

        voteResolved = {
          abstain: result.sanitizedCall.args.abstain === true,
          targetId: result.sanitizedCall.args.target_id,
          fallback: attempt > 1,
          ...(!result.sanitizedCall.args.abstain && snapshot && snapshot.version !== undefined
            ? { targetLife: { life: snapshot.life, version: snapshot.version } }
            : {}),
        };
        break;
      }
      if (!actorCurrent() || !wolfKnifeHolders(ctx.world, ctx.roleCatalog).includes(wolfId)) {
        if (mistVoteScopes) throw new Error("mist_wolf_actor_stale");
        continue;
      }
      if (!voteResolved) {
        if (strictWolfFailurePrefix(ctx))
          throw new Error(`${strictWolfFailurePrefix(ctx)}_wolf_action_missing`);
        voteResolved = {
          abstain: true,
          targetId: null,
          fallback: true,
        };
        safeRecordLogicOp({
          scope: "phase_pipeline",
          op: "wolf_kill_vote_repaired_to_abstain",
          actorId: wolfId,
          phase: Phase.Night,
          status: "ok",
          reason: retryReason || "wolf_kill_vote_retry_exhausted",
          output: {
            fallback_abstain: true,
          },
        });
      }

      const abstain = voteResolved.abstain;
      const targetId = voteResolved.targetId;
      if (abstain && targetId === null) explicitPasses.add(wolfId);
      if (!abstain && targetId !== null) {
        if (voteResolved.targetLife)
          acceptedTargets.push({ actorId: wolfId, targetId, ...voteResolved.targetLife });
      }
      ctx.events.push(
        wolfTeamEvent(ctx.world, ctx.roleCatalog, {
          timestamp: Date.now(),
          type: "wolf_kill_vote_cast",
          payload: {
            actorId: wolfId,
            abstain,
            targetId,
            ...(voteResolved.fallback ? { fallback: true } : {}),
          },
        }),
      );
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "wolf_kill_vote_cast",
        actorId: wolfId,
        phase: Phase.Night,
        status: "ok",
        output: { abstain, target_id: targetId },
      });
    }

    if (mistVoteScopes)
      for (const [id, current] of mistVoteScopes)
        if (!current() || !wolfKnifeHolders(ctx.world, ctx.roleCatalog).includes(id))
          throw new Error("mist_wolf_actor_stale");
    for (const target of acceptedTargets) {
      const current =
        ctx.world.getComponent(target.targetId, COMPONENT.Alive) === target.life &&
        target.life.alive &&
        aliveLifeVersion(target.life) === target.version &&
        bindWolfKnifeTargetQuery(ctx.world).allows(target.targetId);
      if (!current && mistVoteScopes) throw new Error("mist_wolf_target_stale");
      if (current)
        ctx.state.wolfVotes[target.targetId] = (ctx.state.wolfVotes[target.targetId] ?? 0) + 1;
    }
    let wolfTarget = ctx.pickMajorityTarget(ctx.state.wolfVotes);
    let mistRandomScope: import("../../../../core/domain/night_effects").NightLifeScope | null =
      null;
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
        const mapping = ctx.nativeNightTargets.mappedTarget(
          () => ctx.currentDay(),
          () => wolfTarget,
        );
        if (mapping && !mapping.isCurrent()) throw new Error("magician_knife_target_stale");
        const effectiveId = mapping?.effectiveId ?? wolfTarget;
        const marks = ctx.ensureMarks(effectiveId);
        marks.add(StatusMark.WolfKillMark);
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
    publishNobleNightKnife(() => ctx, wolfTarget);
  },
};

/** 狼人夜间阶段列表。 */
export const WOLF_NIGHT_STAGES: NightStageHandler[] = [wolfDiscussionStage, wolfKillVoteStage];
