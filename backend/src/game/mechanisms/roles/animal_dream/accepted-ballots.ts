/**
 * 负责动物放逐整轮接受票的校验、原体／票权复验与首轮或最终轮封票选择。
 * 输入为可信 VotingPipeline 的全体选民票和 PK 候选；输出写入单元唯一账本并交原 authority 建立河豚租约。
 * 首次单元 guard 前快照两份输入，最后 guard 后保持原重复票权读取；撤权先停止原 owner 再抛错。
 * 封票先记最终轮、后读政策和库存；接受票或租约均不等于付款，生命／关闭写权仍归原 authority。
 */
import type { World } from "../../../../core/domain/world";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { COMPONENT } from "../../../../core/domain/components/names";
import { animalOriginalPlayer, animalRosterPolicies } from "./roster";
import { descriptor } from "./state-slot";
import type { AcceptedBallot } from "./ballot-ledger";
import {
  animalAcceptedBallotUnit,
  assertAnimalAcceptedBallotScope,
  stopAnimalAcceptedBallotUnit,
  installAnimalPufferBallotChoice,
} from "./authority";

function votingState(
  world: World,
  id: number,
): { value: object; canVote: boolean; weight: number } | null {
  const value = world.getComponent(id, COMPONENT.VotingRight),
    canVote = descriptor(value, "canVote")?.value,
    weight = descriptor(value, "weight")?.value;
  return value && typeof canVote === "boolean" && (weight === 1 || weight === 1.5)
    ? { value, canVote, weight }
    : null;
}
function eligibleAnimalVoters(world: World, candidates: readonly number[]): number[] | null {
  const ids: number[] = [];
  for (const id of world.entityIds()) {
    if (!animalOriginalPlayer(world, id)) continue;
    const voting = votingState(world, id);
    if (!voting) return null;
    if (voting.canVote && !candidates.includes(id)) ids.push(id);
  }
  return ids;
}
/** 可信 VotingPipeline 在实际接收边界记录整轮已接受票，包括弃票；不接收模型给出的目标子集。 */
export function recordAnimalBallotRound(
  world: World,
  token: object,
  round: 1 | 2,
  rawVotes: readonly {
    actorId: number;
    targetId: number | null;
    abstain: boolean;
    weight: number;
  }[],
  rawPkCandidates: readonly number[] = [],
): void {
  // 首次调用外部单元 guard 之前先捕获已接受输入，保留原样本而非回调修改后的值。
  const votes = snapshotPlainData(rawVotes) as typeof rawVotes,
    candidates = snapshotPlainData(rawPkCandidates) as number[];
  const { owner, unit } = animalAcceptedBallotUnit(world, token);
  if (
    unit.value.kind !== "exile" ||
    unit.ballots.finalRound !== null ||
    round !== unit.ballots.size + 1 ||
    (round !== 1 && round !== 2)
  )
    throw Error("animal_ballot_round_unavailable");
  if (
    !Array.isArray(votes) ||
    !Array.isArray(candidates) ||
    new Set(candidates).size !== candidates.length ||
    (round === 1 ? candidates.length !== 0 : candidates.length < 2) ||
    candidates.some((id) => !animalOriginalPlayer(world, id))
  )
    throw Error("animal_ballot_round_invalid");
  if (
    round === 2 &&
    JSON.stringify([...candidates].sort((a, b) => a - b)) !== JSON.stringify(unit.ballots.pkCandidates())
  )
    throw Error("animal_ballot_round_invalid");
  const expected = eligibleAnimalVoters(world, candidates);
  if (!expected) throw Error("animal_ballot_round_invalid");
  if (
    votes.length !== expected.length ||
    new Set(votes.map((v) => v.actorId)).size !== votes.length
  )
    throw Error("animal_ballot_round_invalid");
  const accepted: AcceptedBallot[] = votes.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).length !== 4 ||
      Object.keys(v).some((key) => !["actorId", "targetId", "abstain", "weight"].includes(key))
    )
      throw Error("animal_ballot_round_invalid");
    const voter = animalOriginalPlayer(world, v.actorId),
      voting = votingState(world, v.actorId),
      target = v.targetId === null ? null : animalOriginalPlayer(world, v.targetId, !v.abstain);
    if (
      !voter ||
      !voting?.canVote ||
      !expected.includes(v.actorId) ||
      typeof v.abstain !== "boolean" ||
      (v.targetId !== null && (!Number.isSafeInteger(v.targetId) || v.targetId < 1)) ||
      v.weight !== (v.abstain ? 0 : voting.weight) ||
      (!v.abstain && (!target || (round === 2 && !candidates.includes(v.targetId!))))
    )
      throw Error("animal_ballot_round_invalid");
    return Object.freeze({
      voter,
      target,
      abstain: v.abstain,
      weight: v.weight,
      voting: voting.value,
    });
  });
  // 最后 guard 之后只做数据检查，再安装回执；不插入新的外部回调使旧样本迟到失效。
  assertAnimalAcceptedBallotScope(world, owner, unit.current);
  if (
    JSON.stringify(eligibleAnimalVoters(world, candidates)) !== JSON.stringify(expected) ||
    accepted.some(
      (v) =>
        animalOriginalPlayer(world, v.voter.scope.id) !== v.voter ||
        (!v.abstain && animalOriginalPlayer(world, v.target!.scope.id) !== v.target) ||
        votingState(world, v.voter.scope.id)?.value !== v.voting ||
        votingState(world, v.voter.scope.id)?.canVote !== true ||
        (!v.abstain && votingState(world, v.voter.scope.id)?.weight !== v.weight),
    )
  ) {
    stopAnimalAcceptedBallotUnit(owner);
    throw Error("animal_ballot_round_revoked");
  }
  unit.ballots.accept(round, accepted);
}
/** finalRound 写入先于政策与资源读取；该封票提交不授予河豚行动或死亡许可。 */
export function sealAnimalBallots(world: World, token: object): void {
  const { owner, unit } = animalAcceptedBallotUnit(world, token);
  if (unit.value.kind !== "exile" || unit.ballots.finalRound !== null || !unit.ballots.size)
    throw Error("animal_ballot_round_unavailable");
  if (unit.ballots.size === 1 && unit.ballots.pkCandidates().length) throw Error("animal_ballot_pk_required");
  unit.ballots.seal();
  const policy = animalRosterPolicies(world)!.ballotPolicy,
    selected = unit.ballots.round(policy === "awa_first_ballot_v1" ? 1 : unit.ballots.finalRound!)!;
  installAnimalPufferBallotChoice(world, owner, unit, selected);
}
