import { readDemonHunterState } from "@ai-werewolf-arena/game-text";
import { Role, Camp } from "../core/domain";
import type { ReproductionRecord, RecordedCheckpoint } from "./reproduction";
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
function assert(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_demon_hunter_stock_invalid");
}
function native(role: Role, kind: string, state: Record<string, unknown>) {
  return {
    id: `native:${kind}`,
    kind,
    state,
    source: { kind: "native", role },
    sourceDisclosed: true,
    startsOnDay: 1,
    maxUses: null,
    uses: 0,
    lastUsedDay: null as number | null,
    disabled: false,
  };
}
/** Computes each finite original inventory from accepted decisions; CP values never refresh this ledger. */
export function validateDemonNativeStocks(record: ReproductionRecord): void {
  for (const cp of record.checkpoints) validateCheckpoint(record, cp);
}
function validateCheckpoint(record: ReproductionRecord, cp: RecordedCheckpoint): void {
  const original = new Map(record.metadata.players.map((p) => [p.id, p]));
  for (const p of cp.players) {
    const initial = original.get(p.id);
    assert(initial);
    if (cp.cycle === 0) assert(cp.complete && p.alive);
    if (initial.role === Role.DemonHunter) {
      assert(
        Object.keys(p.privateState).length === 1 && Object.hasOwn(p.privateState, "demonHunter"),
      );
      const state = readDemonHunterState(p.privateState.demonHunter);
      assert(state);
      const expected = record.events
        .slice(0, cp.eventCount)
        .filter((e) => e.type === "demon_hunter_chosen")
        .map((e) => ({ day: e.payload.day, targetId: e.payload.targetId }));
      assert(
        stable(state.history) === stable(expected) &&
          state.history.every(
            (row) => row.targetId === null || (original.has(row.targetId) && row.targetId !== p.id),
          ),
      );
      continue;
    }
    if (initial.role === Role.Wolf || initial.role === Role.Villager) {
      assert(stable(p.privateState) === "{}");
      continue;
    }
    if (initial.role === Role.Hunter) {
      const events = record.events.slice(0, cp.eventCount);
      // Death alone never spends a gun: three invalid/missing choices retain stock.
      // This finite board has one native Hunter; only a valid pass, committed shot,
      // or the actual poison-suppression event proves consumption.
      const passed = record.decisions.some(
        (d) =>
          d.actorId === p.id &&
          d.day <= cp.cycle &&
          d.stage === "hunter_shot" &&
          d.outcome.kind === "action" &&
          d.outcome.action?.name === "shoot" &&
          d.outcome.action.args.target_id === null,
      );
      const consumed =
        passed ||
        events.some(
          (e) =>
            (e.type === "hunter_shot" || e.type === "hunter_silent_due_to_poison") &&
            e.payload.hunterId === p.id,
        );
      assert(
        stable(p.privateState) ===
          stable({ hunter: { canShoot: !consumed, deathActionPolicy: "awa_knife_or_exile_v1" } }),
      );
      continue;
    }
    const kind =
      initial.role === Role.Seer ? "seer_check" : initial.role === Role.Guard ? "guard" : "potion";
    assert([Role.Seer, Role.Guard, Role.Witch].includes(initial.role));
    const state: Record<string, any> =
      kind === "seer_check"
        ? { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] }
        : kind === "guard"
          ? { lastTarget: null, repeatPolicy: "netease_consecutive_nights_v1" }
          : {
              heal: 1,
              poison: 1,
              selfHealRule: "disabled",
              canSelfHeal: false,
              healUsedThisNight: false,
              poisonUsedThisNight: false,
            };
    const expected = native(initial.role, kind, state),
      stage = kind === "seer_check" ? "seer" : kind === "guard" ? "guard" : "witch";
    for (const d of record.decisions.filter(
      (d) => d.actorId === p.id && d.stage === stage && d.day <= cp.cycle,
    )) {
      if (kind === "potion") {
        state.healUsedThisNight = false;
        state.poisonUsedThisNight = false;
      }
      if (d.outcome.kind !== "action") continue;
      const call = d.outcome.action;
      assert(call);
      const target = "target_id" in call.args ? call.args.target_id : undefined;
      if (kind === "seer_check") {
        assert(
          call.name === "check_identity" && typeof target === "number" && original.has(target),
        );
        const result = { kind: "camp", camp: original.get(target)!.camp },
          isWerewolf = result.camp === Camp.Wolf;
        state.lastTarget = target;
        state.lastIsWerewolf = isWerewolf;
        state.lastResult = result;
        state.history.push({ targetId: target, isWerewolf, result });
        expected.uses++;
      } else if (kind === "guard") {
        assert(
          call.name === "guard" &&
            (target === null
              ? call.args.abstain === true
              : typeof target === "number" && original.has(target) && call.args.abstain === false),
        );
        assert(
          target === null || expected.lastUsedDay !== d.day - 1 || state.lastTarget !== target,
        );
        state.lastTarget = target;
        if (target !== null) expected.uses++;
      } else {
        assert(call.name === "use_potion");
        const potion = call.args.potion_type;
        if (potion !== "none") {
          assert(state[potion] === 1);
          state[potion] = 0;
          state[potion === "heal" ? "healUsedThisNight" : "poisonUsedThisNight"] = true;
          expected.uses++;
        }
      }
      expected.lastUsedDay = d.day;
    }
    assert(stable(p.privateState) === stable({ abilities: { [expected.id]: expected } }));
  }
}
