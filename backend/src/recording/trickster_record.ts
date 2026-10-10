import {
  isTricksterPreset,
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
  readMagicianExchangeFact,
} from "@ai-werewolf-arena/game-text";
import { Camp, Role, Phase } from "../core/domain";
import type { ReproductionRecord } from "./reproduction";
const exchange = "trickster_exchange_committed",
  skip = "trickster_exchange_skipped",
  mapping = "exile_target_mapped";
function check(v: unknown): asserts v {
  if (!v) throw new Error("reproduction_trickster_invalid");
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
export function validateTricksterRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard;
  const owns = board.roleSetups.some((r) => r.role === Role.Trickster && r.count > 0);
  const artifacts =
    record.events.some((e) => [exchange, skip, mapping].includes(e.type)) ||
    record.decisions.some(
      (d) =>
        d.stage === "trickster_exchange" ||
        d.request.allowedTools.includes("swap_exile_targets") ||
        d.request.context.trickster_candidates !== undefined ||
        d.request.context.trickster_may_pass !== undefined,
    ) ||
    record.checkpoints.some((c) =>
      c.players.some((p) => Object.hasOwn(p.privateState, "trickster")),
    );
  if (!owns) {
    check(
      !board.trickster &&
        !artifacts &&
        !record.metadata.players.some((p) => p.role === Role.Trickster),
    );
    return;
  }
  check(isTricksterPreset(board) && !record.metadata.faultPlan && !record.metadata.initialDeal);
  const original = new Map(record.metadata.players.map((p) => [p.id, p]));
  const actors = record.metadata.players.filter((p) => p.role === Role.Trickster);
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
  const resolved = new Set<number>(),
    mapped = new Set<number>();
  let day = 1,
    phase: Phase = Phase.Night,
    expectedExile: number | null = null;
  for (let i = 0; i < record.events.length; i++) {
    const e = record.events[i]!;
    if (e.type === "phase_changed") {
      check(Number.isSafeInteger(e.payload.day) && Number(e.payload.day) > 0);
      day = Number(e.payload.day);
      phase = e.payload.phase as Phase;
      if (phase === Phase.Night) {
        nightAlive.set(day, [...alive]);
        expectedExile = null;
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
        const f = readTricksterSkipFact(e.type, e.payload);
        check(f && f.actorId === actor && f.day === day);
        check(f.reason === "dead" ? !alive.has(actor) : alive.has(actor) && candidates.length < 2);
        check(!record.decisions.some((d) => d.day === day && d.stage === "trickster_exchange"));
        skipped.add(day);
      } else {
        const f = readTricksterExchangeFact(e.type, e.payload);
        check(
          f && f.actorId === actor && f.day === day && alive.has(actor) && candidates.length >= 2,
        );
        const ds = record.decisions.filter(
          (d) => d.day === day && d.stage === "trickster_exchange",
        );
        check(ds.length === 1);
        const d = ds[0]!;
        const mayPass = !(history.at(-1)?.day === day - 1 && history.at(-1)?.pair === null);
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
            equal(d.request.allowedTools, ["swap_exile_targets"]),
        );
        check(
          equal(d.request.context.trickster_candidates, candidates) &&
            d.request.context.trickster_may_pass === mayPass,
        );
        check(d.outcome.kind === "action" && d.outcome.action?.name === "swap_exile_targets");
        const a = d.outcome.action.args;
        if (a.abstain)
          check(a.first_id === null && a.second_id === null && f.pair === null && mayPass);
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
    if (e.type === "night_resolved") {
      check(nightAlive.has(day) && (facts.has(day) || skipped.has(day)) && !resolved.has(day));
      check(Array.isArray(e.payload.deaths));
      resolved.add(day);
      for (const id of e.payload.deaths) {
        check(typeof id === "number" && original.has(id));
        alive.delete(id);
      }
    }
    if (e.type === mapping) {
      const f = readExileMappingFact(e.type, e.payload);
      check(
        f &&
          phase === Phase.Voting &&
          e.audience === undefined &&
          resolved.has(day) &&
          !mapped.has(day) &&
          alive.has(f.requestedId),
      );
      const raw = facts.get(day)?.pair ?? null,
        mp = magic.get(day);
      const pair = raw && mp && equal(raw, mp) ? null : raw;
      const effective = pair
        ? f.requestedId === pair[0]
          ? pair[1]
          : f.requestedId === pair[1]
            ? pair[0]
            : f.requestedId
        : f.requestedId;
      check(f.effectiveId === effective && f.missed === !alive.has(effective));
      expectedExile = f.missed ? null : effective;
      mapped.add(day);
    }
    if (e.type === "voted_out") {
      check(
        mapped.has(day) &&
          expectedExile !== null &&
          e.payload.target === expectedExile &&
          alive.has(expectedExile),
      );
      alive.delete(expectedExile);
      expectedExile = null;
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
  }
  const cycle = Math.max(0, ...record.checkpoints.map((c) => c.cycle));
  for (const d of record.decisions) {
    if (!record.finalized && d.day > cycle) continue;
    if (d.stage === "trickster_exchange") {
      const before = history.filter((h) => h.day < d.day),
        spent = new Set(before.flatMap((h) => h.pair ?? []));
      const candidates = nightAlive.get(d.day)?.filter((id) => !spent.has(id));
      check(
        d.actorId === actor &&
          d.request.phase === Phase.Night &&
          candidates &&
          nightAlive.get(d.day)!.includes(actor) &&
          candidates.length >= 2,
      );
      check(equal(d.request.context.trickster_candidates, candidates));
      const last = before.at(-1);
      check(
        d.request.context.trickster_may_pass === !(last?.day === d.day - 1 && last.pair === null),
      );
      if (record.checkpoints.some((c) => c.cycle >= d.day && c.complete)) check(facts.has(d.day));
    } else
      check(
        d.request.context.trickster_candidates === undefined &&
          d.request.context.trickster_may_pass === undefined,
      );
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
            ? readTricksterExchangeFact(e.type, e.payload)
            : readTricksterSkipFact(e.type, e.payload);
        check(f && f.day <= d.day);
      }
      if (e.type === mapping)
        check(
          readExileMappingFact(e.type, e.payload) &&
            record.events.some(
              (source) => source.type === mapping && equal(source.payload, e.payload),
            ),
        );
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
            trickster: { policy: "awa_trickster_exile_v1", history: histories[cp.eventCount] },
          }),
        );
      else check(!Object.hasOwn(p.privateState, "trickster"));
    }
  }
}
