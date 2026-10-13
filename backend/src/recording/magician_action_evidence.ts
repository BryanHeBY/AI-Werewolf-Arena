/**
 * 负责独立核对魔术师映射后的行动与死亡证据。输入为归档请求、决定、事件和来源；
 * 输出为原有工具／目标／死因一致性结果，不采用生产目标映射或死亡资格算法作为预期。
 * 稳定枚举来自中立契约，本模块不加载 World／结算器，不持有资源或 checkpoint 写权限。
 * 原封锁、重试、弃枪与已付失败前缀按既有纯数据程序校验，不改变记录接受集合。
 */
import { DeathCause, Phase, Role } from "@ai-werewolf-arena/game-contract";
import type { RecordedDecision, ReproductionRecord } from "./reproduction";

function check(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_magician_state_invalid");
}
function top(votes: ReadonlyMap<number, number>): number[] {
  const maximum = Math.max(0, ...votes.values());
  return [...votes]
    .filter(([, weight]) => weight === maximum)
    .map(([id]) => id)
    .sort((a, b) => a - b);
}

/** 独立审核有限原生枪的行动证据；请求局部事件本身不是权威依据。 */
export function inferMagicianGunSources(
  record: ReproductionRecord,
  request: RecordedDecision,
  nightLiving: readonly number[],
): { origin: Phase; sources: readonly DeathCause[] } | undefined {
  const day = request.day,
    cutoff = request.openedAfterSettlement;
  const previous = record.checkpoints.find((cp) => cp.cycle === day - 1 && cp.complete);
  check(previous);
  const original = new Map(record.metadata.players.map((p) => [p.id, p.role]));
  const before = record.decisions.filter(
    (d) =>
      d.day === day &&
      d.outcome.kind !== "pending" &&
      typeof d.settleOrder === "number" &&
      d.settleOrder > d.openedAfterSettlement &&
      d.settleOrder <= cutoff,
  );
  const action = (d: RecordedDecision) => (d.outcome.kind === "action" ? d.outcome.action : null);
  const pair = (
    role: Role,
    stage: string,
    tool: "swap_targets" | "swap_night_seats" | "swap_exile_targets",
    key: string,
    firstNight: number,
  ): [number, number] | null => {
    const actor = record.metadata.players.find((p) => p.role === role)?.id;
    const rows = before.filter((d) => d.stage === stage);
    if (actor === undefined || day < firstNight || !nightLiving.includes(actor)) {
      check(rows.length === 0);
      return null;
    }
    const state = previous.players.find((p) => p.id === actor)?.privateState[key] as
      { history?: Array<{ pair: number[] | null }> } | undefined;
    check(state && Array.isArray(state.history));
    const used = new Set(state.history.flatMap((h) => h.pair ?? []));
    const candidates = nightLiving.filter((id) => !used.has(id));
    if (candidates.length < 2) {
      check(rows.length === 0);
      return null;
    }
    check(rows.length === 1 && rows[0]!.actorId === actor);
    const call = action(rows[0]!);
    check(
      call?.name === tool &&
        (call.name === "swap_targets" ||
          call.name === "swap_night_seats" ||
          call.name === "swap_exile_targets"),
    );
    if (call.args.abstain === true) {
      check(call.args.first_id === null && call.args.second_id === null);
      return null;
    }
    const a = call.args.first_id,
      b = call.args.second_id;
    check(
      call.args.abstain === false &&
        typeof a === "number" &&
        typeof b === "number" &&
        a !== b &&
        candidates.includes(a) &&
        candidates.includes(b),
    );
    return [Math.min(a, b), Math.max(a, b)];
  };
  let magician = pair(
    Role.Magician,
    "magician_exchange",
    "swap_targets",
    "magician",
    record.metadata.normalizedBoard.magician!.firstNight,
  );
  const sorcerer = pair(
    Role.WolfSorcerer,
    "wolf_sorcerer_exchange",
    "swap_night_seats",
    "wolfSorcerer",
    record.metadata.normalizedBoard.wolfSorcerer?.firstNight ?? 2,
  );
  const trickster = pair(
    Role.Trickster,
    "trickster_exchange",
    "swap_exile_targets",
    "trickster",
    1,
  );
  if (magician && trickster && magician.join(",") === trickster.join(",")) magician = null;
  const exchange = (id: number, p: [number, number] | null) =>
    p ? (id === p[0] ? p[1] : id === p[1] ? p[0] : id) : id;
  const nightTarget = (id: number) => exchange(exchange(id, sorcerer), magician);
  const nightSources = new Map<number, DeathCause[]>();
  const add = (id: number, cause: DeathCause) =>
    nightSources.set(id, [...new Set([...(nightSources.get(id) ?? []), cause])]);
  const wolves = nightLiving.filter(
    (id) =>
      [Role.Wolf, Role.WolfKing, Role.Trickster, Role.WolfSorcerer].includes(original.get(id)!) &&
      (original.get(id) !== Role.WolfSorcerer ||
        day >= record.metadata.normalizedBoard.wolfSorcerer!.firstNight),
  );
  const votes = new Map<number, number>();
  for (const actor of wolves) {
    const rows = before.filter((d) => d.actorId === actor && d.stage === "wolf_vote");
    check(rows.length === 1);
    const call = action(rows[0]!);
    check(call?.name === "kill_vote");
    if (call.args.abstain === true) {
      check(call.args.target_id === null);
      continue;
    }
    const target = call.args.target_id;
    check(
      call.args.abstain === false && typeof target === "number" && nightLiving.includes(target),
    );
    votes.set(target, (votes.get(target) ?? 0) + 1);
  }
  const rawKnife = top(votes)[0] ?? null;
  const witch = nightLiving.find((id) => original.get(id) === Role.Witch);
  let healed = false;
  if (witch !== undefined) {
    const rows = before.filter((d) => d.actorId === witch && d.stage === "witch");
    check(rows.length === 1);
    const call = action(rows[0]!);
    check(call?.name === "use_potion");
    if (call.args.potion_type === "heal") {
      check(call.args.target_id === rawKnife && rawKnife !== witch);
      healed = true;
    } else if (call.args.potion_type === "poison") {
      const target = call.args.target_id;
      check(typeof target === "number" && nightLiving.includes(target));
      add(nightTarget(target), DeathCause.Poison);
    } else check(call.args.potion_type === "none");
  }
  if (rawKnife !== null && !healed) add(nightTarget(rawKnife), DeathCause.WolfKill);
  for (const turn of before) {
    const call = action(turn);
    if (
      call?.name === "self_destruct" &&
      call.args.confirm === true &&
      [Role.Wolf, Role.WolfKing, Role.Trickster, Role.WolfSorcerer].includes(
        original.get(turn.actorId)!,
      )
    )
      add(turn.actorId, DeathCause.SelfDestruct);
  }
  const initialNightSources = new Map(nightSources);
  const qualified = (id: number, sources: readonly DeathCause[], origin: Phase) => {
    const policy =
      original.get(id) === Role.WolfKing
        ? (record.metadata.normalizedBoard.wolfKing?.deathActionPolicy ??
          "awa_qualified_sources_v1")
        : (record.metadata.normalizedBoard.hunter?.deathActionPolicy ?? "awa_qualified_sources_v1");
    return (
      !(policy === "awa_day_deaths_v1" && origin === Phase.Night) &&
      sources.length > 0 &&
      sources.every(
        (source) =>
          source === DeathCause.WolfKill ||
          source === DeathCause.Exile ||
          (policy !== "awa_knife_or_exile_v1" && source === DeathCause.Shot),
      )
    );
  };
  const priorGuns = before
    .filter((d) => d.request.allowedTools.includes("shoot"))
    .sort((a, b) => a.settleOrder! - b.settleOrder!);
  const applyGuns = (
    sources: Map<number, DeathCause[]>,
    origin: Phase,
    living: Set<number>,
    through = cutoff,
  ) => {
    for (const turn of priorGuns.filter(
      (d) => sources.has(d.actorId) && d.settleOrder! <= through,
    )) {
      const call = action(turn),
        stock = sources.get(turn.actorId);
      check(stock && qualified(turn.actorId, stock, origin) && call?.name === "shoot");
      const raw = call.args.target_id;
      if (raw === null) continue;
      check(typeof raw === "number" && living.has(raw));
      const target =
        origin === Phase.Night &&
        record.metadata.normalizedBoard.magician!.deathShotTargetPolicy === "exchanged"
          ? nightTarget(raw)
          : raw;
      if (!living.delete(target)) continue; // 合法的映射枪击可以命中已死亡玩家。
      sources.set(target, [DeathCause.Shot]);
    }
  };
  const living = new Set(nightLiving.filter((id) => !nightSources.has(id)));
  applyGuns(nightSources, Phase.Night, living);
  if (nightSources.has(request.actorId))
    return { origin: Phase.Night, sources: nightSources.get(request.actorId)! };

  const ballots = before.filter((d) => d.request.allowedTools.includes("vote"));
  if (ballots.length === 0) return undefined;
  const badgeCutoff = Math.min(...ballots.map((d) => d.openedAfterSettlement));
  let sheriff = previous.players.find((p) => p.badge.isSheriff)?.id ?? null;
  const election = before.filter((d) => d.settleOrder! <= badgeCutoff);
  if (day === 1) {
    const candidates = new Set<number>();
    for (const d of election.filter((d) => d.stage === "sheriff_nomination")) {
      const call = action(d);
      if (call?.name === "run_for_sheriff" && call.args.run === true) candidates.add(d.actorId);
    }
    for (const d of election.filter((d) => d.stage === "sheriff_withdraw")) {
      const call = action(d);
      if (call?.name === "run_for_sheriff" && call.args.run === false) candidates.delete(d.actorId);
    }
    const tally = (stage: string, targets: ReadonlySet<number>) => {
      const counts = new Map<number, number>();
      for (const d of election.filter((d) => d.stage === stage)) {
        const call = action(d);
        if (
          call?.name === "vote_for_sheriff" &&
          call.args.abstain === false &&
          typeof call.args.target_id === "number" &&
          targets.has(call.args.target_id)
        )
          counts.set(call.args.target_id, (counts.get(call.args.target_id) ?? 0) + 1);
      }
      return top(counts);
    };
    if (candidates.size === 1) sheriff = [...candidates][0]!;
    else {
      let winners = tally("sheriff_vote", candidates);
      if (winners.length > 1) winners = tally("sheriff_pk_vote", new Set(winners));
      sheriff = winners.length === 1 ? winners[0]! : null;
    }
  }
  for (const d of election
    .filter((d) => d.stage === "sheriff_badge_choice")
    .sort((a, b) => a.settleOrder! - b.settleOrder!)) {
    if (d.actorId !== sheriff) continue;
    const call = action(d);
    const target = call?.name === "choose_badge_successor" ? call.args.target_id : null;
    const atChoice = new Map(initialNightSources);
    const aliveAtChoice = new Set(nightLiving.filter((id) => !atChoice.has(id)));
    applyGuns(atChoice, Phase.Night, aliveAtChoice, d.openedAfterSettlement);
    sheriff =
      typeof target === "number" && target !== d.actorId && aliveAtChoice.has(target)
        ? target
        : null;
  }
  const tallyBallot = (stage: string, candidates?: readonly number[]) => {
    const last = new Map<number, RecordedDecision>();
    for (const d of ballots.filter((d) => d.stage === stage)) last.set(d.actorId, d);
    const counts = new Map<number, number>();
    for (const [actor, d] of last) {
      check(living.has(actor) && !candidates?.includes(actor));
      const call = action(d);
      if (call?.name !== "vote" || call.args.abstain === true || call.args.target_id === null)
        continue;
      const target = call.args.target_id;
      // 普通投票重试全部耗尽后，由投票流水线修复为弃票。
      if (
        call.args.abstain !== false ||
        typeof target !== "number" ||
        !living.has(target) ||
        (candidates && !candidates.includes(target))
      )
        continue;
      counts.set(
        target,
        (counts.get(target) ?? 0) +
          (actor === sheriff ? (record.metadata.normalizedBoard.sheriff?.voteWeight ?? 1.5) : 1),
      );
    }
    return top(counts);
  };
  let winners = tallyBallot("voting");
  if (winners.length > 1) winners = tallyBallot("exile_pk_vote", winners);
  const exile = winners.length === 1 ? winners[0]! : null;
  const daySources = new Map<number, DeathCause[]>();
  if (exile !== null) {
    daySources.set(exile, [DeathCause.Exile]);
    living.delete(exile);
  }
  applyGuns(daySources, Phase.Voting, living);
  return daySources.has(request.actorId)
    ? { origin: Phase.Voting, sources: daySources.get(request.actorId)! }
    : undefined;
}
