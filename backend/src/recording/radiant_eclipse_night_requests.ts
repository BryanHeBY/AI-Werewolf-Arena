import type { RecordedDecision, RecordedGameEvent, ReproductionRecord } from "./reproduction";
import { Role, Camp } from "../core/domain/identity";
import {
  radiantCheck as check,
  radiantEqual as equal,
  radiantBorrow,
  type RadiantAbility,
  type RadiantNightEvidence,
} from "./radiant_eclipse_record";
import { sanitizeSpeechText } from "../utils/speech_text";
export interface RadiantReleasedFact {
  event: Omit<RecordedGameEvent, "timestamp">;
  release: number;
}
/** A serial, independently calculated request prefix. Invalid/unfinished predecessors cannot open successors. */
export function radiantNightRequestPrefix(
  record: ReproductionRecord,
  day: number,
  n: Pick<RadiantNightEvidence, "start" | "before" | "previousSwallow">,
  roster: ReadonlyMap<number, ReproductionRecord["metadata"]["players"][number]>,
): RadiantReleasedFact[] {
  const ds = record.decisions.filter((d) => d.day === day && d.request.phase === "night"),
    facts: RadiantReleasedFact[] = [];
  if (!ds.length) return facts;
  const actor = (role: Role) => [...roster.values()].find((p) => p.role === role)!.id,
    maid = actor(Role.EclipseMaid),
    count = actor(Role.RadiantCount);
  let cursor = 0,
    stopped = false,
    target: number | null = null,
    borrowed: RadiantAbility | undefined,
    lastRelease = Math.max(
      0,
      ...record.decisions.filter((d) => d.day < day).map((d) => d.settleOrder ?? 0),
    );
  const emit = (
    type: string,
    payload: Record<string, unknown>,
    release: number,
    audience?: readonly number[],
  ) =>
    facts.push({
      event: { type, payload, ...(audience ? { audience: [...audience] } : {}) },
      release,
    });
  emit("phase_changed", { phase: "night", day }, lastRelease);
  const step = (
    stage: string,
    id: number,
    tool: string,
    keys: string[],
    legal: (a: Record<string, any>) => boolean,
  ): { d: RecordedDecision; args: Record<string, any> } | null => {
    if (stopped) return null;
    const d = ds[cursor];
    if (!d) {
      stopped = true;
      return null;
    }
    check(d.stage === stage && d.actorId === id && d.openedAfterSettlement === lastRelease);
    cursor++;
    const a = d.outcome.kind === "action" ? d.outcome.action : null;
    const required = a?.name === tool && keys.every((k) => Object.hasOwn(a.args, k));
    if (required) check(Object.keys(a!.args).length === keys.length);
    if (
      d.outcome.kind === "pending" ||
      d.outcome.kind === "error" ||
      !a ||
      a.name !== tool ||
      !required ||
      !legal(a.args)
    ) {
      check(cursor === ds.length);
      stopped = true;
      return null;
    }
    check(d.settleOrder !== undefined);
    lastRelease = d.settleOrder;
    return { d, args: a.args };
  };
  if (day >= 2 && n.start.includes(maid)) {
    const result = step(
      "eclipse_swallow",
      maid,
      "swallow_skill",
      ["target_id"],
      (a) =>
        a.target_id === null ||
        (Number.isSafeInteger(a.target_id) &&
          n.start.includes(a.target_id) &&
          roster.get(a.target_id)!.camp === Camp.Good &&
          !(n.previousSwallow?.day === day - 1 && n.previousSwallow.targetId === a.target_id)),
    );
    if (!result) return facts;
    target = result.args.target_id;
    const source = target === null ? undefined : n.before.get(target);
    if (source) {
      borrowed = radiantBorrow(source, target!, day);
      emit(
        "ability_changed",
        {
          actorId: maid,
          abilityId: borrowed.id,
          kind: borrowed.kind,
          operation: "granted",
          source: borrowed.source,
          sourceDisclosed: true,
          startsOnDay: day,
          expiresAfterDay: day,
          maxUses: null,
        },
        lastRelease,
      );
    }
    emit(
      "eclipse_swallowed",
      {
        actorId: maid,
        day,
        targetId: target,
        roleId: target === null ? null : roster.get(target)!.role,
        abilityId: borrowed?.id ?? null,
      },
      lastRelease,
      [maid],
    );
    if (target !== null)
      emit("eclipse_native_suppressed", { playerId: target, day }, lastRelease, [target]);
  }
  const abilityActors = (kind: RadiantAbility["kind"]) =>
    n.start.flatMap((id) => {
      const a = id === maid ? borrowed : n.before.get(id);
      return a && a.kind === kind && day >= a.startsOnDay && (id === maid || id !== target)
        ? [{ id, a }]
        : [];
    });
  for (const { id, a } of day >= 2 ? abilityActors("shelter") : []) {
    const result = step(
      "radiant_shelter",
      id,
      "cast_shelter",
      ["target_id"],
      (x) =>
        x.target_id === null ||
        (Number.isSafeInteger(x.target_id) &&
          n.start.includes(x.target_id) &&
          x.target_id !== id &&
          !(a.state.lastDay === day - 1 && a.state.lastTarget === x.target_id)),
    );
    if (!result) return facts;
    emit(
      "radiant_shelter_chosen",
      { actorId: id, day, targetId: result.args.target_id, abilityId: a.id },
      lastRelease,
      [id],
    );
  }
  for (const { id, a } of abilityActors("dream").filter(({ id }) =>
    n.start.some((t) => t !== id),
  )) {
    const result = step(
      "dreamer",
      id,
      "dream",
      ["target_id"],
      (x) =>
        Number.isSafeInteger(x.target_id) && n.start.includes(x.target_id) && x.target_id !== id,
    );
    if (!result) return facts;
    emit(
      "dream_applied",
      {
        actorId: id,
        targetId: result.args.target_id,
        day,
        consecutive: a.state.lastDay === day - 1 && a.state.lastTarget === result.args.target_id,
        ...(id === maid ? { abilityId: a.id } : {}),
      },
      lastRelease,
    );
  }
  const wolves = n.start.filter((id) => roster.get(id)!.role === Role.Wolf),
    holders = wolves.length ? wolves : n.start.includes(maid) ? [maid] : [];
  const firstChat = ds.find((d) => d.stage === "wolf_discussion");
  if (wolves.length && !firstChat && cursor === ds.length) return facts;
  const feed = firstChat?.request.context.visible_events ?? [];
  let phaseIndex = -1,
    tacticalIndex = -1;
  for (const [index, event] of feed.entries()) {
    if (
      event.type === "phase_changed" &&
      event.payload.phase === "night" &&
      event.payload.day === day
    )
      phaseIndex = index;
    if (event.type === "wolf_tactical_order") tacticalIndex = index;
  }
  const order =
    tacticalIndex > phaseIndex ? (feed[tacticalIndex]!.payload.order as number[]) : undefined;
  if (wolves.length) {
    check(
      order &&
        equal(
          [...order].sort((a, b) => a - b),
          [...wolves].sort((a, b) => a - b),
        ),
    );
    emit("wolf_tactical_order", { order: [...order] }, lastRelease, holders);
  }
  const ended = new Set<number>();
  for (let round = 1; round <= 3; round++)
    for (const id of order ?? []) {
      if (ended.has(id)) continue;
      const result = step(
        "wolf_discussion",
        id,
        "speak_to_wolves",
        ["text", "end_chat"],
        (x) => typeof x.text === "string" && typeof x.end_chat === "boolean",
      );
      if (!result) return facts;
      check(result.d.turn === round);
      const end = result.args.end_chat;
      emit(
        end ? "wolf_discussion_ended" : "wolf_discussion",
        {
          actorId: id,
          [end ? "reason" : "text"]: sanitizeSpeechText(result.args.text),
          round,
          ...(end ? {} : { endChat: false }),
        },
        lastRelease,
        holders,
      );
      if (end) ended.add(id);
    }
  const tally = new Map<number, number>();
  for (const id of order ?? holders) {
    const result = step(
      "wolf_vote",
      id,
      "kill_vote",
      ["target_id", "abstain"],
      (x) =>
        typeof x.abstain === "boolean" &&
        (x.target_id === null || (Number.isSafeInteger(x.target_id) && x.target_id > 0)) &&
        (x.abstain || (x.target_id !== null && n.start.includes(x.target_id))),
    );
    if (!result) return facts;
    emit(
      "wolf_kill_vote_cast",
      { actorId: id, abstain: result.args.abstain, targetId: result.args.target_id },
      lastRelease,
      holders,
    );
    if (!result.args.abstain)
      tally.set(result.args.target_id, (tally.get(result.args.target_id) ?? 0) + 1);
  }
  const knife = [...tally].sort(([a, x], [b, y]) => y - x || a - b)[0]?.[0] ?? null;
  for (const { id, a } of abilityActors("potion")) {
    if (id === maid && !a.state.heal && !a.state.poison) continue;
    const result = step(
      "witch",
      id,
      "use_potion",
      ["target_id", "potion_type"],
      (x) =>
        Number.isSafeInteger(x.target_id) &&
        x.target_id > 0 &&
        (x.potion_type === "none" ||
          (x.potion_type === "heal" &&
            a.state.heal === 1 &&
            x.target_id !== id &&
            knife === x.target_id &&
            n.start.includes(x.target_id)) ||
          (x.potion_type === "poison" && a.state.poison === 1 && n.start.includes(x.target_id))),
    );
    if (!result) return facts;
    emit(
      result.args.potion_type === "none" ? "witch_potion_skipped" : "witch_potion_used",
      {
        actorId: id,
        targetId: result.args.target_id,
        potionType: result.args.potion_type,
        ...(id === maid ? { abilityId: a.id } : {}),
      },
      lastRelease,
    );
  }
  for (const { id, a } of abilityActors("seer_check")) {
    const result = step(
      "seer",
      id,
      "check_identity",
      ["target_id"],
      (x) => Number.isSafeInteger(x.target_id) && n.start.includes(x.target_id),
    );
    if (!result) return facts;
    const wolf = roster.get(result.args.target_id)!.camp === Camp.Wolf;
    emit(
      "seer_checked",
      {
        actorId: id,
        targetId: result.args.target_id,
        isWerewolf: wolf,
        result: { kind: "camp", camp: wolf ? "wolf" : "good" },
        ...(id === maid ? { abilityId: a.id } : {}),
      },
      lastRelease,
    );
  }
  check(cursor === ds.length);
  return facts;
}
