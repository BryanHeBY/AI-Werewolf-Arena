/**
 * 负责乌鸦严格归档的独立验算，输入为纯配置、决定、事实与检查点，输出接受或明确因果错误。
 * 独立重建夜选、原始票表、附加一票、PK、存活及历史前缀，禁止导入生产窗口/计票作oracle。
 * 已知返回候选约束失败前缀的目标，普通回放与声明数据不作为付款授权，校验不写运行资源。
 */
import { Camp, Phase, Role, readCrowFact, type CrowConfig } from "@ai-werewolf-arena/game-contract";
import type { ReproductionRecord } from "../../reproduction/format";
function check(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_crow_invalid");
}
function equal(a: unknown, b: unknown): boolean {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
/** 同牌序独立比较多重集，有限板限制不借用运行 support 谓词。 */
function boardValid(record: ReproductionRecord): CrowConfig {
  const b = record.metadata.normalizedBoard,
    c = b.crow;
  check(
    b.boardSize === 12 &&
      b.roleSetups.length === 6 &&
      equal(Object.fromEntries(b.roleSetups.map((r) => [r.role, r.count])), {
        wolf: 4,
        villager: 4,
        seer: 1,
        witch: 1,
        hunter: 1,
        crow: 1,
      }),
  );
  check(
    equal(b.winConditions ?? [b.winCondition], ["slaughter_side"]) &&
      (b.winCondition === undefined || b.winCondition === "slaughter_side") &&
      b.voting?.exilePolicy === "awa_one_pk_v1",
  );
  check(
    c?.policy === "awa_netease_crow_v1" &&
      ["initial_ballot_only", "all_ballots"].includes(c.ballotPolicy) &&
      ["optional", "required_when_legal"].includes(c.actionPolicy) &&
      typeof c.selfTarget === "boolean",
  );
  const allowed = new Set([
    "boardSize",
    "enableSheriff",
    "initialSheriffSeat",
    "winConditions",
    "winCondition",
    "hooks",
    "selfDestruct",
    "sheriff",
    "witch",
    "seer",
    "hunter",
    "tieBreaker",
    "voting",
    "disclosure",
    "lastWords",
    "roleSetups",
    "crow",
  ]);
  check(Object.keys(b).every((k) => allowed.has(k)));
  return c;
}
export function validateCrowRecord(record: ReproductionRecord): void {
  const b = record.metadata.normalizedBoard;
  const owns = b.roleSetups.some((r) => r.role === Role.Crow && r.count > 0);
  const artifacts =
    record.events.some((e) => e.type.startsWith("crow_")) ||
    record.decisions.some(
      (d) => d.stage === "crow_curse" || d.request.allowedTools.includes("curse_exile"),
    ) ||
    record.checkpoints.some((c) => c.players.some((p) => Object.hasOwn(p.privateState, "crow")));
  if (!owns) {
    check(!b.crow && !artifacts && !record.metadata.players.some((p) => p.role === Role.Crow));
    return;
  }
  const config = boardValid(record),
    actors = record.metadata.players.filter((p) => p.role === Role.Crow);
  check(actors.length === 1 && actors[0]!.camp === Camp.Good);
  const actor = actors[0]!.id,
    alive = new Set(record.metadata.players.map((p) => p.id));
  check(alive.size === 12);
  let day = 1,
    phase: string = Phase.Night,
    round: 1 | 2 = 1,
    candidates: number[] | undefined,
    sheriff: number | null = b.initialSheriffSeat ?? null;
  const history: Array<{ day: number; targetId: number | null }> = [],
    prefixes: Array<typeof history> = [[]];
  const bonuses = new Set<string>(),
    expectedChoices = new Map<number, number | null>();
  let ballotVotes: Array<{
    actorId: number;
    targetId: number | null;
    abstain: boolean;
    weight: number;
  }> = [];
  const livingPrefixes: number[][] = [[...alive]],
    expectedBallot: Record<number, number> = {};
  for (const [index, e] of record.events.entries()) {
    const p = e.payload;
    if (e.type === "phase_changed") {
      day = p.day as number;
      phase = p.phase as string;
      if (phase === Phase.Voting) {
        round = 1;
        candidates = undefined;
        ballotVotes = [];
        for (const k of Object.keys(expectedBallot)) delete expectedBallot[Number(k)];
      }
    }
    if (e.type === "crow_curse_chosen") {
      const f = readCrowFact(e.type, p);
      check(
        f &&
          "actorId" in f &&
          phase === Phase.Night &&
          f.day === day &&
          f.actorId === actor &&
          alive.has(actor),
      );
      check(e.audience?.length === 1 && e.audience[0] === actor && !expectedChoices.has(day));
      const last = history.at(-1),
        target = f.targetId;
      const legal = [...alive].filter(
        (id) =>
          (config.selfTarget || id !== actor) && !(last?.day === day - 1 && last.targetId === id),
      );
      check(
        target === null
          ? config.actionPolicy === "optional" || legal.length === 0
          : legal.includes(target),
      );
      const decisions = record.decisions.filter(
        (d) => d.actorId === actor && d.day === day && d.stage === "crow_curse",
      );
      check(decisions.length === 1);
      const d = decisions[0]!;
      check(
        d.request.actorId === actor &&
          d.request.phase === Phase.Night &&
          d.request.context.day === day &&
          d.request.context.stage === "crow_curse" &&
          equal(d.request.allowedTools, ["curse_exile"]) &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.allow_fallback === false &&
          equal(d.request.context.crow_candidates, legal),
      );
      const action = d.outcome.kind === "action" ? d.outcome.action : d.returnedCandidate;
      check(action?.name === "curse_exile" && equal(action.args, { target_id: target }));
      expectedChoices.set(day, target);
      history.push({ day, targetId: target });
    }
    if (e.type === "sheriff_vote_summary") sheriff = p.winnerId as number | null;
    if (e.type === "sheriff_badge_transferred") sheriff = p.toId as number;
    if (e.type === "sheriff_badge_destroyed") sheriff = null;
    if (e.type === "vote_cast") {
      check(
        phase === Phase.Voting &&
          alive.has(p.actorId as number) &&
          !candidates?.includes(p.actorId as number),
      );
      check(!ballotVotes.some((v) => v.actorId === p.actorId));
      const v = p as unknown as (typeof ballotVotes)[number];
      check(
        typeof v.abstain === "boolean" &&
          (v.abstain
            ? v.targetId === null && v.weight === 0
            : v.targetId !== null &&
              v.targetId !== v.actorId &&
              alive.has(v.targetId) &&
              (!candidates || candidates.includes(v.targetId)) &&
              v.weight === (sheriff === v.actorId ? (b.sheriff?.voteWeight ?? 1.5) : 1)),
      );
      const ds = record.decisions.filter(
        (d) =>
          d.actorId === v.actorId &&
          d.day === day &&
          d.stage === (round === 1 ? "voting" : "exile_pk_vote"),
      );
      const matching = ds.find((d) => {
        const action = d.outcome.kind === "action" ? d.outcome.action : d.returnedCandidate;
        return (
          action?.name === "vote" &&
          action.args.target_id === v.targetId &&
          action.args.abstain === v.abstain
        );
      });
      // fallback标签不能凭空制造票。普通流水线只有四次未获有效票后才修复为明确弃票。
      check(
        matching ||
          (p.fallback === true &&
            v.abstain &&
            v.targetId === null &&
            v.weight === 0 &&
            ds.length === 4 &&
            ds.every(
              (d) =>
                d.request.actorId === v.actorId &&
                d.request.phase === Phase.Voting &&
                d.request.context.day === day &&
                d.request.context.stage === d.stage &&
                d.outcome.kind === "action",
            )),
      );
      ballotVotes.push({
        actorId: v.actorId,
        targetId: v.targetId,
        abstain: v.abstain,
        weight: v.weight,
      });
      if (!v.abstain && v.targetId !== null)
        expectedBallot[v.targetId] = (expectedBallot[v.targetId] ?? 0) + v.weight;
    }
    if (e.type === "crow_curse_applied") {
      const f = readCrowFact(e.type, p),
        target = expectedChoices.get(day),
        key = `${day}:${round}`;
      check(
        f &&
          !("actorId" in f) &&
          phase === Phase.Voting &&
          f.day === day &&
          f.round === round &&
          target !== null &&
          target !== undefined &&
          f.targetId === target &&
          alive.has(target) &&
          (!candidates || candidates.includes(target)) &&
          (round === 1 || config.ballotPolicy === "all_ballots") &&
          !bonuses.has(key) &&
          e.audience === undefined,
      );
      bonuses.add(key);
      expectedBallot[target] = (expectedBallot[target] ?? 0) + 1;
    }
    if (e.type === "vote_summary") {
      const key = `${day}:${round}`,
        target = expectedChoices.get(day),
        should =
          target !== null &&
          target !== undefined &&
          alive.has(target) &&
          (!candidates || candidates.includes(target)) &&
          (round === 1 || config.ballotPolicy === "all_ballots");
      check(
        phase === Phase.Voting &&
          bonuses.has(key) === should &&
          equal(p.tally, expectedBallot) &&
          equal(p.votes, ballotVotes),
      );
      check(
        equal(
          ballotVotes.map((v) => v.actorId).sort((a, b) => a - b),
          [...alive].filter((id) => !candidates?.includes(id)).sort((a, b) => a - b),
        ),
      );
      const maximum = Math.max(0, ...Object.values(expectedBallot)),
        top = Object.entries(expectedBallot)
          .filter(([, n]) => n === maximum)
          .map(([id]) => Number(id));
      check(p.target === (top.length === 1 ? top[0] : null));
    }
    if (e.type === "exile_pk_started") {
      const maximum = Math.max(0, ...Object.values(expectedBallot)),
        top = Object.entries(expectedBallot)
          .filter(([, n]) => n === maximum)
          .map(([id]) => Number(id));
      check(
        round === 1 &&
          top.length > 1 &&
          equal(
            [...(p.candidates as number[])].sort((a, b) => a - b),
            top.sort((a, b) => a - b),
          ),
      );
      round = 2;
      candidates = [...top];
      ballotVotes = [];
      for (const k of Object.keys(expectedBallot)) delete expectedBallot[Number(k)];
    }
    if (["night_resolved", "additional_deaths"].includes(e.type))
      for (const id of p.deaths as number[]) alive.delete(id);
    if (e.type === "voted_out") alive.delete(p.target as number);
    if (e.type === "wolf_self_destruct") alive.delete(p.wolfId as number);
    if (["hunter_shot", "player_shot", "wolf_king_shot"].includes(e.type))
      alive.delete(p.targetId as number);
    // 每个事件边界保存独立前缀，checkpoint 不能用最终历史覆盖较早状态。
    prefixes[index + 1] = history.map((h) => ({ ...h }));
    livingPrefixes[index + 1] = [...alive];
  }
  for (const c of record.checkpoints) {
    const p = c.players.find((p) => p.id === actor);
    check(p && p.role === Role.Crow && p.camp === Camp.Good);
    const state = p.privateState.crow as { history: typeof history } & CrowConfig;
    check(
      state &&
        state.policy === config.policy &&
        state.ballotPolicy === config.ballotPolicy &&
        state.actionPolicy === config.actionPolicy &&
        state.selfTarget === config.selfTarget,
    );
    const expected = prefixes[c.eventCount];
    check(expected);
    if (c.complete) check(equal(state.history, expected));
    else if (!equal(state.history, expected)) {
      check(
        state.history.length === expected.length + 1 && equal(state.history.slice(0, -1), expected),
      );
      const last = state.history.at(-1)!;
      const ds = record.decisions.filter(
        (d) => d.actorId === actor && d.day === last.day && d.stage === "crow_curse",
      );
      check(ds.length === 1);
      const d = ds[0]!;
      const action = d.outcome.kind === "action" ? d.outcome.action : d.returnedCandidate;
      check(
        action?.name === "curse_exile" &&
          equal(action.args, { target_id: last.targetId }) &&
          d.request.context.day === last.day &&
          d.request.context.stage === "crow_curse" &&
          d.request.actorId === actor &&
          d.request.phase === Phase.Night &&
          equal(d.request.allowedTools, ["curse_exile"]) &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.allow_fallback === false,
      );
      const living = livingPrefixes[d.openedAtEventCount ?? c.eventCount]!;
      const previous = expected.at(-1),
        legal = living.filter(
          (id) =>
            (config.selfTarget || id !== actor) &&
            !(previous?.day === last.day - 1 && previous.targetId === id),
        );
      check(
        living.includes(actor) &&
          equal(d.request.context.crow_candidates, legal) &&
          (last.targetId === null
            ? config.actionPolicy === "optional" || legal.length === 0
            : legal.includes(last.targetId)),
      );
    }
    check(
      equal(
        c.players
          .filter((p) => p.alive)
          .map((p) => p.id)
          .sort((a, b) => a - b),
        livingPrefixes[c.eventCount]!.sort((a, b) => a - b),
      ),
    );
  }
}
