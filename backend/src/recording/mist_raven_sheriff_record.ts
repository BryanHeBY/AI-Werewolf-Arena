/**
 * 负责独立审核雾鸦警长选举、退水和逐轮票型。输入为归档配置、决定、事实与 checkpoint；
 * 输出为原一致性结果或明确拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { Phase } from "@ai-werewolf-arena/game-contract";
import type { RecordedGameEvent, ReproductionRecord } from "./reproduction";
import { check, equal } from "./mist_raven_requests";

/** This finite board's election evidence; it never shares the exile/knife tally. */
export function createMistSheriffEvidence(record: ReproductionRecord) {
  let nominated = false,
    withdrawn = false,
    initial: number[] = [],
    candidates: number[] = [],
    round = 1,
    winner: number | null = null,
    leaders: number[] = [];
  const declarations: number[] = [],
    withdrawals: number[] = [],
    ballots: Array<{ actorId: number; targetId: number | null; abstain: boolean }> = [];
  const rows = (stage: string, actor?: number) =>
    record.decisions.filter(
      (d) => d.day === 1 && d.stage === stage && (actor === undefined || d.actorId === actor),
    );
  const response = (stage: string, actor: number) => {
    const list = rows(stage, actor);
    check(list.length === 1);
    const d = list[0]!;
    check(
      d.request.phase === Phase.Day && d.outcome.kind === "action" && d.settleOrder !== undefined,
    );
    return d.outcome.action;
  };
  const nomination = (stage: string, actor: number) => {
    const a = response(stage, actor);
    return a?.name === "run_for_sheriff" && typeof a.args.run === "boolean" ? a.args.run : null;
  };
  const ballot = (actor: number) => {
    const stage = round === 1 ? "sheriff_vote" : "sheriff_pk_vote",
      a = response(stage, actor),
      d = rows(stage, actor)[0]!;
    check(
      equal(d.request.allowedTools, ["vote_for_sheriff"]) &&
        equal(d.request.context.sheriff_candidates, candidates),
    );
    if (round === 2) check(d.request.context.round === 2 && d.request.context.max_rounds === 2);
    if (a?.name !== "vote_for_sheriff") return null;
    const { target_id: target, abstain } = a.args;
    return typeof abstain === "boolean" &&
      (target === null ||
        (typeof target === "number" && Number.isSafeInteger(target) && target > 0)) &&
      (abstain ? target === null : target !== null && candidates.includes(target))
      ? { actorId: actor, targetId: target, abstain }
      : null;
  };
  return {
    get winner() {
      return winner;
    },
    accept(
      event: RecordedGameEvent,
      context: {
        day: number;
        phase: Phase;
        alive: ReadonlySet<number>;
        idiot: number;
        idiotRevealed: boolean;
      },
    ) {
      const { day, phase, alive, idiot, idiotRevealed } = context,
        p = event.payload;
      const eligible = [...alive]
        .filter((id) => id !== idiot || !idiotRevealed)
        .sort((a, b) => a - b);
      const electionEvents = [
        "sheriff_candidate_declared",
        "sheriff_nomination_summary",
        "sheriff_withdraw_summary",
        "sheriff_candidates_finalized",
        "sheriff_vote_cast",
        "sheriff_vote_summary",
        "sheriff_pk_started",
      ];
      if (!electionEvents.includes(event.type)) return;
      check(day === 1 && phase === Phase.Day);
      if (event.type === "sheriff_candidate_declared") {
        check(typeof p.actorId === "number" && eligible.includes(p.actorId));
        const selected = nomination(
          nominated ? "sheriff_withdraw" : "sheriff_nomination",
          p.actorId,
        );
        check(selected !== null && p.run === selected);
        if (!nominated) {
          check(!declarations.includes(p.actorId));
          declarations.push(p.actorId);
        } else {
          check(
            !withdrawn &&
              initial.includes(p.actorId) &&
              p.run === false &&
              !withdrawals.includes(p.actorId),
          );
          withdrawals.push(p.actorId);
        }
      }
      if (event.type === "sheriff_nomination_summary") {
        check(
          !nominated &&
            equal(
              rows("sheriff_nomination")
                .map((d) => d.actorId)
                .sort((a, b) => a - b),
              eligible,
            ),
        );
        const expected = eligible.filter((id) => nomination("sheriff_nomination", id) === true);
        check(
          equal(p.candidates, expected) &&
            equal(
              declarations,
              eligible.filter((id) => nomination("sheriff_nomination", id) !== null),
            ),
        );
        initial = expected;
        candidates = [...expected];
        nominated = true;
      }
      if (event.type === "sheriff_withdraw_summary") {
        check(
          nominated &&
            !withdrawn &&
            equal(
              rows("sheriff_withdraw")
                .map((d) => d.actorId)
                .sort((a, b) => a - b),
              initial,
            ),
        );
        const expected = initial.filter((id) => nomination("sheriff_withdraw", id) === false);
        check(equal(p.withdrawn, expected) && equal(withdrawals, expected));
        candidates = initial.filter((id) => !expected.includes(id));
        withdrawn = true;
      }
      if (event.type === "sheriff_candidates_finalized")
        check(withdrawn && equal(p.candidates, candidates));
      if (event.type === "sheriff_vote_cast") {
        check(
          withdrawn &&
            typeof p.actorId === "number" &&
            eligible.includes(p.actorId) &&
            !(round === 1 ? initial : candidates).includes(p.actorId) &&
            ballots.every((v) => v.actorId !== p.actorId),
        );
        const expected = ballot(p.actorId);
        check(expected && equal(p, expected));
        ballots.push(expected);
      }
      if (event.type === "sheriff_vote_summary") {
        check(withdrawn && (p.round ?? 1) === round);
        const voters =
          candidates.length === 0 || (round === 1 && candidates.length === 1)
            ? []
            : eligible.filter((id) => !(round === 1 ? initial : candidates).includes(id));
        check(
          equal(
            rows(round === 1 ? "sheriff_vote" : "sheriff_pk_vote")
              .map((d) => d.actorId)
              .sort((a, b) => a - b),
            voters,
          ),
        );
        const expected = voters.map(ballot).filter((v): v is NonNullable<typeof v> => v !== null);
        check(equal(ballots, expected) && equal(p.votes, expected));
        const counts = new Map(candidates.map((id) => [id, 0]));
        for (const v of expected)
          if (!v.abstain && v.targetId !== null)
            counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);
        const max = Math.max(0, ...counts.values());
        leaders = max > 0 ? [...counts].filter(([, n]) => n === max).map(([id]) => id) : [];
        winner =
          round === 1 && candidates.length === 1
            ? candidates[0]!
            : leaders.length === 1
              ? leaders[0]!
              : null;
        check(p.winnerId === winner);
      }
      if (event.type === "sheriff_pk_started") {
        check(round === 1 && leaders.length > 1 && winner === null && equal(p.candidates, leaders));
        candidates = [...leaders];
        round = 2;
        ballots.length = 0;
      }
    },
  };
}
