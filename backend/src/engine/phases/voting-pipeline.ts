/**
 * 负责放逐投票的实际单位、候选、席位顺序及既有回合／平票／票权政策。
 * 输入为当前玩家与行动；输出为原票据和放逐结果。preVote中断不制造普通开票单位；
 * 首票前开同一单位，王子复收票与PK共用，零放逐、翻牌或映射落空仍属于已开单位。
 * 秘密之身的付款、必需发言与关闭归本族同步序列；本流水线只在原请求点 await，不额外等待未触发路径。
 * Animal复用原token且独占计数／到期政策。警长选举和狼刀维持各自流程，不合并为通用投票器。
 * 诡术师最终映射／事实／出局提案归具名同步组合；本流水线保两块之间的 Noble 等待及原关闭、票与PK。
 * 定序王子的重收票政策归具名同步组合；同一 options 局部在原点替换，后续 PK 共享严格复验闭包。
 */
import { revealSecretBodyExile } from "../../features/noble-secret-body/exile-ports";
import { openExileUnit, attachExileUnit } from "../../domain/exile-unit";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import {
  beginAnimalExileUnit,
  recordAnimalBallotRound,
  sealAnimalBallots,
} from "../../features/animal-dream/ballot-ports";
import { runAnimalPufferChoice } from "../../features/animal-dream/choice-ports";
import { prepareMappedExile, resolveMappedExile, mappedExileSummary } from "../../rulesets/mapped-exile-resolution";
import { recollectOrderPrinceVotes } from "../../rulesets/order-prince-revote";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import { COMPONENT } from "../../domain/components/names";
import { IdentityComponent } from "../../domain/entities/player";
import { VotingRightComponent } from "../../domain/components/voting-right";
import {
  ActionProvider,
  ActionWindow,
  EntityId,
  GameEvent,
  Phase,
  TieBreakerStrategy,
  VoteRecord,
  VotingSummary,
} from "../../domain/model";
import { RoleRegistry } from "../../domain/registries/role-registry";
import { ToolGateway } from "../actions/tool-gateway";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { EventRegistry } from "../events/event-registry";
import { World } from "../../domain/world";
import { GameActionRequestFactory } from "../actions/action-request-factory";
import { SelfDestructWindow, isSelfDestructWindowEnabled } from "../../rulesets/self-destruct-window";
import { canBeExiled, canVoteExile } from "../participation";

/**
 * 投票流水线执行结果。
 */
export interface VotingPipelineResult {
  animalUnit?: object;
  animalRetaliation?: readonly number[];
  summary: VotingSummary;
  interrupted: boolean;
  removed: EntityId[];
  selfDestruct?: import("../../domain").SelfDestructSelection;
}

export interface VotingPipelineOptions {
  strictRequired?: boolean;
  orderPrinceRevote?: boolean;
  /** 当前日次由 PhaseManager 显式传入，不能从事件历史反推。 */
  day: number;
  isCurrent?: () => boolean;
  commitSelfDestruct?: (
    choice: import("../../domain").SelfDestructSelection,
  ) => Promise<void | boolean>;
}

export interface VotingPipelineDependencies {
  world: World;
  roleRegistry: RoleRegistry;
  toolGateway: ToolGateway;
  eventRegistry: EventRegistry;
  events: GameEvent[];
}

interface CollectedVote {
  voterId: EntityId;
  targetId: EntityId | null;
  abstain: boolean;
  fallback: boolean;
  voterLife: NonNullable<ReturnType<typeof captureNightLife>>;
  targetLife?: NonNullable<ReturnType<typeof captureNightLife>>;
}

/**
 * 放逐投票流水线：
 * 1) 在 onPreVote 窗口可触发狼人自爆中断。
 * 2) 存活且有投票权玩家依次投票，按权重计票。
 * 3) 调用 EventRegistry 处理白痴免死、警徽销毁等投后钩子。
 */
