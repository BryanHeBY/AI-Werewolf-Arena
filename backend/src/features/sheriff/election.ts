/**
 * 负责警长上警、竞选、退水和两轮选举的原有顺序；输入为当前座位、Provider、网关及惰性构造器，输出原选举证据与当选者。
 * 上警阶段先建立全部请求才并发调用，竞选按座位串行；退水／投票保原生命复验和事后写入前缀，PK不套用放逐或狼刀规则。
 * 请求在原存活名单确定之后才 new 一份本次选举工厂，全部竞选／退水／PK沿用它，不提前读取构造依赖。
 * 构造、玩家、校验或事件异常原样传播；已发事实不回滚，警徽赋权仍由警徽所有者提交，不以端口授予候选资格。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { weddingBadgeSwallowed } from "../ghost-bride/authority";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import { COMPONENT } from "../../domain/components/names";
import { IdentityComponent } from "../../domain/entities/player";
import {
  ActionProvider,
  EntityId,
  GameEvent,
  Phase,
  TieBreakerStrategy,
} from "../../domain/model";
import { World } from "../../domain/world";
import { ToolGateway } from "../../engine/actions/tool-gateway";
import type { ActionRequestFactoryConstructorPort, ActionRequestConstructionPort } from "../../domain/actions";
import { assignSheriff, findSheriffId } from "./badge";
import { canBeSheriff, canVote } from "../../engine/participation";
import type { RoleCatalog } from "../../rulesets/roles/catalog";

export interface SheriffElectionInput {
  world: World;
  events: GameEvent[];
  toolGateway: ToolGateway;
  actionProvider: ActionProvider;
  day: number;
  enableSheriff: boolean;
  config?: ReadonlyBoardConfig;
  roleCatalog?: RoleCatalog;
  isCurrent?: () => boolean;
  /** 装配端 getter 保原构造器读取点；字段仅声明依赖，未开启选举或预建请求。 */
  readonly requestFactory: ActionRequestFactoryConstructorPort;
}

/** 只存已接收的选票字段；生命与候选资格仍在各轮原检查点复验，不把票记录当授权。 */
interface SheriffVote {
  actorId: EntityId;
  targetId: EntityId | null;
  abstain: boolean;
}

export async function electSheriffIfNeeded(input: SheriffElectionInput): Promise<EntityId | null> {
  if (!current(input) || weddingBadgeSwallowed(input.world)) return null;
  const { world, events, day, enableSheriff, config } = input;
  const currentSheriff = findSheriffId(world, input.roleCatalog);
  if (!enableSheriff || day !== 1 || currentSheriff !== null) return currentSheriff;

  const aliveIds = world.getAliveEntityIds().filter((id) => canVote(world, id, input.roleCatalog));
  // 本次选举只在原点 new 一次；不复用白天发言工厂，构造失败时尚未建立上警请求。
  const requests = new input.requestFactory(world, events, day);
  const initialCandidates = await collectNominations(input, requests, aliveIds);
  if (!current(input)) return null;
  const candidateSet = new Set<EntityId>(initialCandidates);
  await collectCampaignSpeeches(input, requests, candidateSet);
  if (!current(input)) return null;
  const finalizedCandidates = await collectWithdrawals(input, requests, candidateSet);
  if (!current(input)) return null;
  const pk = config?.sheriff?.electionPolicy === "awa_nomination_offstage_pk_v1";
  const forbidden = pk ? new Set(initialCandidates) : candidateSet;
  let { tally, votes } =
    pk && finalizedCandidates.length === 1
      ? { tally: new Map([[finalizedCandidates[0], 0]]), votes: [] as SheriffVote[] }
      : await collectSheriffVotes(input, requests, aliveIds, finalizedCandidates, forbidden);
  if (!current(input)) return null;
  let round = 1;
  let eligible = finalizedCandidates.filter((id) => canBeSheriff(world, id, input.roleCatalog));
  const top = positiveLeaders(eligible, tally);
  if (pk && top.length > 1) {
    events.push({
      timestamp: Date.now(),
      type: "sheriff_vote_summary",
      payload: { votes, winnerId: null, round: 1 },
    });
    events.push({
      timestamp: Date.now(),
      type: "sheriff_pk_started",
      payload: { candidates: top },
    });
    await collectCampaignSpeeches(input, requests, new Set(top), "sheriff_pk_speech");
    if (!current(input)) return null;
    const tied = top.filter((id) => canBeSheriff(world, id, input.roleCatalog));
    ({ tally, votes } = await collectSheriffVotes(
      input,
      requests,
      aliveIds,
      tied,
      new Set(top),
      2,
    ));
    if (!current(input)) return null;
    eligible = tied.filter((id) => canBeSheriff(world, id, input.roleCatalog));
    round = 2;
  }
  let winner =
    pk && finalizedCandidates.length === 1 && eligible.length === 1
      ? eligible[0]
      : pickSheriffWinner(
          world,
          eligible,
          tally,
          pk ? "no_elimination" : (config?.tieBreaker?.sheriffVote ?? "min_seat"),
        );
  if (winner !== null && !assignSheriff(world, winner, config, input.roleCatalog)) winner = null;
  events.push({
    timestamp: Date.now(),
    type: "sheriff_vote_summary",
    payload: { votes, winnerId: winner, ...(pk ? { round } : {}) },
  });
  if (winner !== null) {
    events.push({
      timestamp: Date.now(),
      type: "sheriff_elected",
      payload: {
        winnerId: winner,
        candidates: finalizedCandidates,
        tally: Object.fromEntries(tally.entries()),
      },
    });
  }
  return winner;
}

