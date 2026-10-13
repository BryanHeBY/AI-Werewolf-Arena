/**
 * 负责独立审核日蚀行动、继承与发表因果前缀。输入为归档配置、决定、事实与 checkpoint；
 * 输出为原一致性结果或明确拒绝，原纯数据推导、迭代与第一失败顺序保持。
 * 稳定枚举来自中立契约，不通过 barrel 加载 World／生产伤害；不读取或写入真实库存。
 * 结构读器仅确认数据；既有算法只消费归档，不授予游戏权限，也不替换原拒绝政策。
 */
import { isRadiantEclipsePreset } from "../verification/board-support";
import {
  RADIANT_ECLIPSE_EVENT_TYPES,
  readRadiantEclipseFact,
  radiantEclipseAudience,
} from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import { Camp, Phase, Role } from "@ai-werewolf-arena/game-contract";
import type { RecordedCheckpoint, RecordedDecision, ReproductionRecord } from "./reproduction";
import { createMistSheriffEvidence } from "./mist_raven_sheriff_record";
import { sanitizeSpeechText } from "../utils/speech_text";

/** Independent finite-board evidence: no production ability/frame/target/damage imports. */
export function radiantCheck(value: unknown): asserts value {
  if (!value) throw Error("reproduction_radiant_eclipse_invalid");
}
export function radiantEqual(a: unknown, b: unknown): boolean {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x !== undefined)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, x]) => [k, stable(x)]),
          )
        : v;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
const check: (value: unknown) => asserts value = radiantCheck;
const equal = radiantEqual,
  policy = "awa_radiant_eclipse_v1";