export class VotingPipeline {
  private static readonly MAX_VOTE_RETRIES = 3;
  private readonly world: World;
  private readonly selfDestructWindow: SelfDestructWindow;
  private readonly toolGateway: ToolGateway;
  private readonly eventRegistry: EventRegistry;
  private readonly events: GameEvent[];

  constructor(dependencies: VotingPipelineDependencies) {
    this.world = dependencies.world;
    this.toolGateway = dependencies.toolGateway;
    this.eventRegistry = dependencies.eventRegistry;
    this.events = dependencies.events;
    this.selfDestructWindow = new SelfDestructWindow(
      this.world,
      dependencies.roleRegistry,
      this.toolGateway,
    );
  }

  async execute(
    config: ReadonlyBoardConfig,
    actionProvider: ActionProvider,
    options: VotingPipelineOptions,
  ): Promise<VotingPipelineResult> {
    let unitDay: number;
    const requests = new GameActionRequestFactory(this.world, this.events, (unitDay = options.day));
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "voting_pipeline_start",
      phase: Phase.Voting,
      status: "ok",
      input: {
        on_pre_vote_hook: config.hooks.onPreVote,
      },
    });
    if (config.hooks.onPreVote && isSelfDestructWindowEnabled(config, ActionWindow.OnPreVote)) {
      const exploded = await this.selfDestructWindow.execute(
        requests,
        actionProvider,
        ActionWindow.OnPreVote,
        Phase.Voting,
        options.isCurrent,
        options.commitSelfDestruct,
      );
      if (exploded !== null) {
        safeRecordLogicOp({
          scope: "phase_pipeline",
          op: "voting_interrupted_by_self_destruct",
          actorId: exploded.actorId,
          phase: Phase.Voting,
          status: "ok",
        });
        return {
          summary: {
            tally: {},
            target: null,
            removed:
              exploded.targetId === null
                ? [exploded.actorId]
                : [exploded.actorId, exploded.targetId],
          },
          interrupted: true,
          selfDestruct: exploded,
          removed:
            exploded.targetId === null ? [exploded.actorId] : [exploded.actorId, exploded.targetId],
        };
      }
    }

    if (options.isCurrent && !options.isCurrent())
      return { summary: { tally: {}, target: null, removed: [] }, interrupted: false, removed: [] };
    const animalUnit = config.animalDream
      ? beginAnimalExileUnit(
          this.world,
          (unitDay = options.day),
          "exile",
          () => options.isCurrent?.() !== false,
        )
      : undefined;
    // 此门禁已开启一次真实放逐；后续重新收票／PK仍消费同一个对象。
    const exileUnit = openExileUnit(unitDay, "exile", animalUnit);
    const voters = this.world
      .getAliveEntityIds()
      .filter((id) => canVoteExile(this.world, id, options.day));

    // 请求并行执行；Promise.all 保留原投票者顺序，公开票据按该顺序稳定发布。
    const voteResults = await this.collectVotes(voters, requests, actionProvider, options);
    if (options.isCurrent?.() === false)
      return attachExileUnit({ summary: { tally: {}, target: null, removed: [] }, interrupted: false, removed: [] }, exileUnit);
    let { tally, publicVotes } = this.recordVotesInSeatOrder(voteResults, options.day);
    if (animalUnit) recordAnimalBallotRound(this.world, animalUnit, 1, publicVotes);
    const revotePipeline = this;
    const revote = recollectOrderPrinceVotes({
      get config() { return config; },
      get world() { return revotePipeline.world; },
      get requests() { return requests; },
      get actionProvider() { return actionProvider; },
      get toolGateway() { return revotePipeline.toolGateway; },
      get events() { return revotePipeline.events; },
      // 同一局部在原激活点替换，初始选择和后续 PK 继续晚读它；不是第二份 options 快照。
      get options() { return options; },
      set options(next) { options = next; },
      collectVotes(voters: EntityId[]) {
        return revotePipeline.collectVotes(voters, requests, actionProvider, options);
      },
      recordVotes(votes: Array<CollectedVote | null>) {
        return revotePipeline.recordVotesInSeatOrder(votes, options.day, true);
      },
    });
    let revoteStep = revote.next();
    while (!revoteStep.done) {
      // 仅在组合交回原 choice／collect Promise 时等待；未配置或未重启没有新的尾 await。
      revoteStep = revote.next(await revoteStep.value);
    }
    if (revoteStep.value !== undefined)
      ({ tally, publicVotes } = revoteStep.value);
    const pk = config.voting?.exilePolicy === "awa_one_pk_v1";
    const maximum = Math.max(
      0,
      ...Object.entries(tally)
        .filter(([id]) => canBeExiled(this.world, Number(id)))
        .map(([, score]) => score),
    );
    const tied =
      maximum > 0
        ? Object.entries(tally)
            .filter(([id, score]) => score === maximum && canBeExiled(this.world, Number(id)))
            .map(([id]) => Number(id))
        : [];
    let round = 1;
    if (pk && tied.length > 1) {
      this.events.push({
        timestamp: Date.now(),
        type: "vote_summary",
        payload: { votes: publicVotes, tally, target: null, round: 1 },
      });
      this.events.push({
        timestamp: Date.now(),
        type: "exile_pk_started",
        payload: { candidates: tied },
      });
      for (const actorId of tied) {
        if (options.isCurrent?.() === false)
          return attachExileUnit({
            summary: { tally: {}, target: null, removed: [] },
            interrupted: false,
            removed: [],
          }, exileUnit);
        const life = captureNightLife(this.world, actorId);
        if (!life || !canBeExiled(this.world, actorId)) {
          if (options.strictRequired) throw new Error("order_prince_pk_candidate_stale");
          continue;
        }
        const request = requests.create({
          phase: Phase.Voting,
          actorId,
          allowedTools: ["speak"],
          stage: "exile_pk_speech",
          requiresAction: true,
          summary: { key: "request.summary.exile_pk" },
          context: {
            exile_candidates: tied,
            round: 2,
            max_rounds: 2,
            ...(options.strictRequired
              ? { action_failure_policy: "error", allow_fallback: false }
              : {}),
          },
        });
        const action = await actionProvider.getAction(request);
        if (options.isCurrent?.() === false)
          return attachExileUnit({
            summary: { tally: {}, target: null, removed: [] },
            interrupted: false,
            removed: [],
          }, exileUnit);
        if (
          action?.name !== "speak" ||
          !livingNightLife(this.world, life) ||
          !canBeExiled(this.world, actorId)
        ) {
          if (options.strictRequired) throw new Error("order_prince_pk_speech_missing_or_stale");
          continue;
        }
        const result = this.toolGateway.validateAndSanitize(this.world, actorId, action, {
          phase: Phase.Voting,
          day: options.day,
        });
        if (
          options.strictRequired &&
          (!result.ok || !result.sanitizedCall || !livingNightLife(this.world, life))
        )
          throw new Error("order_prince_pk_speech_invalid");
        if (result.ok && result.sanitizedCall && livingNightLife(this.world, life))
          this.events.push({
            timestamp: Date.now(),
            type: "day_speech",
            payload: { actorId, text: result.sanitizedCall.args.text },
          });
      }
      const candidates = tied.filter((id) => canBeExiled(this.world, id));
      const revoters = this.world
        .getAliveEntityIds()
        .filter((id) => !tied.includes(id) && canVoteExile(this.world, id, options.day));
      const results = await this.collectVotes(
        revoters,
        requests,
        actionProvider,
        options,
        candidates,
      );
      if (options.isCurrent?.() === false)
        return attachExileUnit({
          summary: { tally: {}, target: null, removed: [] },
          interrupted: false,
          removed: [],
        }, exileUnit);
      ({ tally, publicVotes } = this.recordVotesInSeatOrder(
        results,
        options.day,
        options.strictRequired,
      ));
      round = 2;
      if (animalUnit) recordAnimalBallotRound(this.world, animalUnit, 2, publicVotes, candidates);
    }

    const target = this.pickMajorityTarget(
      Object.fromEntries(
        Object.entries(tally).filter(([id]) => canBeExiled(this.world, Number(id))),
      ),
      pk ? "no_elimination" : (config.tieBreaker?.exileVote ?? "min_id"),
    );
    this.events.push({
      timestamp: Date.now(),
      type: "vote_summary",
      payload: {
        votes: publicVotes,
        tally,
        target,
        ...(pk ? { round } : {}),
      },
    });
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "vote_tally_resolved",
      phase: Phase.Voting,
      status: "ok",
      output: {
        tally,
        target,
      },
    });
    let animalRetaliation: readonly number[] = [];
    if (animalUnit) {
      sealAnimalBallots(this.world, animalUnit);
      animalRetaliation = await runAnimalPufferChoice(
        this.world,
        this.events,
        actionProvider,
        this.toolGateway,
        options.day,
        animalUnit,
        // 封存原票之后只提供惰性依赖；河豚在原有效 actor／scope 边界前独立构造，不能复用 requests。
        { get requestFactory() { return GameActionRequestFactory; } },
      );
    }
    if (target === null) {
      return attachExileUnit({
        summary: {
          tally,
          target: null,
          removed: [],
        },
        interrupted: false,
        removed: [],
        ...(animalUnit ? { animalUnit, animalRetaliation } : {}),
      }, exileUnit);
    }

    const thisPipeline = this;
    // 原映射先付款／发表，再取有效目标；Noble 仍在两业务块之间，不按 missed 跳过。
    const { mapped, effectiveTarget } = prepareMappedExile({
      get enabled() { return config.trickster; },
      get world() { return thisPipeline.world; },
      get day() { return options.day; },
      get events() { return thisPipeline.events; },
    }, target);
    const reveal = revealSecretBodyExile(
      {
        get enabled() { return config.nobleSecretBody; },
        get world() { return thisPipeline.world; },
        get events() { return thisPipeline.events; },
        get requests() { return requests; },
        get toolGateway() { return thisPipeline.toolGateway; },
        get day() { return options.day; },
        get isCurrent() { return options.isCurrent; },
      },
      effectiveTarget,
    );
    const revealStep = reveal.next();
    if (!revealStep.done) {
      try {
        // 只等待原 Provider；未触发翻牌的同步完成路径不进入此处。
        const action = await actionProvider.getAction(revealStep.value);
        reveal.next(action);
      } finally {
        // Provider 同步抛错／拒绝时驱动本族关闭；已完成或抛错的生成器不会再次关闭 scope。
        reveal.return(false);
      }
      return attachExileUnit({ summary: { tally, target, removed: [] }, removed: [], interrupted: false }, exileUnit);
    }
    // Noble 同步完成之后才形成出局提案；原钩子 receiver 与参数读取保持晚读。
    const removed = resolveMappedExile({
      get eventRegistry() { return thisPipeline.eventRegistry; },
      get world() { return thisPipeline.world; },
      get events() { return thisPipeline.events; },
      get animalUnit() { return animalUnit; },
    }, mapped, effectiveTarget);

    return attachExileUnit({
      summary: {
        tally,
        target,
        ...mappedExileSummary(mapped, effectiveTarget),
        removed,
      },
      interrupted: false,
      removed,
      ...(animalUnit ? { animalUnit, animalRetaliation } : {}),
    }, exileUnit);
  }

  private async collectVotes(
    voters: EntityId[],
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
    options: VotingPipelineOptions,
    candidates?: EntityId[],
  ): Promise<Array<CollectedVote | null>> {
    // 在调用任何 Provider 之前捕获完整轮次；同步测试 Provider 也不能改变后续捕获的原生命。
    const voterLives = voters.map((voterId) => ({
      voterId,
      life: captureNightLife(this.world, voterId),
    }));
    const targetLives = new Map(
      (candidates ?? this.world.getAliveEntityIds()).flatMap((id) => {
        const life = captureNightLife(this.world, id);
        return life ? [[id, life] as const] : [];
      }),
    );
    return Promise.all(
      voterLives.map(({ voterId, life }) =>
        life
          ? this.collectVoterVote(
              voterId,
              life,
              targetLives,
              requests,
              actionProvider,
              options,
              candidates,
            )
          : null,
      ),
    );
  }

  private async collectVoterVote(
    voterId: EntityId,
    voterLife: NonNullable<ReturnType<typeof captureNightLife>>,
    targetLives: ReadonlyMap<EntityId, NonNullable<ReturnType<typeof captureNightLife>>>,
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
    options: VotingPipelineOptions,
    candidates?: EntityId[],
  ): Promise<CollectedVote | null> {
    const current = () => {
      const valid =
        options.isCurrent?.() !== false &&
        livingNightLife(this.world, voterLife) &&
        canVoteExile(this.world, voterId, options.day) &&
        !candidates?.includes(voterId);
      if (!valid && options.strictRequired) throw new Error("order_prince_revote_actor_stale");
      return valid;
    };
    const maxRetries = VotingPipeline.MAX_VOTE_RETRIES;
    let retryReason = "";
    const recordRetry = (attempt: number) =>
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "vote_retry_requested",
        actorId: voterId,
        phase: Phase.Voting,
        status: "fallback",
        reason: retryReason,
        output: { attempt, max_retries: maxRetries },
      });

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      if (!current()) return null;
      const baseRequest = requests.create({
        phase: Phase.Voting,
        actorId: voterId,
        allowedTools: ["vote"],
        stage: candidates
          ? "exile_pk_vote"
          : options.orderPrinceRevote
            ? "order_prince_revote"
            : "voting",
        requiresAction: true,
        summary: { key: "request.summary.exile_vote" },
        context: {
          ...(candidates ? { exile_candidates: candidates, round: 2, max_rounds: 2 } : {}),
          ...(options.strictRequired
            ? { action_failure_policy: "error", allow_fallback: false }
            : {}),
        },
      });
      const request =
        attempt === 1
          ? baseRequest
          : {
              ...baseRequest,
              context: {
                ...baseRequest.context,
                retry_attempt: attempt - 1,
                retry_max: maxRetries,
                retry_reason: retryReason,
                retry_notice_message: { key: "request.retry.exile_vote" as const },
              },
            };
      if (!current()) return null;
      const action = await actionProvider.getAction(request);
      if (!current()) return null;
      if (action?.name !== "vote") {
        retryReason = "no_valid_vote_tool_call";
        if (attempt <= maxRetries) {
          recordRetry(attempt);
          continue;
        }
        break;
      }

      const result = this.toolGateway.validateAndSanitize(this.world, voterId, action, {
        phase: Phase.Voting,
        day: options.day,
        exileCandidates: candidates,
      });
      if (
        !result.ok ||
        !result.sanitizedCall ||
        (!result.sanitizedCall.args.abstain &&
          (!targetLives.get(result.sanitizedCall.args.target_id!) ||
            !livingNightLife(this.world, targetLives.get(result.sanitizedCall.args.target_id!)!)))
      ) {
        retryReason = "invalid_vote_arguments";
        if (attempt <= maxRetries) {
          recordRetry(attempt);
          continue;
        }
        break;
      }
      return {
        voterId,
        targetId: result.sanitizedCall.args.target_id,
        abstain: result.sanitizedCall.args.abstain === true,
        fallback: attempt > 1,
        voterLife,
        ...(result.sanitizedCall.args.target_id !== null
          ? { targetLife: targetLives.get(result.sanitizedCall.args.target_id) }
          : {}),
      };
    }

    if (!current()) return null;
    if (options.strictRequired) throw new Error("order_prince_revote_action_missing_or_invalid");
    // 重试耗尽后仍需原网关接受，才将缺失行动修复为明确弃票。
    const repaired = this.toolGateway.validateAndSanitize(
      this.world,
      voterId,
      { name: "vote", args: { target_id: null, abstain: true } },
      { phase: Phase.Voting, day: options.day, exileCandidates: candidates },
    );
    if (repaired.ok && repaired.sanitizedCall) {
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "vote_repaired_to_abstain",
        actorId: voterId,
        phase: Phase.Voting,
        status: "ok",
        reason: retryReason || "vote_retry_exhausted",
      });
      return { voterId, targetId: null, abstain: true, fallback: true, voterLife };
    }
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "vote_rejected",
      actorId: voterId,
      phase: Phase.Voting,
      status: "rejected",
      reason: retryReason || "vote_retry_exhausted",
    });
    return null;
  }

  private recordVotesInSeatOrder(
    votes: Array<CollectedVote | null>,
    day: number,
    strictRequired = false,
  ): {
    tally: Record<number, number>;
    publicVotes: VoteRecord[];
  } {
    const tally: Record<number, number> = {};
    const publicVotes: VoteRecord[] = [];
    for (const vote of votes) {
      if (!vote) continue;
      const { voterId } = vote;
      if (
        !livingNightLife(this.world, vote.voterLife) ||
        (!vote.abstain && (!vote.targetLife || !livingNightLife(this.world, vote.targetLife))) ||
        !canVoteExile(this.world, voterId, day) ||
        (!vote.abstain && vote.targetId !== null && !canBeExiled(this.world, vote.targetId))
      ) {
        if (strictRequired) throw new Error("order_prince_revote_ballot_stale");
        continue;
      }
      let weight = 0;
      if (!vote.abstain && vote.targetId !== null) {
        const voting = this.world.getComponent(voterId, COMPONENT.VotingRight);
        weight = voting?.weight ?? 1;
        tally[vote.targetId] = (tally[vote.targetId] ?? 0) + weight;
      }
      this.events.push({
        timestamp: Date.now(),
        type: "vote_cast",
        payload: {
          actorId: voterId,
          targetId: vote.targetId,
          abstain: vote.abstain,
          weight,
          ...(vote.fallback ? { fallback: true } : {}),
        },
      });
      publicVotes.push({
        actorId: voterId,
        targetId: vote.targetId,
        abstain: vote.abstain,
        weight,
      });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "vote_cast",
        actorId: voterId,
        phase: Phase.Voting,
        status: "ok",
        output: { target_id: vote.targetId, abstain: vote.abstain, weight },
      });
    }
    return { tally, publicVotes };
  }

  /**
   * 依据计票结果选出放逐目标，平票按编号最小值决议。
   */
  private pickMajorityTarget(
    tally: Record<number, number>,
    strategy: TieBreakerStrategy,
  ): EntityId | null {
    const entries = Object.entries(tally);
    if (entries.length === 0) {
      return null;
    }

    entries.sort((a, b) => {
      const voteDiff = b[1] - a[1];
      if (voteDiff !== 0) {
        return voteDiff;
      }
      if (strategy === "min_seat") {
        const aId = Number(a[0]);
        const bId = Number(b[0]);
        const aSeat = this.world.getComponent(aId, COMPONENT.Identity)?.seat ?? aId;
        const bSeat = this.world.getComponent(bId, COMPONENT.Identity)?.seat ?? bId;
        return aSeat - bSeat;
      }
      return Number(a[0]) - Number(b[0]);
    });

    if (entries.length >= 2 && entries[0][1] === entries[1][1]) {
      if (strategy === "no_elimination") {
        return null;
      }
    }

    return Number(entries[0][0]);
  }
}
