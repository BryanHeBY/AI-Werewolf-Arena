/**
 * 负责单个动物放逐单元的唯一已接受票账本、首轮 PK 计票和最终轮次标记。
 * 输入为接受票流程已复核的整轮票；写入时冻结原数组，输出原轮次引用、平票编号与 God 票记录投影。
 * 原玩家、生命和票权对象仍按原引用保存；本数据 owner 不签发单元、许可或资源付款。
 * 封票只写 finalRound，后续政策或库存读取失败不会回滚该标记；不是通用投票器或档案解码器。
 */
import type { AnimalOriginalPlayer } from "./roster";

/** 票据持有原玩家与原 VotingRight 引用；readonly 是类型约束，不深冻结这些运行对象。 */
export interface AcceptedBallot {
  readonly voter: AnimalOriginalPlayer;
  readonly target: AnimalOriginalPlayer | null;
  readonly abstain: boolean;
  readonly weight: number;
  readonly voting: object;
}

export class AnimalBallotLedger {
  readonly #rounds = new Map<1 | 2, readonly AcceptedBallot[]>();
  #finalRound: 1 | 2 | null = null;

  get size(): number {
    return this.#rounds.size;
  }
  get finalRound(): 1 | 2 | null {
    return this.#finalRound;
  }
  round(round: 1 | 2): readonly AcceptedBallot[] | undefined {
    return this.#rounds.get(round);
  }

  /** 仅在最后外部 guard 和全部原体／票权复验成功后调用；保持原数组冻结时点。 */
  accept(round: 1 | 2, accepted: AcceptedBallot[]): void {
    this.#rounds.set(round, Object.freeze(accepted));
  }
  seal(): void {
    this.#finalRound = this.#rounds.size === 2 ? 2 : 1;
  }
  pkCandidates(): number[] {
    const tally = new Map<number, number>();
    for (const vote of this.#rounds.get(1) ?? []) {
      if (!vote.abstain && vote.target)
        tally.set(vote.target.scope.id, (tally.get(vote.target.scope.id) ?? 0) + vote.weight);
    }
    const max = Math.max(0, ...tally.values()),
      tied = [...tally]
        .filter(([, weight]) => weight === max)
        .map(([id]) => id)
        .sort((a, b) => a - b);
    return tied.length > 1 ? tied : [];
  }

  /** 只在原 authority 快照的 ballots 字段点读取；不提前投影票据中的活对象字段。 */
  snapshotVotes() {
    return [...this.#rounds].map(([round, votes]) => ({
      round,
      votes: votes.map((v) => ({
        actorId: v.voter.scope.id,
        targetId: v.target?.scope.id ?? null,
        abstain: v.abstain,
        weight: v.weight,
      })),
    }));
  }
}
