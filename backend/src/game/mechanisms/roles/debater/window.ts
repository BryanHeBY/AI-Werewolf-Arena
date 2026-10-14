/**
 * 负责在原预定发言之前开启辩论机会，并通过本族权威结算公开发言、密封投票和处罚。
 * 输入为当前日次、原参与者、请求构造端口、Provider 与网关；输出辩论事实及是否跳过原发言。
 * Provider 等待之后仍复验原体、生命、库存与警徽；请求构造不授权行动，付款和关闭保持本族原顺序。
 * 本窗口不发布局部匿名票统计；最后复验后同步提交结果、生命绑定处罚和需要的警徽移交。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import {
  COMPONENT,
  Role,
  Camp,
  Phase,
  type World,
  type ActionProvider,
  type GameEvent,
  type BadgeComponent,
  type VotingRightComponent,
} from "../../../../core/domain";
import { ToolGateway } from "../../../gateway/tool_gateway";
import type { ActionRequestConstructionPort } from "../../../../core/domain/actions";
import { commitSheriffBadgeChoice, badgeSuccessorEligible } from "../../sheriff/badge";
import { getDebaterState, consumeDebaterChallenge, recordDebaterChoice } from "./state";
import {
  openDebate,
  closeDebate,
  hasDebateCommit,
  commitDebate,
  blockDebateVote,
  nextDebateId,
  hasActiveDebate,
  type DebateAuthority,
} from "./authority";
import {
  captureOriginalParticipant as captureDebateParticipant,
  sameOriginalParticipant as sameDebateParticipant,
} from "../../../../core/domain/original-participant";
/** 有限 AWA 适配：原一次预定发言之前依次进行两次公开陈述，再收集密封匿名票。 */
export class DebaterWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
    private readonly events: GameEvent[],
  ) {}
  async execute(
    config: ReadonlyBoardConfig,
    requests: ActionRequestConstructionPort,
    provider: ActionProvider,
    targetId: number,
    day: number,
    isCurrent: () => boolean,
  ): Promise<{ skipSpeech: boolean }> {
    if (hasActiveDebate(this.world)) throw new Error("debate_window_reentry");
    const empty = { skipSpeech: false };
    if (!isCurrent()) return empty;
    const actorId = this.world.getEntityIdsByRole(Role.Debater).find((id) => {
      const role = this.world.getComponent(id, COMPONENT.Role),
        state = getDebaterState(role);
      return (
        id !== targetId &&
        role?.camp === Camp.Good &&
        this.world.getAliveEntityIds().includes(id) &&
        state?.remaining === 1 &&
        state.choice === null &&
        !hasDebateCommit(this.world, id)
      );
    });
    if (actorId === undefined) return empty;
    let participants = new Map(
        this.world.getAliveEntityIds().flatMap((id) => {
          const p = captureDebateParticipant(this.world, id);
          return p ? [[id, p] as const] : [];
        }),
      ),
      actor = participants.get(actorId),
      target = participants.get(targetId);
    if (!actor || !target) return empty;
    const state = getDebaterState(actor.role)!,
      policy = state.policy;
    if (policy !== "awa_melbourne_2026_speech_gap_v1") return empty;
    const badgeSnapshot = (id: number) => {
      const badge = this.world.getComponent(id, COMPONENT.Badge),
        vote = this.world.getComponent(id, COMPONENT.VotingRight);
      return {
        id,
        badge,
        vote,
        isSheriff: badge?.isSheriff,
        destroyed: badge?.destroyed,
        weight: badge?.voteWeight,
        handoff: badge?.handoffPolicy,
        canVote: vote?.canVote,
        voteWeight: vote?.weight,
      };
    };
    const badges = [badgeSnapshot(actorId), badgeSnapshot(targetId)];
    const sameBadges = () =>
      badges.every(
        (b) =>
          this.world.getComponent(b.id, COMPONENT.Badge) === b.badge &&
          this.world.getComponent(b.id, COMPONENT.VotingRight) === b.vote &&
          b.badge?.isSheriff === b.isSheriff &&
          b.badge?.destroyed === b.destroyed &&
          b.badge?.voteWeight === b.weight &&
          b.badge?.handoffPolicy === b.handoff &&
          b.vote?.canVote === b.canVote &&
          b.vote?.weight === b.voteWeight,
      );
    const authority: DebateAuthority = {
      id: nextDebateId(this.world, day, actorId, targetId),
      day,
      actorId,
      targetId,
      stage: "challenge",
      participants,
    };
    // accepted 仅在两字段写完后置真；choice 保原对象身份，供等待后的状态复验。
    let accepted = false,
      choice: typeof state.choice = null;
    const current = () =>
      isCurrent() &&
      sameDebateParticipant(this.world, actor) &&
      sameDebateParticipant(this.world, target) &&
      getDebaterState(actor.role) === state &&
      state.policy === policy &&
      state.remaining === (accepted ? 0 : 1) &&
      state.choice === choice &&
      (choice === null || (choice.day === day && choice.targetId === targetId)) &&
      hasDebateCommit(this.world, actorId) === accepted &&
      sameBadges();
    const extras = {
      debate_id: authority.id,
      debate_actor_id: actorId,
      debate_target_id: targetId,
      allow_fallback: false,
    };
    const canceled = () => {
      if (isCurrent())
        this.events.push({
          timestamp: Date.now(),
          type: "debate_canceled",
          payload: { actorId, targetId, day, reason: "scope_changed" },
        });
      return empty;
    };
    openDebate(this.world, authority);
    try {
      const request = requests.create({
        actorId,
        phase: Phase.Day,
        allowedTools: ["challenge"],
        stage: "debate_challenge",
        requiresAction: false,
        summary: { key: "request.summary.debate_challenge", parameters: { target: targetId } },
        context: extras,
      });
      if (!current()) return empty;
      const action = await provider.getAction(request);
      if (!current() || action?.name !== "challenge") return empty;
      const checked = this.gateway.validateAndSanitize(this.world, actorId, action, {
        phase: Phase.Day,
        day,
        debateId: authority.id,
      });
      if (!checked.ok || !current()) return empty;
      participants = new Map(
        this.world.getAliveEntityIds().flatMap((id) => {
          const p = captureDebateParticipant(this.world, id);
          return p ? [[id, p] as const] : [];
        }),
      );
      authority.participants = participants;
      // 提交账本先于库存；局部 choice 在保存槽之前创建，setter 失败时不回滚这些前缀。
      commitDebate(this.world, actorId);
      consumeDebaterChallenge(state);
      choice = { day, targetId };
      recordDebaterChoice(state, choice);
      accepted = true;
      this.events.push(
        { timestamp: Date.now(), type: "debater_revealed", payload: { actorId, day } },
        { timestamp: Date.now(), type: "debate_started", payload: { actorId, targetId, day } },
      );
      authority.stage = "speech";
      for (const speaker of [actorId, targetId]) {
        if (!current()) return canceled();
        const speechRequest = requests.create({
          actorId: speaker,
          phase: Phase.Day,
          allowedTools: ["speak"],
          stage: "debate_speech",
          requiresAction: true,
          summary: { key: "request.summary.debate_speech" },
          context: extras,
        });
        if (!current()) return canceled();
        const speech = await provider.getAction(speechRequest);
        if (!current()) return canceled();
        if (speech?.name !== "speak") continue;
        const valid = this.gateway.validateAndSanitize(this.world, speaker, speech, {
          phase: Phase.Day,
          day,
        });
        if (!current()) return canceled();
        if (valid.ok && valid.sanitizedCall?.name === "speak")
          this.events.push({
            timestamp: Date.now(),
            type: "debate_speech",
            payload: { actorId: speaker, text: valid.sanitizedCall.args.text },
          });
      }
      authority.stage = "ballot";
      // 调用任何 Provider 之前构造完整票轮；中间统计或单人票不会提前发布。
      const ballotRequests = [...participants.keys()].map((voterId) => ({
        voterId,
        request: requests.create({
          actorId: voterId,
          phase: Phase.Day,
          allowedTools: ["debate_vote"],
          stage: "debate_ballot",
          requiresAction: true,
          summary: { key: "request.summary.debate_ballot" },
          context: extras,
        }),
      }));
      if (!current()) return canceled();
      const replies = await Promise.all(
        ballotRequests.map(async ({ voterId, request }) => ({
          voterId,
          call:
            current() && sameDebateParticipant(this.world, participants.get(voterId)!)
              ? await provider.getAction(request)
              : null,
        })),
      );
      if (!current()) return canceled();
      const ballots = replies.map(({ voterId, call }) => {
        const p = participants.get(voterId)!;
        if (!sameDebateParticipant(this.world, p) || call?.name !== "debate_vote")
          return { voterId, support: null };
        const checked = this.gateway.validateAndSanitize(this.world, voterId, call, {
          phase: Phase.Day,
          day,
          debateId: authority.id,
        });
        return {
          voterId,
          support:
            checked.ok &&
            checked.sanitizedCall?.name === "debate_vote" &&
            sameDebateParticipant(this.world, p)
              ? checked.sanitizedCall.args.support
              : null,
        };
      });
      if (!current()) return canceled();
      // 已收票再次逐人复验，另一位玩家的校验可能撤销其原体资格。
      for (const ballot of ballots)
        if (!sameDebateParticipant(this.world, participants.get(ballot.voterId)!))
          ballot.support = null;
      const eligibleCount = participants.size,
        supports = ballots.filter((b) => b.support === true).length,
        rejects = ballots.filter((b) => b.support === false).length,
        abstentions = eligibleCount - supports - rejects,
        success = supports > eligibleCount / 2,
        blockedId = success ? targetId : actorId;
      const targetBadge = this.world.getComponent(targetId, COMPONENT.Badge),
        needsBadge = success && targetBadge?.isSheriff === true && !targetBadge.destroyed;
      if (needsBadge && !badgeSuccessorEligible(this.world, targetId, actorId)) return canceled();
      if (!current()) return canceled();
      // 最后复验之后同步提交结果、绑定原生命的处罚以及需要的警徽移交。
      if (needsBadge)
        commitSheriffBadgeChoice(this.world, targetId, "debate", this.events, actorId);
      blockDebateVote(this.world, blockedId, actorId, day);
      this.events.push(
        {
          timestamp: Date.now(),
          type: "debate_ballots_recorded",
          payload: { actorId, targetId, day, eligibleCount, ballots },
        },
        {
          timestamp: Date.now(),
          type: "debate_resolved",
          payload: {
            actorId,
            targetId,
            day,
            eligibleCount,
            supports,
            rejects,
            abstentions,
            success,
            blockedId,
          },
        },
      );
      return { skipSpeech: success };
    } finally {
      closeDebate(this.world, authority);
    }
  }
}