async function collectNominations(
  input: SheriffElectionInput,
  requests: ActionRequestConstructionPort,
  aliveIds: EntityId[],
): Promise<EntityId[]> {
  const { world, events, toolGateway, actionProvider } = input;
  const candidates: EntityId[] = [];
  // 上警声明并行收集，避免顺序执行导致后手玩家读取前手“上警/退水”结果后被动调整。
  // 先建立全部请求，确保每位玩家读取同一批事件快照，再启动并行 Agent 调用。
  const nominationRequests = aliveIds
    .filter((id) => canBeSheriff(world, id, input.roleCatalog))
    .map((actorId) => ({
      actorId,
      life: captureNightLife(world, actorId),
      request: requests.create({
        phase: Phase.Day,
        actorId,
        allowedTools: ["run_for_sheriff"],
        stage: "sheriff_nomination",
        requiresAction: true,
        summary: { key: "request.summary.sheriff_nomination" },
        context: {},
      }),
    }));
  const nominationResults = await Promise.all(
    nominationRequests.map(async ({ actorId, request, life }) => {
      if (!current(input)) return null;
      const action = await actionProvider.getAction(request);
      if (
        !current(input) ||
        !life ||
        !livingNightLife(world, life) ||
        action?.name !== "run_for_sheriff"
      ) {
        return null;
      }
      const result = toolGateway.validateAndSanitize(world, actorId, action, {
        phase: Phase.Day,
      });
      if (!current(input) || !result.ok || !result.sanitizedCall) {
        return null;
      }
      return {
        actorId,
        run: result.sanitizedCall.args.run === true,
        life,
      };
    }),
  );
  if (!current(input)) return [];
  for (const item of nominationResults) {
    if (
      !item ||
      !livingNightLife(world, item.life) ||
      !canBeSheriff(world, item.actorId, input.roleCatalog)
    ) {
      continue;
    }
    events.push({
      timestamp: Date.now(),
      type: "sheriff_candidate_declared",
      payload: { actorId: item.actorId, run: item.run },
    });
    if (item.run) {
      candidates.push(item.actorId);
    }
  }

  const initialCandidates = sortBySeat(world, candidates);
  events.push({
    timestamp: Date.now(),
    type: "sheriff_nomination_summary",
    payload: { candidates: initialCandidates },
  });
  return initialCandidates;
}

async function collectCampaignSpeeches(
  input: SheriffElectionInput,
  requests: ActionRequestConstructionPort,
  candidateSet: Set<EntityId>,
  stage: "sheriff_campaign_speech" | "sheriff_pk_speech" = "sheriff_campaign_speech",
): Promise<void> {
  const { world, events, toolGateway, actionProvider } = input;
  const campaignOrder = sortBySeat(world, [...candidateSet]);
  // 上警发言：候选人按座位顺序发言。
  for (const candidateId of campaignOrder) {
    if (!current(input)) return;
    if (!candidateSet.has(candidateId) || !canBeSheriff(world, candidateId, input.roleCatalog)) {
      continue;
    }
    const life = captureNightLife(world, candidateId);
    if (!life) continue;
    const speechReq = requests.create({
      phase: Phase.Day,
      actorId: candidateId,
      allowedTools: ["speak"],
      stage,
      requiresAction: true,
      summary: { key: "request.summary.sheriff_campaign" },
      context: {
        sheriff_candidates: [...candidateSet],
      },
    });
    const speechAction = await actionProvider.getAction(speechReq);
    if (!current(input)) return;
    if (speechAction?.name === "speak") {
      const speechResult = toolGateway.validateAndSanitize(world, candidateId, speechAction, {
        phase: Phase.Day,
      });
      if (
        current(input) &&
        livingNightLife(world, life) &&
        speechResult.ok &&
        speechResult.sanitizedCall &&
        canBeSheriff(world, candidateId, input.roleCatalog)
      ) {
        events.push({
          timestamp: Date.now(),
          type: "day_speech",
          payload: {
            actorId: candidateId,
            text: speechResult.sanitizedCall.args.text,
          },
        });
      }
    }
  }
}

