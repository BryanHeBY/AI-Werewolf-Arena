/**
 * 负责按原狼队权限执行夜聊轮次与刀票重试，捕获行动者与目标的原身体／生命版本。
 * 输入为原夜上下文、狼队资格和已校验工具；输出为夜聊、共识和带来源的刀口贡献。
 * 收票后由普通狼刀规则组合按原时点处理迷雾抽刀、映射和印记；贵族 God 刀口事实及必需记录归贵族发布 owner。
 * 原演员快照晚查实际阵营值，不增加 Camp 引用撤权；每个提交仍晚查现有狼队执行资格。
 * 不增加重试额度、重建已失效的身体或把发表事实当付款；首失败和已写前缀维持原边界。
 */
import { publishNobleNightKnife } from "../noble-secret-body/knife-ports";
import { isMistRavenBoard } from "../mist-raven/knife-ports";
import {
  resolveOrdinaryWolfKnife,
  type AcceptedWolfKnifeTarget,
} from "../../rulesets/ordinary-wolf-knife-routing";
import { nightmareKnifeBlocked } from "../nightmare/ports";
import { bindWolfKnifeTargetQuery } from "./ports";
/** 文件说明：狼人夜聊与刀人投票阶段处理。 */
import { EntityId, Phase } from "../../domain/model";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { NightStageHandler } from "../../engine/night/contracts";
import { wolfChatParticipants, wolfKnifeHolders, wolfTeamEvent } from "../wolf-team/action-ports";
import { COMPONENT } from "../../domain/components/names";
import { AliveComponent, aliveLifeVersion } from "../../domain/components/alive";
import type { RoleComponent } from "../../domain/components/role";
import type { NightStageContext } from "../../engine/night/contracts";

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
    camp = role == null ? undefined : ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp,
    state = role?.privateState,
    refs = state ? Object.entries(state) : [];
  const life = ctx.world.getComponent(actorId, COMPONENT.Alive),
    version = life && aliveLifeVersion(life);
  return () =>
    ctx.isCurrent() &&
    !!role &&
    ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
    role.role === kind &&
    ctx.world.getComponent(actorId, COMPONENT.Camp)?.camp === camp &&
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
    const acceptedTargets: AcceptedWolfKnifeTarget[] = [];
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
    const wolfTarget = resolveOrdinaryWolfKnife(ctx, acceptedTargets, voteOrder, explicitPasses);
    publishNobleNightKnife(() => ctx, wolfTarget);
  },
};

/** 狼人夜间阶段列表。 */
export const WOLF_NIGHT_STAGES: NightStageHandler[] = [wolfDiscussionStage, wolfKillVoteStage];
