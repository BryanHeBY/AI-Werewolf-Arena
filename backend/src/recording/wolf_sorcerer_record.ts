import {
  isWolfSorcererPreset,
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
  readMagicianExchangeFact,
} from "@ai-werewolf-arena/game-text";
import { Camp, Role, Phase } from "../core/domain";
import type { ReproductionRecord } from "./reproduction";
const exchange = "wolf_sorcerer_exchange_committed",
  skip = "wolf_sorcerer_exchange_skipped";
function check(v: unknown): asserts v {
  if (!v) throw new Error("reproduction_wolf_sorcerer_invalid");
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
export function validateWolfSorcererRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard;
  const owns = board.roleSetups.some((r) => r.role === Role.WolfSorcerer && r.count > 0);
  const artifacts =
    record.events.some((e) => [exchange, skip].includes(e.type)) ||
    record.decisions.some(
      (d) =>
        d.stage === "wolf_sorcerer_exchange" ||
        d.request.allowedTools.includes("swap_night_seats") ||
        d.request.context.sorcerer_candidates !== undefined,
    ) ||
    record.checkpoints.some((c) =>
      c.players.some((p) => Object.hasOwn(p.privateState, "wolfSorcerer")),
    );
  if (!owns) {
    check(
      !board.wolfSorcerer &&
        !artifacts &&
        !record.metadata.players.some((p) => p.role === Role.WolfSorcerer),
    );
    return;
  }
  check(isWolfSorcererPreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal);
  const config = board.wolfSorcerer!;
  const original = new Map(record.metadata.players.map((p) => [p.id, p]));
  const actors = record.metadata.players.filter((p) => p.role === Role.WolfSorcerer);
  check(original.size === 12 && actors.length === 1 && actors[0]!.camp === Camp.Wolf);
  const actor = actors[0]!.id,
    alive = new Set(original.keys()),
    used = new Set<number>();
  const history: Array<{ day: number; pair: [number, number] | null }> = [];
  const histories = [structuredClone(history)],
    living = [[...alive]];
  const facts = new Map<number, { pair: [number, number] | null; index: number }>(),
    skipped = new Set<number>();
  const magic = new Map<number, [number, number] | null>(),
    nightAlive = new Map<number, number[]>([[1, [...alive]]]);
  const resolved = new Set<number>();
  const inspectionHistory: Array<{
    day: number;
    targetId: number;
    result: { kind: "role"; role: string };
  }> = [];
  const inspectionPrefixes = [structuredClone(inspectionHistory)];
  const inspectionsSeen = new Set<number>(),
    inspectionLastUsed: Array<number | null> = [null];
  let lastInspectionDay: number | null = null;
  const transpose = (id: number, pair: [number, number] | null | undefined) =>
    pair ? (id === pair[0] ? pair[1] : id === pair[1] ? pair[0] : id) : id;
  let day = 1,
    phase: Phase = Phase.Night;
  for (let i = 0; i < record.events.length; i++) {
    const e = record.events[i]!;
    if (e.type === "phase_changed") {
      check(Number.isSafeInteger(e.payload.day) && Number(e.payload.day) > 0);
      day = Number(e.payload.day);
      phase = e.payload.phase as Phase;
      if (phase === Phase.Night) {
        nightAlive.set(day, [...alive]);
      }
    }
    if (e.type === "magician_exchange_committed") {
      const f = readMagicianExchangeFact(e.type, e.payload);
      check(
        f &&
          phase === Phase.Night &&
          f.day === day &&
          !magic.has(day) &&
          !facts.has(day) &&
          !skipped.has(day),
      );
      magic.set(day, f.pair);
    }
    if (e.type === exchange || e.type === skip) {
      check(phase === Phase.Night && !facts.has(day) && !skipped.has(day) && !resolved.has(day));
      check(Array.isArray(e.audience) && equal(e.audience, [actor]));
      const candidates = [...alive].filter((id) => !used.has(id));
      if (e.type === skip) {
        const f = readWolfSorcererSkipFact(e.type, e.payload);
        check(f && f.actorId === actor && f.day === day);
        check(
          f.reason === "not_started"
            ? day < config.firstNight
            : day >= config.firstNight &&
                (f.reason === "dead"
                  ? !alive.has(actor)
                  : alive.has(actor) && candidates.length < 2),
        );
        check(!record.decisions.some((d) => d.day === day && d.stage === "wolf_sorcerer_exchange"));
        skipped.add(day);
      } else {
        const f = readWolfSorcererExchangeFact(e.type, e.payload);
        check(
          f &&
            f.actorId === actor &&
            f.day === day &&
            day >= config.firstNight &&
            alive.has(actor) &&
            candidates.length >= 2,
        );
        const ds = record.decisions.filter(
          (d) => d.day === day && d.stage === "wolf_sorcerer_exchange",
        );
        check(ds.length === 1);
        const d = ds[0]!;
        check(
          d.actorId === actor &&
            d.request.actorId === actor &&
            d.request.phase === Phase.Night &&
            d.request.context.day === day &&
            d.request.context.stage === d.stage,
        );
        check(
          d.request.context.action_failure_policy === "error" &&
            d.request.context.allow_fallback === false &&
            equal(d.request.allowedTools, ["swap_night_seats"]),
        );
        check(equal(d.request.context.sorcerer_candidates, candidates));
        check(d.outcome.kind === "action" && d.outcome.action?.name === "swap_night_seats");
        const a = d.outcome.action.args;
        if (a.abstain) check(a.first_id === null && a.second_id === null && f.pair === null);
        else {
          check(a.first_id !== null && a.second_id !== null && a.first_id !== a.second_id);
          check(
            equal([Math.min(a.first_id, a.second_id), Math.max(a.first_id, a.second_id)], f.pair),
          );
        }
        if (f.pair)
          for (const id of f.pair) {
            check(candidates.includes(id));
            used.add(id);
          }
        history.push({ day, pair: f.pair });
        facts.set(day, { pair: f.pair, index: i });
      }
    }
    if (e.type === "wolf_kill_vote_cast" || e.type === "witch_potion_used")
      check(facts.has(day) || skipped.has(day));
    if (
      ["wolf_kill_vote_cast", "wolf_discussion", "wolf_discussion_ended"].includes(e.type) &&
      e.payload.actorId === actor
    )
      check(day >= config.firstNight && (facts.has(day) || skipped.has(day)));
    if (e.type === "role_inspected" || e.type === "role_inspection_skipped") {
      const id = e.payload.actorId;
      check(
        typeof id === "number" &&
          original.get(id)?.role === Role.Psychic &&
          alive.has(id) &&
          phase === Phase.Night &&
          e.payload.day === day &&
          !inspectionsSeen.has(day) &&
          (facts.has(day) || skipped.has(day)),
      );
      check(e.payload.abilityId === undefined);
      const ds = record.decisions.filter(
        (d) => d.actorId === id && d.day === day && d.stage === "psychic",
      );
      check(ds.length === 1);
      const d = ds[0]!;
      check(d.outcome.kind === "action");
      const action = d.outcome.action;
      if (e.type === "role_inspected") {
        const raw = e.payload.targetId;
        check(
          typeof raw === "number" &&
            alive.has(raw) &&
            action?.name === "inspect_role" &&
            action.args.target_id === raw,
        );
        const effective = transpose(transpose(raw, facts.get(day)?.pair), magic.get(day));
        const result = { kind: "role" as const, role: original.get(effective)!.role };
        check(equal(e.payload.result, result));
        inspectionHistory.push({ day, targetId: raw, result });
      } else check(e.payload.reason === "passed" && action === null);
      inspectionsSeen.add(day);
      lastInspectionDay = day;
    }
    if (e.type === "night_resolved") {
      check(nightAlive.has(day) && (facts.has(day) || skipped.has(day)) && !resolved.has(day));
      check(Array.isArray(e.payload.deaths));
      for (const [id, p] of original)
        if (p.role === Role.Psychic && alive.has(id)) check(inspectionsSeen.has(day));
      resolved.add(day);
      for (const id of e.payload.deaths) {
        check(typeof id === "number" && original.has(id));
        alive.delete(id);
      }
    }
    if (e.type === "voted_out") {
      const id = e.payload.target;
      check(typeof id === "number" && alive.has(id));
      alive.delete(id);
    }
    if (e.type === "hunter_shot") {
      const id = e.payload.targetId;
      check(typeof id === "number" && alive.has(id));
      alive.delete(id);
    }
    if (e.type === "wolf_self_destruct") {
      check(
        typeof e.payload.wolfId === "number" &&
          original.get(e.payload.wolfId)?.camp === Camp.Wolf &&
          alive.has(e.payload.wolfId),
      );
      alive.delete(e.payload.wolfId);
    }
    histories.push(structuredClone(history));
    living.push([...alive]);
    inspectionPrefixes.push(structuredClone(inspectionHistory));
    inspectionLastUsed.push(lastInspectionDay);
  }
  const cycle = Math.max(0, ...record.checkpoints.map((c) => c.cycle));
  for (const d of record.decisions) {
    if (!record.finalized && d.day > cycle) continue;
    if (d.stage === "wolf_sorcerer_exchange") {
      const before = history.filter((h) => h.day < d.day),
        spent = new Set(before.flatMap((h) => h.pair ?? []));
      const candidates = nightAlive.get(d.day)?.filter((id) => !spent.has(id));
      check(
        d.actorId === actor &&
          d.day >= config.firstNight &&
          d.request.phase === Phase.Night &&
          candidates &&
          nightAlive.get(d.day)!.includes(actor) &&
          candidates.length >= 2,
      );
      check(equal(d.request.context.sorcerer_candidates, candidates));
      if (record.checkpoints.some((c) => c.cycle >= d.day && c.complete)) check(facts.has(d.day));
    } else check(d.request.context.sorcerer_candidates === undefined);
    for (const e of d.request.context.visible_events) {
      if (e.type === exchange || e.type === skip) {
        check(
          d.actorId === actor &&
            record.events.some(
              (source) => source.type === e.type && equal(source.payload, e.payload),
            ),
        );
        const f =
          e.type === exchange
            ? readWolfSorcererExchangeFact(e.type, e.payload)
            : readWolfSorcererSkipFact(e.type, e.payload);
        check(f && f.day <= d.day);
      }
    }
  }
  for (const cp of record.checkpoints) {
    check(cp.eventCount >= 0 && cp.eventCount < histories.length);
    if (cp.complete && cp.cycle > 0) check(resolved.has(cp.cycle));
    const players = new Map(cp.players.map((p) => [p.id, p]));
    check(players.size === original.size);
    for (const [id, initial] of original) {
      const p = players.get(id);
      check(
        p &&
          p.role === initial.role &&
          p.camp === initial.camp &&
          p.name === initial.name &&
          p.alive === living[cp.eventCount]!.includes(id),
      );
      if (id === actor)
        check(
          equal(p.privateState, {
            wolfSorcerer: {
              policy: config.policy,
              firstNight: config.firstNight,
              history: histories[cp.eventCount],
            },
          }),
        );
      else check(!Object.hasOwn(p.privateState, "wolfSorcerer"));
      if (initial.role === Role.Psychic) {
        const abilities = p.privateState.abilities as Record<string, unknown> | undefined;
        check(abilities && Object.keys(abilities).length === 1);
        const ability = abilities["native:role_check"] as Record<string, unknown> | undefined;
        check(
          ability &&
            ability.id === "native:role_check" &&
            ability.kind === "role_check" &&
            equal(ability.source, { kind: "native", role: Role.Psychic }),
        );
        const state = ability.state as Record<string, unknown> | undefined,
          h = inspectionPrefixes[cp.eventCount]!,
          last = h.at(-1);
        check(
          state &&
            state.policy === "psychic" &&
            equal(state.history, h) &&
            state.lastDay === (last?.day ?? null) &&
            state.lastTarget === (last?.targetId ?? null),
        );
        check(
          ability.uses === h.length &&
            ability.lastUsedDay === inspectionLastUsed[cp.eventCount] &&
            ability.disabled === false &&
            ability.maxUses === null &&
            ability.startsOnDay === 1,
        );
      }
    }
  }
}
