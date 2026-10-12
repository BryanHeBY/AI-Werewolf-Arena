/**
 * Responsibility: independently verify recorded magician execution evidence.
 * Input: immutable reproduction decisions, facts, operations and checkpoints;
 * output: accepted evidence or the existing stable reproduction rejection.
 * This verifier owns its reconstructed arithmetic/state and never authorizes
 * engine actions, pays resources or invokes production settlement as its oracle.
 * Shared readers only establish data shape; historical success and failure
 * prefixes, causal cursors and feature-specific policy checks remain unchanged.
 */
import { readWolfSorcererExchangeFact } from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
import { readTricksterExchangeFact } from "@ai-werewolf-arena/game-contract/facts/trickster";
import { isMagicianPreset } from "../verification/board-support";
import {
  readMagicianExchangeFact,
  readMagicianOwnExchangeFact,
  readDeathShotMissFact,
} from "@ai-werewolf-arena/game-contract/facts/magician";
import { Camp, Role, Phase, DeathCause } from "../core/domain";
import type { RecordedDecision, ReproductionRecord } from "./reproduction";
import { inferMagicianGunSources } from "./magician_action_evidence";
const exchange = "magician_exchange_committed",
  miss = "death_shot_missed";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_magician_state_invalid");
}
function stable(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(value));
}
function equal(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}
function pairFromDecision(d: RecordedDecision): [number, number] | null {
  assert(d.outcome.kind === "action" && d.outcome.action?.name === "swap_targets");
  const a = d.outcome.action.args;
  assert(Object.keys(a).sort().join(",") === "abstain,first_id,second_id");
  if (a.abstain) {
    assert(a.first_id === null && a.second_id === null);
    return null;
  }
  assert(
    a.abstain === false &&
      typeof a.first_id === "number" &&
      typeof a.second_id === "number" &&
      a.first_id !== a.second_id,
  );
  return [a.first_id, a.second_id].sort((x, y) => x - y) as [number, number];
}
/** Audit the finite original roster, exchanges, private facts and mapped misses independently of replay. */
export function validateMagicianRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard,
    owns = board.roleSetups.some((r) => r.role === Role.Magician && r.count > 0);
  const artifacts =
    record.events.some((e) => e.type === exchange || e.type === miss) ||
    record.decisions.some(
      (d) =>
        d.stage === "magician_exchange" ||
        d.request.allowedTools.includes("swap_targets") ||
        d.request.context.swap_candidates !== undefined,
    ) ||
    record.checkpoints.some((c) =>
      c.players.some((p) => Object.hasOwn(p.privateState, "magician")),
    );
  if (!owns) {
    assert(!board.magician && !artifacts);
    return;
  }
  assert(isMagicianPreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal);
  const config = board.magician!,
    original = new Map(record.metadata.players.map((p) => [p.id, p]));
  for (const row of board.roleSetups)
    assert(record.metadata.players.filter((p) => p.role === row.role).length === row.count);
  for (const player of original.values())
    assert(
      player.camp ===
        ([Role.Wolf, Role.WolfKing, Role.Trickster, Role.WolfSorcerer].includes(player.role)
          ? Camp.Wolf
          : Camp.Good),
    );
  type Native = {
    id: string;
    kind: "seer_check" | "potion";
    source: { kind: "native"; role: Role };
    state: Record<string, unknown>;
    sourceDisclosed: boolean;
    startsOnDay: number;
    maxUses: null;
    uses: number;
    lastUsedDay: number | null;
    disabled: boolean;
  };
  const native = new Map<number, Native>();
  for (const p of original.values()) {
    const kind = p.role === Role.Seer ? "seer_check" : p.role === Role.Witch ? "potion" : null;
    if (!kind) continue;
    const state: Record<string, unknown> =
      kind === "seer_check"
        ? { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] }
        : {
            heal: 1,
            poison: 1,
            selfHealRule: "disabled",
            canSelfHeal: false,
            healUsedThisNight: false,
            poisonUsedThisNight: false,
          };
    native.set(p.id, {
      id: "native:" + kind,
      kind,
      source: { kind: "native", role: p.role },
      state,
      sourceDisclosed: true,
      startsOnDay: 1,
      maxUses: null,
      uses: 0,
      lastUsedDay: null,
      disabled: false,
    });
  }
  const nativePrefixes = [structuredClone(native)];
  const nativeTurns = new Set<string>();
  const actors = record.metadata.players.filter((p) => p.role === Role.Magician);
  assert(original.size === 12 && actors.length === 1 && actors[0]!.camp === Camp.Good);
  const actorId = actors[0]!.id,
    alive = new Set(original.keys()),
    used = new Set<number>();
  const livingPrefixes: number[][] = [[...alive]],
    gunPrefixes: number[][] = [[]];
  const history: Array<{ day: number; pair: [number, number] | null }> = [],
    histories = [structuredClone(history)];
  const facts = new Map<number, { pair: [number, number] | null; index: number }>();
  const nightAlive = new Map<number, number[]>(),
    nightOrigins = new Set<number>(),
    gunEvents = new Set<number>();
  // Independent evidence ledger: never reuse the engine's eligibility predicate.
  const deathFacts = new Map<number, { day: number; phase: Phase; sources: DeathCause[] }>();
  const gunPolicy = (id: number) =>
    original.get(id)?.role === Role.WolfKing
      ? (board.wolfKing?.deathActionPolicy ?? "awa_qualified_sources_v1")
      : (board.hunter?.deathActionPolicy ?? "awa_qualified_sources_v1");
  const qualified = (id: number, sources: readonly DeathCause[], origin: Phase): boolean => {
    const policy = gunPolicy(id);
    if (policy === "awa_day_deaths_v1" && origin !== Phase.Day && origin !== Phase.Voting)
      return false;
    return (
      sources.length > 0 &&
      sources.every(
        (source) =>
          source === DeathCause.WolfKill ||
          source === DeathCause.MechanicalKnife ||
          source === DeathCause.AwakenedHiddenKnife ||
          source === DeathCause.Exile ||
          (policy !== "awa_knife_or_exile_v1" &&
            (source === DeathCause.Shot || source === DeathCause.WhiteWolfBlast)),
      )
    );
  };
  const causes = new Map<number, DeathCause[]>(),
    votes = new Map<number, number | null>();
  let healed: number | null = null,
    poisoned: number | null = null;
  const pendingBlasts = new Set<number>(),
    resolvedNights = new Set<number>(),
    completedNightActions = new Set<number>();
  let day = 1,
    phase: Phase = Phase.Night;
  nightAlive.set(1, [...alive]);
  const sorcererPairs = new Map<number, [number, number] | null>();
  const cancelled = new Set<number>();
  const swap = (id: number, n: number) => {
    const sorcerer = sorcererPairs.get(n);
    const intermediate = sorcerer
      ? id === sorcerer[0]
        ? sorcerer[1]
        : id === sorcerer[1]
          ? sorcerer[0]
          : id
      : id;
    const pair = cancelled.has(n) ? null : facts.get(n)?.pair;
    return pair
      ? intermediate === pair[0]
        ? pair[1]
        : intermediate === pair[1]
          ? pair[0]
          : intermediate
      : intermediate;
  };
  const shotDecision = (id: number) =>
    record.decisions.filter(
      (d) =>
        d.actorId === id &&
        d.day === day &&
        ["hunter_shot", "death_shot"].includes(d.stage) &&
        d.outcome.kind === "action" &&
        d.outcome.action?.name === "shoot",
    );
  for (let index = 0; index < record.events.length; index++) {
    const e = record.events[index]!;
    if (e.type === "phase_changed") {
      assert(
        typeof e.payload.day === "number" &&
          Number.isSafeInteger(e.payload.day) &&
          e.payload.day > 0,
      );
      day = e.payload.day;
      phase = e.payload.phase as Phase;
      // First-day sheriff actions precede night_resolved, but follow every night action.
      if (phase === Phase.Day) completedNightActions.add(day);
      if (phase === Phase.Night) {
        nightAlive.set(day, [...alive]);
        nightOrigins.clear();
        votes.clear();
        healed = null;
        poisoned = null;
        pendingBlasts.clear();
      }
    }
    if (e.type === exchange) {
      const fact = readMagicianExchangeFact(e.type, e.payload);
      assert(
        fact &&
          fact.actorId === actorId &&
          fact.day === day &&
          phase === Phase.Night &&
          day >= config.firstNight &&
          alive.has(actorId) &&
          !facts.has(day),
      );
      assert(e.audience?.length === 1 && e.audience[0] === actorId);
      const candidates = [...alive].filter((id) => !used.has(id));
      assert(candidates.length >= 2);
      const decisions = record.decisions.filter(
        (d) => d.day === day && d.stage === "magician_exchange",
      );
      assert(decisions.length === 1);
      const d = decisions[0]!;
      assert(
        d.actorId === actorId &&
          d.request.actorId === actorId &&
          d.request.phase === Phase.Night &&
          d.request.context.day === day &&
          d.request.context.stage === "magician_exchange" &&
          d.request.context.action_failure_policy === "error" &&
          d.request.context.allow_fallback === false &&
          equal(d.request.allowedTools, ["swap_targets"]) &&
          equal(d.request.context.swap_candidates, candidates),
      );
      assert(equal(pairFromDecision(d), fact.pair));
      if (fact.pair)
        for (const id of fact.pair) {
          assert(candidates.includes(id));
          used.add(id);
        }
      history.push({ day, pair: fact.pair });
      facts.set(day, { pair: fact.pair, index });
    }
    if (e.type === "wolf_sorcerer_exchange_committed") {
      const f = readWolfSorcererExchangeFact(e.type, e.payload);
      assert(
        f &&
          f.day === day &&
          phase === Phase.Night &&
          !resolvedNights.has(day) &&
          !sorcererPairs.has(day),
      );
      sorcererPairs.set(day, f.pair);
    }
    if (e.type === "trickster_exchange_committed") {
      const f = readTricksterExchangeFact(e.type, e.payload);
      assert(f && f.day === day && phase === Phase.Night && !resolvedNights.has(day));
      if (f.pair && equal(f.pair, facts.get(day)?.pair)) cancelled.add(day);
    }
    if (e.type === "wolf_kill_vote_cast") {
      const id = e.payload.actorId,
        target = e.payload.targetId;
      assert(
        typeof id === "number" &&
          original.get(id)?.camp === Camp.Wolf &&
          alive.has(id) &&
          !votes.has(id) &&
          e.payload.fallback !== true,
      );
      assert(target === null || (typeof target === "number" && alive.has(target)));
      const d = record.decisions.find(
        (d) => d.day === day && d.actorId === id && d.stage === "wolf_vote",
      );
      assert(
        d?.outcome.kind === "action" &&
          d.outcome.action?.name === "kill_vote" &&
          (d.outcome.action.args.abstain
            ? target === null
            : d.outcome.action.args.target_id === target),
      );
      votes.set(id, target as number | null);
    }
    if (
      e.type === "seer_checked" ||
      e.type === "witch_potion_used" ||
      e.type === "witch_potion_skipped"
    ) {
      const id = e.payload.actorId;
      assert(
        typeof id === "number" &&
          alive.has(id) &&
          phase === Phase.Night &&
          !resolvedNights.has(day),
      );
      const ability = native.get(id),
        isSeer = e.type === "seer_checked",
        stage = isSeer ? "seer" : "witch";
      assert(
        ability &&
          ability.kind === (isSeer ? "seer_check" : "potion") &&
          e.payload.abilityId === undefined,
      );
      const key = day + ":" + id + ":" + stage;
      assert(!nativeTurns.has(key));
      nativeTurns.add(key);
      const decisions = record.decisions.filter(
        (d) => d.day === day && d.actorId === id && d.stage === stage,
      );
      assert(decisions.length === 1);
      const d = decisions[0]!;
      assert(
        d.outcome.kind === "action" &&
          d.outcome.action &&
          d.request.actorId === id &&
          d.request.context.day === day &&
          d.request.context.stage === stage &&
          d.request.phase === Phase.Night,
      );
      const action = d.outcome.action;
      if (isSeer) {
        for (const [witchId, stock] of native)
          if (stock.kind === "potion" && nightAlive.get(day)?.includes(witchId))
            assert(nativeTurns.has(day + ":" + witchId + ":witch"));
        const target = e.payload.targetId;
        assert(
          typeof target === "number" &&
            alive.has(target) &&
            action.name === "check_identity" &&
            action.args.target_id === target,
        );
        const result = { kind: "camp", camp: original.get(swap(target, day))!.camp },
          wolf = result.camp === Camp.Wolf;
        assert(e.payload.isWerewolf === wolf && equal(e.payload.result, result));
        ability.state.lastTarget = target;
        ability.state.lastIsWerewolf = wolf;
        ability.state.lastResult = { ...result };
        (ability.state.history as unknown[]).push({
          targetId: target,
          isWerewolf: wolf,
          result: { ...result },
        });
        ability.uses++;
      } else {
        assert(action.name === "use_potion");
        ability.state.healUsedThisNight = false;
        ability.state.poisonUsedThisNight = false;
        if (e.type === "witch_potion_skipped") assert(action.args.potion_type === "none");
        else {
          const kind = e.payload.potionType,
            target = e.payload.targetId;
          assert(
            (kind === "heal" || kind === "poison") &&
              action.args.potion_type === kind &&
              action.args.target_id === target &&
              typeof target === "number" &&
              alive.has(target),
          );
          assert(ability.state[kind] === 1);
          if (kind === "heal") {
            const tally = new Map<number, number>();
            for (const target of votes.values())
              if (target !== null) tally.set(target, (tally.get(target) ?? 0) + 1);
            const raw = [...tally].sort(([a, n], [b, m]) => m - n || a - b)[0]?.[0] ?? null;
            assert(target !== id && target === raw);
          }
          ability.state[kind] = 0;
          ability.state[kind === "heal" ? "healUsedThisNight" : "poisonUsedThisNight"] = true;
          ability.uses++;
        }
      }
      ability.lastUsedDay = day;
    }
    if (e.type === "witch_potion_used") {
      const id = e.payload.actorId,
        target = e.payload.targetId;
      assert(
        typeof id === "number" &&
          original.get(id)?.role === Role.Witch &&
          alive.has(id) &&
          typeof target === "number" &&
          alive.has(target),
      );
      const d = record.decisions.find(
        (d) => d.day === day && d.actorId === id && d.stage === "witch",
      );
      assert(
        d?.outcome.kind === "action" &&
          d.outcome.action?.name === "use_potion" &&
          d.outcome.action.args.target_id === target &&
          d.outcome.action.args.potion_type === e.payload.potionType,
      );
      if (e.payload.potionType === "heal") {
        assert(healed === null);
        healed = swap(target, day);
      } else {
        assert(e.payload.potionType === "poison" && poisoned === null);
        poisoned = swap(target, day);
      }
    }
    if (e.type === "night_resolved") {
      assert(Array.isArray(e.payload.deaths));
      const before = history.filter((h) => h.day < day),
        spent = new Set(before.flatMap((h) => h.pair ?? []));
      const available = nightAlive.get(day)!.filter((id) => !spent.has(id));
      if (
        day >= config.firstNight &&
        nightAlive.get(day)!.includes(actorId) &&
        available.length >= 2
      )
        assert(facts.has(day));
      resolvedNights.add(day);
      const deaths = e.payload.deaths as number[];
      assert(new Set(deaths).size === deaths.length);
      const tally = new Map<number, number>();
      for (const target of votes.values())
        if (target !== null) tally.set(target, (tally.get(target) ?? 0) + 1);
      const raw = [...tally].sort(([a, n], [b, m]) => m - n || a - b)[0]?.[0] ?? null;
      const knife = raw === null ? null : swap(raw, day),
        expected = new Map<number, DeathCause[]>();
      if (knife !== null && knife !== healed && (alive.has(knife) || pendingBlasts.has(knife)))
        expected.set(knife, [DeathCause.WolfKill]);
      if (poisoned !== null && (alive.has(poisoned) || pendingBlasts.has(poisoned)))
        expected.set(poisoned, [...(expected.get(poisoned) ?? []), DeathCause.Poison]);
      assert(
        equal(
          [...deaths].sort((a, b) => a - b),
          [...expected.keys()].sort((a, b) => a - b),
        ),
      );
      for (const id of deaths) {
        assert(alive.has(id) || pendingBlasts.has(id));
        alive.delete(id);
        nightOrigins.add(id);
        causes.set(id, [
          ...expected.get(id)!,
          ...(pendingBlasts.has(id) ? [DeathCause.SelfDestruct] : []),
        ]);
        deathFacts.set(id, { day, phase: Phase.Night, sources: [...causes.get(id)!] });
      }
    }
    if (e.type === "voted_out" || e.type === "wolf_self_destruct") {
      const id = e.type === "voted_out" ? e.payload.target : e.payload.wolfId;
      assert(typeof id === "number" && alive.has(id));
      if (e.type === "wolf_self_destruct" && !resolvedNights.has(day)) pendingBlasts.add(id);
      alive.delete(id);
      nightOrigins.delete(id);
      causes.set(id, [e.type === "voted_out" ? DeathCause.Exile : DeathCause.SelfDestruct]);
      deathFacts.set(id, {
        day,
        phase: e.type === "voted_out" ? Phase.Voting : Phase.Day,
        sources: [...causes.get(id)!],
      });
    }
    if (e.type === "hunter_shot" || e.type === "wolf_king_shot" || e.type === miss) {
      const id = e.type === "hunter_shot" ? e.payload.hunterId : e.payload.actorId;
      assert(typeof id === "number" && !alive.has(id) && !gunEvents.has(id));
      assert(
        original.get(id)?.role ===
          (e.type === "hunter_shot"
            ? Role.Hunter
            : e.type === "wolf_king_shot"
              ? Role.WolfKing
              : original.get(id)?.role),
      );
      assert(original.get(id)?.role === Role.Hunter || original.get(id)?.role === Role.WolfKing);
      assert(qualified(id, causes.get(id) ?? [], nightOrigins.has(id) ? Phase.Night : Phase.Day));
      const ds = shotDecision(id);
      assert(ds.length === 1);
      const d = ds[0]!;
      assert(d.outcome.kind === "action" && d.outcome.action?.name === "shoot");
      assert(
        equal(
          [...(d.request.context.death_sources ?? [])].sort(),
          [...(causes.get(id) ?? [])].sort(),
        ),
      );
      const raw = d.outcome.action.args.target_id,
        candidates = d.request.context.shoot_candidates;
      assert(
        typeof raw === "number" &&
          original.has(raw) &&
          Array.isArray(candidates) &&
          candidates.includes(raw) &&
          new Set(candidates).size === candidates.length &&
          candidates.every((x) => original.has(x)) &&
          !candidates.includes(id),
      );
      const mapped =
        nightOrigins.has(id) && config.deathShotTargetPolicy === "exchanged" ? swap(raw, day) : raw;
      if (e.type === miss) {
        assert(
          readDeathShotMissFact(e.type, e.payload) &&
            e.audience === undefined &&
            nightOrigins.has(id) &&
            config.deathShotTargetPolicy === "exchanged",
        );
        assert(
          mapped !== raw &&
            !alive.has(mapped) &&
            !candidates.includes(mapped) &&
            (facts.has(day) || sorcererPairs.has(day)),
        );
      } else {
        assert(e.payload.targetId === mapped && alive.has(mapped));
        alive.delete(mapped);
        causes.set(mapped, [DeathCause.Shot]);
        deathFacts.set(mapped, {
          day,
          phase: nightOrigins.has(id) ? Phase.Night : phase,
          sources: [DeathCause.Shot],
        });
        if (nightOrigins.has(id)) nightOrigins.add(mapped);
        else nightOrigins.delete(mapped);
      }
      gunEvents.add(id);
    }
    nativePrefixes.push(structuredClone(native));
    histories.push(structuredClone(history));
    livingPrefixes.push([...alive]);
    gunPrefixes.push([...gunEvents]);
  }
  for (const night of new Set([...resolvedNights, ...completedNightActions])) {
    const living = nightAlive.get(night);
    assert(living);
    for (const [id, ability] of native)
      if (living.includes(id)) {
        const stage = ability.kind === "seer_check" ? "seer" : "witch";
        assert(nativeTurns.has(night + ":" + id + ":" + stage));
      }
  }
  const checkpointedCycle = Math.max(0, ...record.checkpoints.map((cp) => cp.cycle));
  const requestedGuns = new Set<number>();
  for (const d of record.decisions) {
    const unpublished = !record.finalized && d.day > checkpointedCycle;
    if (
      ["hunter_shot", "death_shot"].includes(d.stage) ||
      d.request.allowedTools.includes("shoot")
    ) {
      assert(!requestedGuns.has(d.actorId));
      requestedGuns.add(d.actorId);
      const fact = deathFacts.get(d.actorId),
        role = original.get(d.actorId)?.role;
      assert(role === Role.Hunter || role === Role.WolfKing);
      assert(
        d.stage === (role === Role.Hunter ? "hunter_shot" : "death_shot") &&
          d.request.actorId === d.actorId &&
          d.request.context.day === d.day &&
          d.request.context.stage === d.stage &&
          equal(d.request.allowedTools, ["shoot"]),
      );
      const sources = d.request.context.death_sources;
      const previous = record.checkpoints.find((cp) => cp.cycle === d.day - 1 && cp.complete);
      const living =
        nightAlive.get(d.day) ?? previous?.players.filter((p) => p.alive).map((p) => p.id);
      assert(living && Array.isArray(sources) && d.request.context.ability_id === undefined);
      const inferred = inferMagicianGunSources(record, d, living);
      assert(inferred && equal([...sources].sort(), [...inferred.sources].sort()));
      const origin = inferred.origin;
      assert(qualified(d.actorId, sources, origin));
      assert(
        origin === Phase.Night
          ? d.request.phase === Phase.Night || d.request.phase === Phase.Day
          : d.request.phase === origin,
      );
      const legacyPhase = sources.includes(DeathCause.Shot) ? d.request.phase : origin;
      assert(d.request.context.death_phase === legacyPhase);
      if (gunPolicy(d.actorId) === "awa_day_deaths_v1")
        assert(d.request.context.death_origin_phase === origin);
      else if (d.request.context.death_origin_phase !== undefined)
        assert(d.request.context.death_origin_phase === origin);
      // The factory still supplies its visible death announcement; actions prove its content.
      assert(
        d.request.context.visible_events.some(
          (e) =>
            (sources.includes(DeathCause.Exile) &&
              e.type === "voted_out" &&
              e.payload.target === d.actorId) ||
            (sources.includes(DeathCause.WolfKill) &&
              e.type === "night_resolved" &&
              Array.isArray(e.payload.deaths) &&
              e.payload.deaths.includes(d.actorId)) ||
            (sources.includes(DeathCause.Shot) &&
              (e.type === "hunter_shot" ||
                e.type === "wolf_king_shot" ||
                e.type === "player_shot") &&
              e.payload.targetId === d.actorId),
        ),
      );
      if (fact)
        assert(
          fact.day === d.day &&
            qualified(d.actorId, fact.sources, fact.phase) &&
            origin === fact.phase &&
            equal([...sources].sort(), [...fact.sources].sort()),
        );
      else assert(unpublished);
    }
    if (d.request.phase === Phase.Day || d.request.phase === Phase.Voting) {
      const previous = record.checkpoints.find((cp) => cp.cycle === d.day - 1 && cp.complete);
      const living =
        nightAlive.get(d.day) ??
        (unpublished && previous && !previous.snapshot.gameOver
          ? previous.players.filter((p) => p.alive).map((p) => p.id)
          : undefined);
      assert(living);
      for (const [id, stock] of native) {
        if (!living.includes(id)) continue;
        const stage = stock.kind === "seer_check" ? "seer" : "witch";
        const prior = record.decisions.filter(
          (row) => row.day === d.day && row.actorId === id && row.stage === stage,
        );
        assert(prior.length === 1);
        const turn = prior[0]!;
        assert(
          turn.outcome.kind === "action" &&
            turn.outcome.action?.name === (stage === "seer" ? "check_identity" : "use_potion") &&
            typeof turn.settleOrder === "number" &&
            turn.settleOrder <= d.openedAfterSettlement,
        );
      }
    }
    if (
      d.stage === "seer" ||
      d.stage === "witch" ||
      d.request.allowedTools.some((tool) => tool === "check_identity" || tool === "use_potion")
    ) {
      assert(d.stage === "seer" || d.stage === "witch");
      assert(
        d.request.actorId === d.actorId &&
          d.request.context.day === d.day &&
          d.request.context.stage === d.stage &&
          d.request.phase === Phase.Night,
      );
      // A trace can publish the next request before publishing that night's facts.
      // The previous complete checkpoint still proves its starting live roster.
      const previous = record.checkpoints.find((cp) => cp.cycle === d.day - 1 && cp.complete);
      const living =
        nightAlive.get(d.day) ??
        (unpublished && previous && !previous.snapshot.gameOver
          ? previous.players.filter((p) => p.alive).map((p) => p.id)
          : undefined);
      assert(living);
      assert(
        original.get(d.actorId)?.role === (d.stage === "seer" ? Role.Seer : Role.Witch) &&
          living.includes(d.actorId),
      );
      assert(equal(d.request.allowedTools, [d.stage === "seer" ? "check_identity" : "use_potion"]));
      if (d.stage === "seer")
        for (const [witchId, stock] of native)
          if (stock.kind === "potion" && living.includes(witchId)) {
            const prior = record.decisions.filter(
              (row) => row.day === d.day && row.actorId === witchId && row.stage === "witch",
            );
            assert(prior.length === 1);
            const turn = prior[0]!;
            assert(
              turn.outcome.kind === "action" &&
                turn.outcome.action?.name === "use_potion" &&
                typeof turn.settleOrder === "number" &&
                turn.settleOrder <= d.openedAfterSettlement,
            );
            if (!unpublished) assert(nativeTurns.has(d.day + ":" + witchId + ":witch"));
          }
      assert(
        record.decisions.filter(
          (row) => row.day === d.day && row.actorId === d.actorId && row.stage === d.stage,
        ).length === 1,
      );
      if (record.checkpoints.some((cp) => cp.complete && cp.cycle >= d.day))
        assert(nativeTurns.has(d.day + ":" + d.actorId + ":" + d.stage));
    }
    // Event-dependent exchange checks wait for this cycle's actual event prefix.
    if (unpublished) continue;
    if (d.stage === "magician_exchange") {
      assert(
        d.actorId === actorId && d.day >= config.firstNight && d.request.phase === Phase.Night,
      );
      const before = history.filter((h) => h.day < d.day),
        spent = new Set(before.flatMap((h) => h.pair ?? []));
      const candidates = nightAlive.get(d.day)?.filter((id) => !spent.has(id));
      assert(
        candidates &&
          nightAlive.get(d.day)!.includes(actorId) &&
          candidates.length >= 2 &&
          equal(d.request.context.swap_candidates, candidates),
      );
      if (record.checkpoints.some((c) => c.cycle >= d.day && c.complete)) assert(facts.has(d.day));
    } else assert(d.request.context.swap_candidates === undefined);
    for (const e of d.request.context.visible_events) {
      if (e.type === exchange) {
        const fact = readMagicianOwnExchangeFact(e.type, e.payload);
        assert(
          d.actorId === actorId &&
            fact &&
            fact.day <= d.day &&
            equal(fact.pair, facts.get(fact.day)?.pair),
        );
      }
      if (e.type === miss)
        assert(
          readDeathShotMissFact(e.type, e.payload) &&
            record.events.some(
              (source) => source.type === miss && equal(source.payload, e.payload),
            ),
        );
    }
  }
  for (const cp of record.checkpoints) {
    if (cp.complete && cp.cycle > 0)
      assert(resolvedNights.has(cp.cycle) && nightAlive.has(cp.cycle));
    assert(cp.eventCount >= 0 && cp.eventCount < histories.length);
    const players = new Map(cp.players.map((p) => [p.id, p]));
    assert(players.size === original.size);
    for (const [id, initial] of original) {
      const p = players.get(id);
      assert(
        p &&
          p.role === initial.role &&
          p.camp === initial.camp &&
          p.name === initial.name &&
          p.alive === livingPrefixes[cp.eventCount]!.includes(id),
      );
      if (id === actorId)
        assert(
          equal(p.privateState, {
            magician: {
              policy: config.policy,
              firstNight: config.firstNight,
              deathShotTargetPolicy: config.deathShotTargetPolicy,
              history: histories[cp.eventCount],
            },
          }),
        );
      else assert(!Object.hasOwn(p.privateState, "magician"));
      const ability = structuredClone(nativePrefixes[cp.eventCount]!.get(id));
      if (ability) {
        if (
          ability.kind === "potion" &&
          ability.lastUsedDay !== cp.cycle &&
          nightAlive.get(cp.cycle)?.includes(id) &&
          record.decisions.some(
            (d) =>
              d.day === cp.cycle &&
              d.request.phase === Phase.Night &&
              d.stage !== "magician_exchange",
          )
        ) {
          ability.state.healUsedThisNight = false;
          ability.state.poisonUsedThisNight = false;
        }
        assert(equal(p.privateState, { abilities: { [ability.id]: ability } }));
      }
      if (initial.role === Role.Hunter || initial.role === Role.WolfKing) {
        const key = initial.role === Role.Hunter ? "hunter" : "wolf_king",
          state = p.privateState[key];
        assert(state && typeof state === "object" && !Array.isArray(state));
        const stock = state as Record<string, unknown>;
        assert(
          Object.keys(p.privateState).length === 1 &&
            Object.keys(stock).sort().join(",") ===
              (gunPolicy(id) === "awa_qualified_sources_v1"
                ? "canShoot"
                : "canShoot,deathActionPolicy") &&
            (gunPolicy(id) === "awa_qualified_sources_v1" ||
              stock.deathActionPolicy === gunPolicy(id)) &&
            typeof stock.canShoot === "boolean",
        );
        const decisions = record.decisions.filter(
          (d) =>
            d.actorId === id &&
            d.day <= cp.cycle &&
            ["hunter_shot", "death_shot"].includes(d.stage),
        );
        const passes = decisions.filter(
          (d) =>
            d.outcome.kind === "action" &&
            d.outcome.action?.name === "shoot" &&
            d.outcome.action.args.target_id === null,
        );
        if (p.alive) assert(stock.canShoot === true);
        if (passes.length) assert(stock.canShoot === false);
        if (
          decisions.some((d) => d.outcome.kind === "error") &&
          !gunPrefixes[cp.eventCount]!.includes(id) &&
          !passes.length
        )
          assert(stock.canShoot === true);
        if (cp.complete)
          for (const d of decisions)
            if (
              d.outcome.kind === "action" &&
              d.outcome.action?.name === "shoot" &&
              d.outcome.action.args.target_id !== null
            )
              assert(gunPrefixes[cp.eventCount]!.includes(id));
        if (gunPrefixes[cp.eventCount]!.includes(id) || (cp.complete && !p.alive))
          assert(stock.canShoot === false);
      }
    }
  }
}