async function collectWithdrawals(
  input: SheriffElectionInput,
  requests: ActionRequestConstructionPort,
  candidateSet: Set<EntityId>,
): Promise<EntityId[]> {
  const { world, events, toolGateway, actionProvider } = input;
  // 发言结束后统一进入退水阶段，再进入警长投票。
  const orderedCandidates = sortBySeat(
    world,
    [...candidateSet].filter((id) => canBeSheriff(world, id, input.roleCatalog)),
  );
  const withdrawRequests = orderedCandidates.map((candidateId) => ({
    candidateId,
    life: captureNightLife(world, candidateId),
    request: requests.create({
      phase: Phase.Day,
      actorId: candidateId,
      allowedTools: ["run_for_sheriff"],
      stage: "sheriff_withdraw",
      requiresAction: true,
      summary: { key: "request.summary.sheriff_withdraw" },
      context: {
        sheriff_candidates: [...candidateSet],
      },
    }),
  }));
  const withdrawResults = await Promise.all(
    withdrawRequests.map(async ({ candidateId, request, life }) => {
      if (!current(input)) return null;
      const withdrawAction = await actionProvider.getAction(request);
      if (
        !current(input) ||
        !life ||
        !livingNightLife(world, life) ||
        withdrawAction?.name !== "run_for_sheriff"
      ) {
        return null;
      }
      const withdrawResult = toolGateway.validateAndSanitize(world, candidateId, withdrawAction, {
        phase: Phase.Day,
      });
      if (!current(input) || !withdrawResult.ok || !withdrawResult.sanitizedCall) {
        return null;
      }
      return {
        candidateId,
        keepRunning: withdrawResult.sanitizedCall.args.run === true,
        life,
      };
    }),
  );
  if (!current(input)) return [];
  const withdrawn: EntityId[] = [];
  for (const item of withdrawResults) {
    if (!item || !livingNightLife(world, item.life) || item.keepRunning) {
      continue;
    }
    candidateSet.delete(item.candidateId);
    withdrawn.push(item.candidateId);
    events.push({
      timestamp: Date.now(),
      type: "sheriff_candidate_declared",
      payload: { actorId: item.candidateId, run: false },
    });
  }
  events.push({
    timestamp: Date.now(),
    type: "sheriff_withdraw_summary",
    payload: { withdrawn: sortBySeat(world, withdrawn) },
  });

  for (const id of candidateSet)
    if (!canBeSheriff(world, id, input.roleCatalog)) candidateSet.delete(id);
  const finalizedCandidates = sortBySeat(world, [...candidateSet]);
  events.push({
    timestamp: Date.now(),
    type: "sheriff_candidates_finalized",
    payload: { candidates: finalizedCandidates },
  });
  return finalizedCandidates;
}