export type RadiantAbility = {
  id: string;
  kind: "shelter" | "seer_check" | "potion" | "dream";
  state: Record<string, any>;
  source: Record<string, unknown>;
  sourceDisclosed: true;
  startsOnDay: number;
  expiresAfterDay?: number;
  maxUses: null;
  uses: number;
  lastUsedDay: number | null;
  disabled: boolean;
};
export interface RadiantNightEvidence {
  day: number;
  start: number[];
  before: Map<number, RadiantAbility | undefined>;
  previousSwallow: { day: number; targetId: number | null } | undefined;
  copy: RadiantAbility | undefined;
  target: number | null;
  swallowed: boolean;
  suppressed: boolean;
  restored: boolean;
  closed: "committed" | "aborted" | null;
  shelters: Map<number, number | null>;
  dreams: Array<{
    actorId: number;
    targetId: number;
    day: number;
    consecutive: boolean;
    abilityId?: string;
  }>;
  potions: Set<number>;
  checks: Set<number>;
  wolfOrder: number[] | null;
  wolfVotes: Map<number, number | null>;
  knife: number | null;
  heal: number | null;
  poisons: Set<number>;
  blast: boolean;
  settled: boolean;
  damage: { deaths: number[]; death_sources: Record<number, string[]> } | null;
  reasons: Array<Record<string, unknown>>;
  reasonsSeen: number;
}
const rolesToKind: Partial<Record<Role, RadiantAbility["kind"]>> = {
  [Role.RadiantCount]: "shelter",
  [Role.Seer]: "seer_check",
  [Role.Witch]: "potion",
  [Role.Dreamer]: "dream",
};
function native(role: Role): RadiantAbility | undefined {
  const kind = rolesToKind[role];
  if (!kind) return;
  const state =
    kind === "shelter"
      ? { policy, lastTarget: null, lastDay: null }
      : kind === "seer_check"
        ? { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] }
        : kind === "potion"
          ? {
              heal: 1,
              poison: 1,
              selfHealRule: "disabled",
              canSelfHeal: false,
              healUsedThisNight: false,
              poisonUsedThisNight: false,
            }
          : {
              lastTarget: null,
              lastDay: null,
              history: [],
              protectionPolicy: "netease_2026_night_immunity_v1",
            };
  return {
    id: `native:${kind}`,
    kind,
    state,
    source: { kind: "native", role },
    sourceDisclosed: true,
    startsOnDay: kind === "shelter" ? 2 : 1,
    maxUses: null,
    uses: 0,
    lastUsedDay: null,
    disabled: false,
  };
}
export function radiantBorrow(
  source: RadiantAbility,
  actorId: number,
  day: number,
): RadiantAbility {
  const s = source.state,
    kind = source.kind;
  const state =
    kind === "shelter"
      ? { policy, lastTarget: s.lastTarget, lastDay: s.lastDay }
      : kind === "seer_check"
        ? {
            targetPolicy: "awa_alive_v1",
            actionPolicy: "awa_required_when_legal_v1",
            lastTarget: null,
            lastIsWerewolf: null,
            lastResult: null,
            history: [],
          }
        : kind === "potion"
          ? {
              heal: s.heal,
              poison: s.poison,
              selfHealRule: "disabled",
              knifeVisibility: "awa_with_heal_v1",
              potionPolicy: "awa_one_native_v1",
              canSelfHeal: false,
              healUsedThisNight: false,
              poisonUsedThisNight: false,
            }
          : {
              lastTarget: s.lastTarget,
              lastDay: s.lastDay,
              protectionPolicy: "netease_2026_night_immunity_v1",
              history: [],
            };
  return {
    id: `copy:eclipse:night:${day}`,
    kind,
    state,
    source: { kind: "copy", actorId, abilityId: source.id },
    sourceDisclosed: true,
    startsOnDay: day,
    expiresAfterDay: day,
    maxUses: null,
    uses: 0,
    lastUsedDay: null,
    disabled: false,
  };
}
export function validateRadiantEclipseRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard,
    owns = board.roleSetups.some(
      (p) => (p.role === Role.RadiantCount || p.role === Role.EclipseMaid) && p.count > 0,
    );
  const artifacts =
    record.events.some((e) =>
      (RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(e.type),
    ) ||
    record.decisions.some(
      (d) =>
        ["eclipse_swallow", "radiant_shelter"].includes(d.stage) ||
        d.request.allowedTools.some((t) => ["cast_shelter", "swallow_skill"].includes(t)) ||
        Object.hasOwn(d.request.context, "shelter_candidates") ||
        Object.hasOwn(d.request.context, "swallow_candidates") ||
        d.request.context.ability_id?.startsWith("copy:eclipse:"),
    ) ||
    record.checkpoints.some((c) =>
      c.players.some(
        (p) =>
          Object.hasOwn(p.privateState, "eclipse") ||
          Object.values((p.privateState.abilities ?? {}) as Record<string, any>).some(
            (a) => a.kind === "shelter" || a.id?.startsWith("copy:eclipse:"),
          ),
      ),
    );
  if (!owns) {
    check(!board.radiantEclipse && !artifacts);
    return;
  }
  check(
    isRadiantEclipsePreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal,
  );
  if (record.finalized)
    check(
      record.decisions.every((d) => d.outcome.kind !== "pending") &&
        record.checkpoints.at(-1)!.eventCount === record.events.length,
    );
  const roster = new Map(record.metadata.players.map((p) => [p.id, p]));
  check(
    equal(
      [...roster.keys()].sort((a, b) => a - b),
      Array.from({ length: 12 }, (_, i) => i + 1),
    ),
  );
  for (const [role, count] of [
    [Role.EclipseMaid, 1],
    [Role.RadiantCount, 1],
    [Role.Seer, 1],
    [Role.Witch, 1],
    [Role.Dreamer, 1],
    [Role.Villager, 4],
    [Role.Wolf, 3],
  ] as const)
    check([...roster.values()].filter((p) => p.role === role).length === count);
  for (const p of roster.values())
    check(p.camp === ([Role.Wolf, Role.EclipseMaid].includes(p.role) ? Camp.Wolf : Camp.Good));
  const actor = (role: Role) => [...roster.values()].find((p) => p.role === role)!.id;
  const maid = actor(Role.EclipseMaid),
    count = actor(Role.RadiantCount),
    seer = actor(Role.Seer),
    witch = actor(Role.Witch),
    dreamer = actor(Role.Dreamer);
  const alive = new Set(roster.keys()),
    abilities = new Map<number, Map<string, RadiantAbility>>(
      [...roster].map(([id, p]) => {
        const a = native(p.role);
        return [id, new Map(a ? [[a.id, a]] : [])];
      }),
    );
  const history: Array<{
      day: number;
      targetId: number | null;
      roleId: Role | null;
      abilityId: string | null;
    }> = [],
    nights = new Map<number, RadiantNightEvidence>();
  const marks = new Map<number, Set<string>>([...roster.keys()].map((id) => [id, new Set()]));
  const votes = new Map([...roster.keys()].map((id) => [id, { weight: 1, canVote: true }]));
  const badges = new Map<number, RecordedCheckpoint["players"][number]["badge"]>(
    [...roster.keys()].map((id) => [id, { isSheriff: false, destroyed: false, voteWeight: 1.5 }]),
  );
  let day = 1,
    phase: Phase = Phase.Night,
    sheriff: number | null = null,
    result: RecordedCheckpoint["snapshot"]["result"] = null;
  const rows = (n: number, stage: string, who?: number) =>
    record.decisions.filter(
      (d) => d.day === n && d.stage === stage && (who === undefined || d.actorId === who),
    );
  const call = (n: number, stage: string, who: number) => {
    const ds = rows(n, stage, who);
    check(ds.length === 1);
    const d = ds[0]!;
    check(d.outcome.kind === "action" && d.outcome.action && d.settleOrder !== undefined);
    return d.outcome.action;
  };
  const begin = (number = day): RadiantNightEvidence => {
    const old = nights.get(number);
    if (old) return old;
    for (const id of alive)
      for (const a of abilities.get(id)!.values())
        if (a.kind === "potion")
          Object.assign(a.state, {
            healUsedThisNight: false,
            poisonUsedThisNight: false,
            canSelfHeal: false,
          });
    const before = new Map(
      [...abilities].map(([id, list]) => [
        id,
        structuredClone([...list.values()].find((a) => a.source.kind === "native")),
      ]),
    );
    const n: RadiantNightEvidence = {
      day: number,
      start: [...alive],
      before,
      previousSwallow: history.at(-1) ? { ...history.at(-1)! } : undefined,
      copy: undefined,
      target: null,
      swallowed: false,
      suppressed: false,
      restored: false,
      closed: null,
      shelters: new Map(),
      dreams: [],
      potions: new Set(),
      checks: new Set(),
      wolfOrder: null,
      wolfVotes: new Map(),
      knife: null,
      heal: null,
      poisons: new Set(),
      blast: false,
      settled: false,
      damage: null,
      reasons: [],
      reasonsSeen: 0,
    };
    nights.set(number, n);
    return n;
  };
  const pack = (n: RadiantNightEvidence) => {
    const ordinary = n.start.filter((id) => roster.get(id)!.role === Role.Wolf);
    return ordinary.length ? ordinary : n.start.includes(maid) ? [maid] : [];
  };
  const chat = (n: RadiantNightEvidence) =>
    n.start.filter((id) => roster.get(id)!.role === Role.Wolf);
  const owned = (
    n: RadiantNightEvidence,
    id: number,
    kind: RadiantAbility["kind"],
    abilityId: unknown,
  ): RadiantAbility => {
    check(n.start.includes(id) && !n.closed);
    const a =
      id === maid
        ? n.copy
        : [...abilities.get(id)!.values()].find((a) => a.source.kind === "native");
    check(
      a &&
        a.kind === kind &&
        a.id === (abilityId ?? `native:${kind}`) &&
        n.day >= a.startsOnDay &&
        a.lastUsedDay !== n.day &&
        (id === maid || n.target !== id),
    );
    return a;
  };
  const use = (a: RadiantAbility, n: RadiantNightEvidence, consumed = true) => {
    check(a.lastUsedDay !== n.day);
    a.lastUsedDay = n.day;
    if (consumed) a.uses++;
  };
  const resolveKnife = (n: RadiantNightEvidence) => {
    check(
      equal(
        [...n.wolfVotes.keys()].sort((a, b) => a - b),
        pack(n).sort((a, b) => a - b),
      ),
    );
    const tally = new Map<number, number>();
    for (const target of n.wolfVotes.values())
      if (target !== null) tally.set(target, (tally.get(target) ?? 0) + 1);
    n.knife = [...tally].sort(([a, x], [b, y]) => y - x || a - b)[0]?.[0] ?? null;
    if (n.knife !== null) marks.get(n.knife)!.add("WolfKillMark");
  };
  const damage = (n: RadiantNightEvidence) => {
    const sheltered = new Set([...n.shelters.values()].filter((id): id is number => id !== null)),
      dreamTargets = new Set(n.dreams.map((d) => d.targetId));
    const backlash = n.target !== null && (n.target === count || sheltered.has(n.target));
    const deaths: number[] = [],
      sources: Record<number, string[]> = {};
    for (const id of n.start) {
      const kinds: string[] = [];
      if (!sheltered.has(id)) {
        if (n.poisons.has(id) && !dreamTargets.has(id)) kinds.push("poison");
        if (n.knife === id && n.heal !== id && !dreamTargets.has(id)) kinds.push("wolf_kill");
        if (id === maid && backlash && !dreamTargets.has(id)) kinds.push("radiant_backlash");
        if (n.dreams.some((d) => d.targetId === id && d.consecutive)) kinds.push("dream");
      }
      if (kinds.length) {
        deaths.push(id);
        sources[id] = kinds;
      }
    }
    const reasons: Array<Record<string, unknown>> = [];
    for (const d of n.dreams)
      if (d.consecutive && !sheltered.has(d.targetId))
        reasons.push({ ...d, reason: "consecutive" });
    let changed = true;
    while (changed) {
      changed = false;
      for (const d of n.dreams)
        if (deaths.includes(d.actorId) && !sheltered.has(d.targetId)) {
          if (
            !reasons.some(
              (r) =>
                r.actorId === d.actorId && r.abilityId === d.abilityId && r.reason === "linked",
            )
          )
            reasons.push({ ...d, reason: "linked" });
          if (!deaths.includes(d.targetId)) {
            deaths.push(d.targetId);
            changed = true;
          }
          sources[d.targetId] = [...new Set([...(sources[d.targetId] ?? []), "dream"])];
        }
    }
    // Internal consecutive flags are not part of a published death explanation.
    n.reasons = deaths.flatMap((id) =>
      reasons.filter((r) => r.targetId === id).map(({ consecutive: _flag, ...r }) => r),
    );
    return { deaths, death_sources: sources };
  };
  const initialInfo = {
    boardSize: 12,
    players: record.metadata.players.map((p, i) => ({
      id: p.id,
      seat: i + 1,
      name: p.name,
      role: p.role,
      camp: p.camp,
    })),
  };
  const checkpoints = new Map<number, RecordedCheckpoint[]>();
  for (const cp of record.checkpoints) {
    check(cp.eventCount <= record.events.length);
    const cs = checkpoints.get(cp.eventCount) ?? [];
    cs.push(cp);
    checkpoints.set(cp.eventCount, cs);
  }
  const checkpoint = (cp: RecordedCheckpoint) => {
    check(cp.players.length === 12 && new Set(cp.players.map((p) => p.id)).size === 12);
    for (const p of cp.players) {
      const original = roster.get(p.id);
      check(
        original &&
          p.seat === p.id &&
          p.name === original.name &&
          p.role === original.role &&
          p.camp === original.camp &&
          p.alive === alive.has(p.id),
      );
      const list = abilities.get(p.id)!,
        stored = structuredClone(Object.fromEntries(list)),
        current = nights.get(cp.snapshot.day);
      if (current && !current.closed && current.target === p.id && current.copy) {
        const a = current.before.get(p.id)!;
        Object.assign(stored[a.id]!, { nightSuppression: { policy, day: current.day } });
      }
      const expected: Record<string, unknown> =
        p.id === maid
          ? { eclipse: { policy, history }, abilities: stored }
          : list.size
            ? { abilities: stored }
            : {};
      check(
        equal(p.privateState, expected) &&
          equal(p.marks, [...marks.get(p.id)!]) &&
          equal(p.vote, votes.get(p.id)) &&
          equal(p.badge, badges.get(p.id)),
      );
      check(
        equal(p.victory, { affiliations: [{ kind: "faction", faction: original.camp }] }) &&
          !p.wallNote &&
          !p.debatePenalty &&
          !p.lovers,
      );
    }
    check(cp.snapshot.gameOver === (result !== null) && equal(cp.snapshot.result, result));
    if (cp.cycle === 0)
      check(cp.complete && cp.snapshot.day === 1 && cp.snapshot.phase === Phase.Night);
    else if (cp.complete && nights.get(cp.cycle)?.closed === "aborted") {
      check(cp.snapshot.day === day && cp.snapshot.phase === phase);
    } else if (cp.complete) {
      const n = nights.get(cp.cycle);
      check(n?.settled && n.reasonsSeen === n.reasons.length);
      check(
        cp.snapshot.day === (result ? day : cp.cycle + 1) &&
          cp.snapshot.phase === (result ? Phase.GameOver : n.blast ? Phase.Night : Phase.Voting),
      );
    } else {
      check(cp.snapshot.day === day && cp.snapshot.phase === phase);
      check(cp.cycle === 0 || !!nights.get(cp.cycle)?.closed);
    }
  };
  let exileRound = 1,
    exileCandidates: number[] | null = null,
    exileExpected: number | null = null,
    exileTallied = false;
  let ballots: Array<{
    actorId: number;
    targetId: number | null;
    abstain: boolean;
    weight: number;
  }> = [];
  const election = createMistSheriffEvidence(record);
  const ballot = (id: number) => {
    const stage = exileRound === 1 ? "voting" : "exile_pk_vote",
      ds = rows(day, stage, id);
    check(ds.length >= 1 && ds.length <= 4);
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i]!;
      check(
        d.request.phase === Phase.Voting &&
          equal(d.request.allowedTools, ["vote"]) &&
          d.turn === i + 1 &&
          d.settleOrder !== undefined,
      );
      if (d.outcome.kind !== "action" || d.outcome.action?.name !== "vote") continue;
      const a = d.outcome.action.args,
        valid =
          typeof a.abstain === "boolean" &&
          (a.target_id === null || Number.isSafeInteger(a.target_id)) &&
          (a.abstain ||
            (a.target_id !== null &&
              alive.has(a.target_id) &&
              (!exileCandidates || exileCandidates.includes(a.target_id))));
      if (!valid) continue;
      check(i === ds.length - 1);
      return {
        actorId: id,
        targetId: a.target_id,
        abstain: a.abstain,
        weight: a.abstain ? 0 : votes.get(id)!.weight,
        ...(i ? { fallback: true } : {}),
      };
    }
    check(ds.length === 4);
    return { actorId: id, targetId: null, abstain: true, weight: 0, fallback: true };
  };
  const badgeChoice = (from: number) => {
    check(!alive.has(from));
    const candidates = [...alive];
    if (!candidates.length) {
      check(rows(day, "sheriff_badge_choice", from).length === 0);
      return null;
    }
    const ds = rows(day, "sheriff_badge_choice", from);
    check(
      ds.length === 1 &&
        equal(ds[0]!.request.context.badge_candidates, candidates) &&
        ds[0]!.request.context.allow_fallback === false,
    );
    const outcome = ds[0]!.outcome;
    check(outcome.kind === "action");
    const a = outcome.action;
    return a?.name === "choose_badge_successor" &&
      a.args.target_id !== null &&
      candidates.includes(a.args.target_id)
      ? a.args.target_id
      : null;
  };
  const nativeEvents = new Set([
    ...RADIANT_ECLIPSE_EVENT_TYPES,
    "god_private_game_info",
    "phase_changed",
    "ability_changed",
    "dream_applied",
    "dream_death",
    "seer_checked",
    "witch_potion_used",
    "witch_potion_skipped",
    "wolf_tactical_order",
    "wolf_discussion",
    "wolf_discussion_ended",
    "wolf_kill_vote_cast",
    "wolf_self_destruct",
    "night_resolved",
    "day_speech",
    "last_words_granted",
    "last_words_spoken",
    "vote_cast",
    "vote_summary",
    "voted_out",
    "exile_pk_started",
    "sheriff_candidate_declared",
    "sheriff_nomination_summary",
    "sheriff_withdraw_summary",
    "sheriff_candidates_finalized",
    "sheriff_vote_cast",
    "sheriff_vote_summary",
    "sheriff_pk_started",
    "sheriff_elected",
    "sheriff_direction_chosen",
    "sheriff_badge_transferred",
    "sheriff_badge_destroyed",
    "game_over",
  ]);
  const nightOperations = record.operations.filter(
    (o) => o.scope === "resolution" && o.op === "night_damage_resolved",
  );
  let operation = 0;
  for (const cp of checkpoints.get(0) ?? []) checkpoint(cp);
  for (let index = 0; index < record.events.length; index++) {
    const e = record.events[index]!,
      p = e.payload;
    check(result === null);
    check(nativeEvents.has(e.type));
    try {
      election.accept(e, { day, phase, alive, idiot: 0, idiotRevealed: false });
    } catch {
      check(false);
    }
    if (e.type === "god_private_game_info") check(index === 0 && equal(p, initialInfo));
    if (e.type === "phase_changed") {
      check(typeof p.day === "number" && typeof p.phase === "string");
      day = p.day;
      phase = p.phase as Phase;
      if (phase === Phase.Day) {
        const n = nights.get(day);
        if (n?.closed === "committed") check(n.target === null || n.restored);
      }
      if (phase === Phase.Voting) {
        check(nights.get(day)?.settled);
        exileRound = 1;
        exileCandidates = null;
        exileExpected = null;
        exileTallied = false;
        ballots = [];
      }
    }
    if (e.type === "ability_changed") {
      const n = begin();
      check(
        phase === Phase.Night &&
          day >= 2 &&
          !n.copy &&
          !n.swallowed &&
          p.actorId === maid &&
          p.operation === "granted",
      );
      const a = call(day, "eclipse_swallow", maid);
      check(a.name === "swallow_skill" && a.args.target_id !== null);
      const target = a.args.target_id;
      check(n.start.includes(target) && roster.get(target)!.camp === Camp.Good);
      const original = n.before.get(target);
      check(original);
      n.copy = radiantBorrow(original, target, day);
      abilities.get(maid)!.set(n.copy.id, n.copy);
      const {
        state: _state,
        uses: _uses,
        lastUsedDay: _last,
        disabled: _disabled,
        ...metadata
      } = n.copy;
      check(
        equal(p, {
          actorId: maid,
          abilityId: metadata.id,
          kind: metadata.kind,
          operation: "granted",
          source: metadata.source,
          sourceDisclosed: true,
          startsOnDay: day,
          expiresAfterDay: day,
          maxUses: null,
        }),
      );
    }
    if ((RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(e.type)) {
      const f = readRadiantEclipseFact(e.type, p);
      check(f && equal(e.audience, radiantEclipseAudience(e.type, f)));
      if (e.type === "eclipse_lease_closed")
        check(
          nights.has(f.day) ||
            record.decisions.some((d) => d.day === f.day && d.request.phase === Phase.Night),
        );
      const n = begin(f.day);
      if (e.type === "eclipse_swallowed") {
        check(
          phase === Phase.Night &&
            f.day === day &&
            !n.closed &&
            !n.swallowed &&
            p.actorId === maid &&
            n.start.includes(maid),
        );
        const a = call(day, "eclipse_swallow", maid);
        check(a.name === "swallow_skill" && a.args.target_id === p.targetId);
        const target = p.targetId as number | null;
        check(
          target === null ||
            (n.start.includes(target) &&
              roster.get(target)!.camp === Camp.Good &&
              !(n.previousSwallow?.day === day - 1 && n.previousSwallow.targetId === target)),
        );
        const role = target === null ? null : roster.get(target)!.role,
          abilityId = target === null || role === Role.Villager ? null : n.copy?.id;
        check(
          p.roleId === role &&
            p.abilityId === abilityId &&
            (abilityId === null ? !n.copy : !!n.copy),
        );
        n.swallowed = true;
        n.target = target;
        history.push({ day, targetId: target, roleId: role, abilityId: abilityId ?? null });
      }
      if (e.type === "eclipse_native_suppressed") {
        check(
          phase === Phase.Night &&
            n.swallowed &&
            !n.suppressed &&
            !n.closed &&
            p.playerId === n.target,
        );
        n.suppressed = true;
      }
      if (e.type === "radiant_shelter_chosen") {
        check(
          phase === Phase.Night &&
            p.day === day &&
            typeof p.actorId === "number" &&
            !n.shelters.has(p.actorId),
        );
        const id = p.actorId,
          a = owned(n, id, "shelter", p.abilityId),
          target = p.targetId as number | null;
        const response = call(day, "radiant_shelter", id);
        check(response.name === "cast_shelter" && response.args.target_id === target);
        check(
          target === null ||
            (n.start.includes(target) &&
              target !== id &&
              !(a.state.lastDay === day - 1 && a.state.lastTarget === target)),
        );
        use(a, n, target !== null);
        Object.assign(a.state, { lastTarget: target, lastDay: day });
        n.shelters.set(id, target);
      }
      if (e.type === "eclipse_lease_closed") {
        check(
          !n.closed &&
            p.actorId === maid &&
            p.targetId === n.target &&
            p.abilityId === (n.copy?.id ?? null) &&
            (n.target === null || n.suppressed),
        );
        n.closed = p.status as "committed" | "aborted";
        if (n.copy) n.copy.disabled = true;
        if (n.closed === "committed") {
          check(phase === Phase.Night && day === n.day);
          check(n.day < 2 || !n.start.includes(maid) || n.swallowed);
          const requiredShelter =
            n.day < 2
              ? []
              : [
                  ...n.start.filter((id) => id === count && n.target !== id),
                  ...(n.copy?.kind === "shelter" ? [maid] : []),
                ];
          check(
            equal(
              [...n.shelters.keys()].sort((a, b) => a - b),
              requiredShelter.sort((a, b) => a - b),
            ),
          );
          const requiredDream = [
            ...n.start.filter((id) => id === dreamer && n.target !== id),
            ...(n.copy?.kind === "dream" ? [maid] : []),
          ].filter((id) => n.start.some((t) => t !== id));
          check(
            equal(
              n.dreams.map((d) => d.actorId).sort((a, b) => a - b),
              requiredDream.sort((a, b) => a - b),
            ),
          );
          const requiredSeer = [
            ...n.start.filter((id) => id === seer && n.target !== id),
            ...(n.copy?.kind === "seer_check" ? [maid] : []),
          ];
          check(
            equal(
              [...n.checks].sort((a, b) => a - b),
              requiredSeer.sort((a, b) => a - b),
            ),
          );
          const requiredPotion = [
            ...n.start.filter((id) => id === witch && n.target !== id),
            ...(n.copy?.kind === "potion" &&
            (n.before.get(n.target!)!.state.heal || n.before.get(n.target!)!.state.poison)
              ? [maid]
              : []),
          ];
          check(
            equal(
              [...n.potions].sort((a, b) => a - b),
              requiredPotion.sort((a, b) => a - b),
            ),
          );
          check(
            equal(
              [...new Set(rows(day, "wolf_discussion").map((d) => d.actorId))].sort(
                (a, b) => a - b,
              ),
              chat(n).sort((a, b) => a - b),
            ),
          );
          resolveKnife(n);
          n.damage = damage(n);
          for (const ms of marks.values()) ms.clear();
          if (record.finalized) check(equal(nightOperations[operation++]?.output, n.damage));
        }
      }
      if (e.type === "eclipse_native_restored") {
        check(
          phase === Phase.Night &&
            n.closed === "committed" &&
            !n.restored &&
            p.playerId === n.target &&
            alive.has(p.playerId as number),
        );
        n.restored = true;
      }
    }
    if (e.type === "dream_applied") {
      const n = begin();
      check(
        phase === Phase.Night &&
          p.day === day &&
          typeof p.actorId === "number" &&
          typeof p.targetId === "number" &&
          !n.dreams.some((d) => d.actorId === p.actorId),
      );
      const id = p.actorId,
        a = owned(n, id, "dream", p.abilityId),
        target = p.targetId;
      check(n.start.includes(target) && target !== id);
      const response = call(day, "dreamer", id);
      check(response.name === "dream" && response.args.target_id === target);
      const consecutive = a.state.lastDay === day - 1 && a.state.lastTarget === target;
      check(p.consecutive === consecutive);
      const fact = {
        actorId: id,
        targetId: target,
        day,
        consecutive,
        ...(id === maid ? { abilityId: a.id } : {}),
      };
      check(equal(p, fact));
      n.dreams.push(fact);
      Object.assign(a.state, { lastTarget: target, lastDay: day });
      a.state.history.push({ day, targetId: target });
      use(a, n);
    }
    if (e.type === "seer_checked") {
      const n = begin();
      check(
        phase === Phase.Night &&
          typeof p.actorId === "number" &&
          typeof p.targetId === "number" &&
          !n.checks.has(p.actorId),
      );
      const id = p.actorId,
        a = owned(n, id, "seer_check", p.abilityId),
        target = p.targetId;
      check(n.start.includes(target));
      const response = call(day, "seer", id);
      check(response.name === "check_identity" && response.args.target_id === target);
      const wolf = roster.get(target)!.camp === Camp.Wolf,
        inspection = { kind: "camp", camp: wolf ? Camp.Wolf : Camp.Good };
      check(
        equal(p, {
          actorId: id,
          targetId: target,
          isWerewolf: wolf,
          result: inspection,
          ...(id === maid ? { abilityId: a.id } : {}),
        }),
      );
      Object.assign(a.state, { lastTarget: target, lastIsWerewolf: wolf, lastResult: inspection });
      a.state.history.push({ targetId: target, isWerewolf: wolf, result: inspection });
      use(a, n);
      n.checks.add(id);
    }
    if (e.type === "witch_potion_used" || e.type === "witch_potion_skipped") {
      const n = begin();
      check(phase === Phase.Night && typeof p.actorId === "number" && !n.potions.has(p.actorId));
      const id = p.actorId,
        a = owned(n, id, "potion", p.abilityId),
        response = call(day, "witch", id);
      check(response.name === "use_potion");
      const target = response.args.target_id,
        potion = response.args.potion_type;
      check(
        equal(p, {
          actorId: id,
          targetId: target,
          potionType: potion,
          ...(id === maid ? { abilityId: a.id } : {}),
        }),
      );
      check(["heal", "poison", "none"].includes(potion));
      if (potion !== "none") check(n.start.includes(target));
      if (potion === "heal") {
        resolveKnife(n);
        check(a.state.heal === 1 && target !== id && n.knife === target);
        a.state.heal = 0;
        a.state.healUsedThisNight = true;
        n.heal = target;
        marks.get(target)!.add("HealMark");
      }
      if (potion === "poison") {
        check(a.state.poison === 1);
        a.state.poison = 0;
        a.state.poisonUsedThisNight = true;
        n.poisons.add(target);
        marks.get(target)!.add("PoisonMark");
      }
      use(a, n, potion !== "none");
      n.potions.add(id);
      check(e.type === (potion === "none" ? "witch_potion_skipped" : "witch_potion_used"));
    }
    if (e.type === "wolf_tactical_order") {
      const n = begin();
      check(
        phase === Phase.Night &&
          !n.wolfOrder &&
          Array.isArray(p.order) &&
          equal(
            [...p.order].sort((a, b) => Number(a) - Number(b)),
            chat(n).sort((a, b) => a - b),
          ) &&
          equal(
            e.audience,
            pack(n).sort((a, b) => a - b),
          ),
      );
      n.wolfOrder = p.order as number[];
    }
    if (e.type === "wolf_discussion" || e.type === "wolf_discussion_ended") {
      const n = begin();
      check(
        phase === Phase.Night &&
          typeof p.actorId === "number" &&
          chat(n).includes(p.actorId) &&
          equal(
            e.audience,
            pack(n).sort((a, b) => a - b),
          ),
      );
      const d = rows(day, "wolf_discussion", p.actorId).find((d) => d.turn === p.round);
      check(d?.outcome.kind === "action" && d.outcome.action?.name === "speak_to_wolves");
      const a = d.outcome.action.args;
      check(
        e.type === (a.end_chat ? "wolf_discussion_ended" : "wolf_discussion") &&
          p[e.type === "wolf_discussion_ended" ? "reason" : "text"] === sanitizeSpeechText(a.text),
      );
    }
    if (e.type === "wolf_kill_vote_cast") {
      const n = begin();
      check(
        phase === Phase.Night &&
          typeof p.actorId === "number" &&
          pack(n).includes(p.actorId) &&
          !n.wolfVotes.has(p.actorId) &&
          equal(
            e.audience,
            pack(n).sort((a, b) => a - b),
          ),
      );
      const a = call(day, "wolf_vote", p.actorId);
      check(
        a.name === "kill_vote" &&
          equal(a.args, { target_id: p.targetId, abstain: p.abstain }) &&
          !p.fallback,
      );
      check(
        typeof p.abstain === "boolean" &&
          (p.abstain ? true : typeof p.targetId === "number" && n.start.includes(p.targetId)),
      );
      n.wolfVotes.set(p.actorId, p.abstain ? null : (p.targetId as number));
      if (n.wolfVotes.size === pack(n).length) resolveKnife(n);
    }
    if (e.type === "night_resolved") {
      const n = begin();
      check(
        phase === Phase.Day &&
          n.closed === "committed" &&
          !n.settled &&
          n.damage &&
          equal(p, { deaths: n.damage.deaths }),
      );
      n.settled = true;
      for (const id of n.damage.deaths) alive.delete(id);
    }
    if (e.type === "dream_death") {
      const n = begin();
      check(n.settled && equal(p, n.reasons[n.reasonsSeen++]));
    }
    if (e.type === "vote_cast") {
      check(
        phase === Phase.Voting &&
          typeof p.actorId === "number" &&
          p.actorId === [...alive].filter((id) => !exileCandidates?.includes(id))[ballots.length],
      );
      const b = ballot(p.actorId);
      check(equal(p, b));
      const { fallback: _fallback, ...data } = b;
      ballots.push(data);
    }
    if (e.type === "vote_summary") {
      check(
        phase === Phase.Voting &&
          (p.round ?? 1) === exileRound &&
          ballots.length === [...alive].filter((id) => !exileCandidates?.includes(id)).length &&
          equal(p.votes, ballots),
      );
      const tally: Record<number, number> = {};
      for (const b of ballots)
        if (!b.abstain && b.targetId !== null)
          tally[b.targetId] = (tally[b.targetId] ?? 0) + b.weight;
      const max = Math.max(0, ...Object.values(tally)),
        top = Object.entries(tally)
          .filter(([, x]) => x === max)
          .map(([id]) => Number(id))
          .sort((a, b) => a - b);
      exileExpected = top.length === 1 ? top[0]! : null;
      exileTallied = true;
      check(equal(p.tally, tally) && p.target === exileExpected);
      if (exileRound === 1 && top.length > 1) exileCandidates = top;
    }
    if (e.type === "exile_pk_started") {
      check(
        phase === Phase.Voting &&
          exileRound === 1 &&
          exileTallied &&
          exileCandidates &&
          equal(p.candidates, exileCandidates),
      );
      exileRound = 2;
      ballots = [];
      exileExpected = null;
      exileTallied = false;
    }
    if (e.type === "voted_out") {
      check(
        phase === Phase.Voting &&
          exileTallied &&
          typeof p.target === "number" &&
          p.target === exileExpected &&
          alive.has(p.target),
      );
      alive.delete(p.target);
    }
    if (e.type === "wolf_self_destruct") {
      check(
        typeof p.wolfId === "number" &&
          roster.get(p.wolfId)?.role === Role.Wolf &&
          alive.has(p.wolfId) &&
          ["on_pre_election", "on_pre_vote"].includes(String(p.window)),
      );
      const a = call(day, String(p.window), p.wolfId);
      check(a.name === "self_destruct" && a.args.confirm === true);
      alive.delete(p.wolfId);
      begin().blast = true;
    }
    if (e.type === "last_words_granted")
      check(
        typeof p.playerId === "number" &&
          !alive.has(p.playerId) &&
          (p.phase === Phase.Voting || (p.phase === Phase.Day && p.day === 1)),
      );
    if (e.type === "last_words_spoken") {
      check(typeof p.playerId === "number" && !alive.has(p.playerId));
      const a = call(day, "last_words", p.playerId);
      check(a.name === "speak" && p.text === sanitizeSpeechText(a.args.text));
    }
    if (e.type === "sheriff_elected") {
      check(
        sheriff === null &&
          p.winnerId === election.winner &&
          typeof p.winnerId === "number" &&
          alive.has(p.winnerId),
      );
      sheriff = p.winnerId;
      for (const id of alive) {
        badges.set(id, {
          isSheriff: id === sheriff,
          destroyed: false,
          voteWeight: 1.5,
          handoffPolicy: "awa_holder_choice_v1",
        });
        votes.get(id)!.weight = id === sheriff ? 1.5 : 1;
      }
    }
    if (e.type === "sheriff_direction_chosen")
      check(
        phase === Phase.Day &&
          p.sheriffId === sheriff &&
          typeof sheriff === "number" &&
          alive.has(sheriff),
      );
    if (e.type === "sheriff_badge_transferred") {
      check(
        p.fromId === sheriff &&
          typeof p.toId === "number" &&
          alive.has(p.toId) &&
          badgeChoice(sheriff!) === p.toId,
      );
      const old = sheriff!;
      badges.get(old)!.isSheriff = false;
      badges.get(old)!.destroyed = true;
      votes.get(old)!.weight = 1;
      badges.set(p.toId, {
        isSheriff: true,
        destroyed: false,
        voteWeight: 1.5,
        handoffPolicy: "awa_holder_choice_v1",
      });
      votes.get(p.toId)!.weight = 1.5;
      sheriff = p.toId;
    }
    if (e.type === "sheriff_badge_destroyed") {
      check(p.targetId === sheriff && badgeChoice(sheriff!) === null);
      badges.get(sheriff!)!.isSheriff = false;
      badges.get(sheriff!)!.destroyed = true;
      votes.get(sheriff!)!.weight = 1;
      sheriff = null;
    }
    if (e.type === "game_over") {
      check(phase === Phase.GameOver && result === null);
      const expected = ![...alive].some((id) => roster.get(id)!.camp === Camp.Wolf)
        ? Camp.Good
        : ![...alive].some((id) => roster.get(id)!.role === Role.Villager) ||
            ![...alive].some(
              (id) => roster.get(id)!.camp === Camp.Good && roster.get(id)!.role !== Role.Villager,
            )
          ? Camp.Wolf
          : null;
      if (p.reason === "max_days_reached")
        check(p.winner === null && day > record.metadata.maxDays);
      else {
        const winners = [...roster.values()]
          .filter((p) => p.camp === expected)
          .map((p) => p.id)
          .sort((a, b) => a - b);
        check(
          expected !== null &&
            p.winner === expected &&
            p.reason ===
              (expected === Camp.Good ? "all_wolves_eliminated" : "slaughter_side_completed") &&
            equal(p.outcome, {
              kind: "victory",
              primary: { kind: "faction", faction: expected, winningPlayerIds: winners },
              additional: [],
              winningPlayerIds: winners,
            }),
        );
      }
      result = p as unknown as NonNullable<typeof result>;
    }
    for (const cp of checkpoints.get(index + 1) ?? []) checkpoint(cp);
  }
  if (record.finalized) {
    check(operation === nightOperations.length);
    for (const n of nights.values()) check(n.closed !== null);
  }
  if (record.operations.length && !record.finalized) {
    const complete = [...nights.values()].filter((n) => n.closed === "committed");
    check(complete.length === nightOperations.length);
    for (let i = 0; i < complete.length; i++)
      check(equal(complete[i]!.damage, nightOperations[i]!.output));
  }
  // Request eligibility and observer evidence are checked separately from event/state reconstruction.
  validateRadiantRequests(record, { roster, alive, nights, maid, count, seer, witch, dreamer });
}
import { validateRadiantRequests } from "./radiant_eclipse_requests";
