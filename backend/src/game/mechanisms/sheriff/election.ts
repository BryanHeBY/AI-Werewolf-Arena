import { COMPONENT } from "../../../core/domain/components/names";
import { IdentityComponent } from "../../../core/domain/entities/player";
import { ActionProvider, BoardConfig, EntityId, GameEvent, Phase, TieBreakerStrategy } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { ToolGateway } from "../../gateway/tool_gateway";
import { GameActionRequestFactory } from "../../engine/action_request_factory";
import { assignSheriff, findSheriffId } from "./badge";

export interface SheriffElectionInput {
  world: World;
  events: GameEvent[];
  toolGateway: ToolGateway;
  actionProvider: ActionProvider;
  day: number;
  enableSheriff: boolean;
  config?: BoardConfig;
}

interface SheriffVote {
  actorId: EntityId;
  targetId: EntityId | null;
  abstain: boolean;
}

export async function electSheriffIfNeeded(input: SheriffElectionInput): Promise<EntityId | null> {
  const { world, events, day, enableSheriff, config } = input;
  const currentSheriff = findSheriffId(world);
  if (!enableSheriff || day !== 1 || currentSheriff !== null) return currentSheriff;

  const aliveIds = world.getAliveEntityIds();
  const requests = new GameActionRequestFactory(world, events, day);
  const initialCandidates = await collectNominations(input, requests, aliveIds);
  const candidateSet = new Set<EntityId>(initialCandidates);
  await collectCampaignSpeeches(input, requests, candidateSet);
  const finalizedCandidates = await collectWithdrawals(input, requests, candidateSet, initialCandidates);
  const { tally, votes } = await collectSheriffVotes(input, requests, aliveIds, finalizedCandidates, candidateSet);
  const winner = pickSheriffWinner(world, finalizedCandidates, tally, config?.tieBreaker?.sheriffVote ?? "min_seat");
  events.push({ timestamp: Date.now(), type: "sheriff_vote_summary", payload: { votes, winnerId: winner } });
  if (winner !== null) {
    assignSheriff(world, winner, config);
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

async function collectNominations(input: SheriffElectionInput, requests: GameActionRequestFactory, aliveIds: EntityId[]): Promise<EntityId[]> {
  const { world, events, toolGateway, actionProvider } = input;
  const candidates: EntityId[] = [];
  // 上警声明并行收集，避免顺序执行导致后手玩家读取前手“上警/退水”结果后被动调整。
  // 先建立全部请求，确保每位玩家读取同一批事件快照，再启动并行 Agent 调用。
  const nominationRequests = aliveIds.map((actorId) => ({
    actorId,
    request: requests.create({
      phase: Phase.Day,
      actorId,
      allowedTools: ["run_for_sheriff"],
      stage: "sheriff_nomination",
      requiresAction: true,
      summary: "上警声明阶段必须选择上警或退警。",
      context: {},
    }),
  }));
  const nominationResults = await Promise.all(
    nominationRequests.map(async ({ actorId, request }) => {
      const action = await actionProvider.getAction(request);
      if (action?.name !== "run_for_sheriff") {
        return null;
      }
      const result = toolGateway.validateAndSanitize(world, actorId, action, {
        phase: Phase.Day,
      });
      if (!result.ok || !result.sanitizedCall) {
        return null;
      }
      return {
        actorId,
        run: result.sanitizedCall.args.run === true,
      };
    }),
  );
  for (const item of nominationResults) {
    if (!item) {
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

  const initialCandidates =
    candidates.length > 0 ? sortBySeat(world, candidates) : sortBySeat(world, [...aliveIds]);
  events.push({
    timestamp: Date.now(),
    type: "sheriff_nomination_summary",
    payload: { candidates: initialCandidates },
  });
  return initialCandidates;
}

async function collectCampaignSpeeches(input: SheriffElectionInput, requests: GameActionRequestFactory, candidateSet: Set<EntityId>): Promise<void> {
  const { world, events, toolGateway, actionProvider } = input;
  const campaignOrder = sortBySeat(world, [...candidateSet]);
  // 上警发言：候选人按座位顺序发言。
  for (const candidateId of campaignOrder) {
    if (!candidateSet.has(candidateId)) {
      continue;
    }
    const speechReq = requests.create({
      phase: Phase.Day,
      actorId: candidateId,
      allowedTools: ["speak"],
      stage: "sheriff_campaign_speech",
      requiresAction: true,
      summary: "警上竞选发言阶段必须完成一次发言。",
      context: {
        sheriff_candidates: [...candidateSet],
      },
    });
    const speechAction = await actionProvider.getAction(speechReq);
    if (speechAction?.name === "speak") {
      const speechResult = toolGateway.validateAndSanitize(world, candidateId, speechAction, {
        phase: Phase.Day,
      });
      if (speechResult.ok && speechResult.sanitizedCall) {
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

async function collectWithdrawals(input: SheriffElectionInput, requests: GameActionRequestFactory, candidateSet: Set<EntityId>, initialCandidates: EntityId[]): Promise<EntityId[]> {
  const { world, events, toolGateway, actionProvider } = input;
  // 发言结束后统一进入退水阶段，再进入警长投票。
  const orderedCandidates = sortBySeat(world, [...candidateSet]);
  const withdrawRequests = orderedCandidates.map((candidateId) => ({
    candidateId,
    request: requests.create({
      phase: Phase.Day,
      actorId: candidateId,
      allowedTools: ["run_for_sheriff"],
      stage: "sheriff_withdraw",
      requiresAction: true,
      summary: "退水阶段必须明确是否继续竞选。",
      context: {
        sheriff_candidates: [...candidateSet],
      },
    }),
  }));
  const withdrawResults = await Promise.all(
    withdrawRequests.map(async ({ candidateId, request }) => {
      const withdrawAction = await actionProvider.getAction(request);
      if (withdrawAction?.name !== "run_for_sheriff") {
        return null;
      }
      const withdrawResult = toolGateway.validateAndSanitize(world, candidateId, withdrawAction, {
        phase: Phase.Day,
      });
      if (!withdrawResult.ok || !withdrawResult.sanitizedCall) {
        return null;
      }
      return {
        candidateId,
        keepRunning: withdrawResult.sanitizedCall.args.run === true,
      };
    }),
  );
  const withdrawn: EntityId[] = [];
  for (const item of withdrawResults) {
    if (!item || item.keepRunning) {
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

  if (candidateSet.size === 0) {
    for (const id of initialCandidates) {
      candidateSet.add(id);
    }
  }
  const finalizedCandidates = sortBySeat(world, [...candidateSet]);
  events.push({
    timestamp: Date.now(),
    type: "sheriff_candidates_finalized",
    payload: { candidates: finalizedCandidates },
  });
  return finalizedCandidates;
}

async function collectSheriffVotes(input: SheriffElectionInput, requests: GameActionRequestFactory, aliveIds: EntityId[], finalizedCandidates: EntityId[], candidateSet: Set<EntityId>): Promise<{ tally: Map<EntityId, number>; votes: SheriffVote[] }> {
  const { world, events, toolGateway, actionProvider } = input;
  const tally = new Map<EntityId, number>();
  for (const id of finalizedCandidates) {
    tally.set(id, 0);
  }

  // 规则：警长投票仅允许警下玩家（未在最终警上名单内）参与。
  const sheriffVoterIds = aliveIds.filter((id) => !candidateSet.has(id));
  // 警长投票同样并行收集，所有投票基于同一快照上下文。
  const sheriffVoteRequests = sheriffVoterIds.map((actorId) => ({
    actorId,
    request: requests.create({
      phase: Phase.Day,
      actorId,
      allowedTools: ["vote_for_sheriff"],
      stage: "sheriff_vote",
      requiresAction: true,
      summary: "警长投票阶段必须完成一次投票（可弃票）。",
      context: {
        sheriff_candidates: finalizedCandidates,
      },
    }),
  }));
  const sheriffVoteResults = await Promise.all(
    sheriffVoteRequests.map(async ({ actorId, request }) => {
      const action = await actionProvider.getAction(request);
      if (action?.name !== "vote_for_sheriff") {
        return null;
      }
      const result = toolGateway.validateAndSanitize(world, actorId, action, {
        phase: Phase.Day,
      });
      if (!result.ok || !result.sanitizedCall) {
        return null;
      }

      const abstain = result.sanitizedCall.args.abstain === true;
      let targetId = result.sanitizedCall.args.target_id;
      if (!abstain && (targetId === null || !finalizedCandidates.includes(targetId))) {
        targetId = finalizedCandidates[0];
      }
      return { actorId, targetId, abstain };
    }),
  );
  for (const item of sheriffVoteResults) {
    if (!item) {
      continue;
    }
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
  return { tally, votes: sheriffVoteResults.filter((item): item is SheriffVote => item !== null) };
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
    const identity = world.getComponent<IdentityComponent>(id, COMPONENT.Identity);
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
  if (withSeat.length >= 2 && withSeat[0].score === withSeat[1].score) {
    if (strategy === "no_elimination" || strategy === "no_kill") {
      return null;
    }
  }
  return withSeat[0]?.id ?? null;
}

function sortBySeat(world: World, ids: EntityId[]): EntityId[] {
  return [...ids].sort((a, b) => {
    const aSeat = world.getComponent<IdentityComponent>(a, COMPONENT.Identity)?.seat ?? a;
    const bSeat = world.getComponent<IdentityComponent>(b, COMPONENT.Identity)?.seat ?? b;
    return aSeat - bSeat;
  });
}