async function collectSheriffVotes(
  input: SheriffElectionInput,
  requests: ActionRequestConstructionPort,
  aliveIds: EntityId[],
  finalizedCandidates: EntityId[],
  candidateSet: Set<EntityId>,
  round = 1,
): Promise<{ tally: Map<EntityId, number>; votes: SheriffVote[] }> {
  const { world, events, toolGateway, actionProvider } = input;
  const tally = new Map<EntityId, number>();
  for (const id of finalizedCandidates) {
    tally.set(id, 0);
  }
  if (finalizedCandidates.length === 0) return { tally, votes: [] };

  // 规则：警长投票仅允许警下玩家（未在最终警上名单内）参与。
  const sheriffVoterIds = aliveIds.filter(
    (id) => !candidateSet.has(id) && canVote(world, id, input.roleCatalog),
  );
  // 警长投票同样并行收集，所有投票基于同一快照上下文。
  const candidateLives = new Map(
    finalizedCandidates.map((id) => [id, captureNightLife(world, id)]),
  );
  const sheriffVoteRequests = sheriffVoterIds.map((actorId) => ({
    actorId,
    life: captureNightLife(world, actorId),
    request: requests.create({
      phase: Phase.Day,
      actorId,
      allowedTools: ["vote_for_sheriff"],
      stage: round === 2 ? "sheriff_pk_vote" : "sheriff_vote",
      requiresAction: true,
      summary: { key: "request.summary.sheriff_vote" },
      context: {
        sheriff_candidates: finalizedCandidates,
        ...(round === 2 ? { round: 2, max_rounds: 2 } : {}),
      },
    }),
  }));
  const sheriffVoteResults = await Promise.all(
    sheriffVoteRequests.map(async ({ actorId, request, life }) => {
      if (!current(input)) return null;
      const action = await actionProvider.getAction(request);
      if (
        !current(input) ||
        !life ||
        !livingNightLife(world, life) ||
        action?.name !== "vote_for_sheriff"
      ) {
        return null;
      }
      const result = toolGateway.validateAndSanitize(world, actorId, action, {
        phase: Phase.Day,
        sheriffCandidates: finalizedCandidates,
      });
      if (!current(input) || !result.ok || !result.sanitizedCall) {
        return null;
      }

      const abstain = result.sanitizedCall.args.abstain === true;
      const targetId = result.sanitizedCall.args.target_id;
      return { actorId, targetId, abstain, life };
    }),
  );
  if (!current(input)) return { tally, votes: [] };
  const acceptedVotes: SheriffVote[] = [];
  for (const item of sheriffVoteResults) {
    if (
      !item ||
      !livingNightLife(world, item.life) ||
      !canVote(world, item.actorId, input.roleCatalog) ||
      candidateSet.has(item.actorId) ||
      (!item.abstain &&
        (item.targetId === null ||
          !finalizedCandidates.includes(item.targetId) ||
          !candidateLives.get(item.targetId) ||
          !livingNightLife(world, candidateLives.get(item.targetId)!) ||
          !canBeSheriff(world, item.targetId, input.roleCatalog)))
    ) {
      continue;
    }
    acceptedVotes.push({ actorId: item.actorId, targetId: item.targetId, abstain: item.abstain });
    events.push({
      timestamp: Date.now(),
      type: "sheriff_vote_cast",
      payload: {
        actorId: item.actorId,
        targetId: item.targetId,
        abstain: item.abstain,
      },
    });
    if (!item.abstain && item.targetId !== null) {
      tally.set(item.targetId, (tally.get(item.targetId) ?? 0) + 1);
    }
  }
  return { tally, votes: acceptedVotes };
}

function current(input: SheriffElectionInput): boolean {
  if (weddingBadgeSwallowed(input.world)) return false;
  return input.isCurrent?.() ?? true;
}

function pickSheriffWinner(
  world: World,
  candidates: EntityId[],
  tally: Map<EntityId, number>,
  strategy: TieBreakerStrategy,
): EntityId | null {
  if (candidates.length === 0) {
    return null;
  }
  const withSeat = candidates.map((id) => {
    const identity = world.getComponent(id, COMPONENT.Identity);
    return { id, seat: identity?.seat ?? id, score: tally.get(id) ?? 0 };
  });
  withSeat.sort((a, b) => {
    const diff = b.score - a.score;
    if (diff !== 0) {
      return diff;
    }
    if (strategy === "min_id") {
      return a.id - b.id;
    }
    return a.seat - b.seat;
  });
  if ((withSeat[0]?.score ?? 0) <= 0) return null;
  if (withSeat.length >= 2 && withSeat[0].score === withSeat[1].score) {
    if (strategy === "no_elimination" || strategy === "no_kill") {
      return null;
    }
  }
  return withSeat[0]?.id ?? null;
}

function sortBySeat(world: World, ids: EntityId[]): EntityId[] {
  return [...ids].sort((a, b) => {
    const aSeat = world.getComponent(a, COMPONENT.Identity)?.seat ?? a;
    const bSeat = world.getComponent(b, COMPONENT.Identity)?.seat ?? b;
    return aSeat - bSeat;
  });
}

function positiveLeaders(candidates: EntityId[], tally: Map<EntityId, number>): EntityId[] {
  const maximum = Math.max(0, ...candidates.map((id) => tally.get(id) ?? 0));
  return maximum > 0 ? candidates.filter((id) => (tally.get(id) ?? 0) === maximum) : [];
}
