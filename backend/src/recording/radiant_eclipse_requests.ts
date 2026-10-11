import { radiantNightRequestPrefix } from "./radiant_eclipse_night_requests";
import { Camp, Phase, Role } from "../core/domain/identity";
import type { RecordedDecision, RecordedGameEvent, ReproductionRecord } from "./reproduction";
import {
  radiantCheck as check,
  radiantEqual as equal,
  radiantBorrow,
  type RadiantAbility,
  type RadiantNightEvidence,
} from "./radiant_eclipse_record";
import {
  RADIANT_ECLIPSE_EVENT_TYPES,
  readRadiantEclipseFact,
  radiantEclipseAudience,
} from "@ai-werewolf-arena/game-text";

const stageTools: Record<string, string[]> = {
  eclipse_swallow: ["swallow_skill"],
  radiant_shelter: ["cast_shelter"],
  dreamer: ["dream"],
  witch: ["use_potion"],
  seer: ["check_identity"],
  wolf_discussion: ["speak_to_wolves"],
  wolf_vote: ["kill_vote"],
  sheriff_nomination: ["run_for_sheriff"],
  sheriff_withdraw: ["run_for_sheriff"],
  sheriff_vote: ["vote_for_sheriff"],
  sheriff_pk_vote: ["vote_for_sheriff"],
  sheriff_speech: ["speak"],
  sheriff_campaign_speech: ["speak"],
  sheriff_pk_speech: ["speak"],
  sheriff_choose_direction: ["choose_direction"],
  sheriff_badge_choice: ["choose_badge_successor"],
  day_speech: ["speak"],
  last_words: ["speak"],
  voting: ["vote"],
  exile_pk_vote: ["vote"],
  exile_pk_speech: ["speak"],
  on_pre_election: ["self_destruct"],
  on_pre_vote: ["self_destruct"],
};
const stageKinds: Record<string, RadiantAbility["kind"]> = {
  radiant_shelter: "shelter",
  dreamer: "dream",
  witch: "potion",
  seer: "seer_check",
};
const publicEvents = new Set([
  "phase_changed",
  "day_speech",
  "night_resolved",
  "vote_summary",
  "voted_out",
  "game_over",
  "wolf_self_destruct",
  "last_words_granted",
  "last_words_spoken",
  "sheriff_nomination_summary",
  "sheriff_withdraw_summary",
  "sheriff_candidates_finalized",
  "sheriff_pk_started",
  "exile_pk_started",
  "sheriff_vote_summary",
  "sheriff_badge_transferred",
  "sheriff_badge_destroyed",
  "sheriff_direction_chosen",
]);
const actorEvents = new Set([
  "ability_changed",
  "seer_checked",
  "dream_applied",
  "witch_potion_used",
  "witch_potion_skipped",
]);
const packEvents = new Set([
  "wolf_tactical_order",
  "wolf_discussion",
  "wolf_discussion_ended",
  "wolf_kill_vote_cast",
]);
function project(e: RecordedGameEvent, actor: number): Record<string, unknown> | null {
  if ((RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(e.type)) {
    const fact = readRadiantEclipseFact(e.type, e.payload);
    return fact && radiantEclipseAudience(e.type, fact).includes(actor) ? { ...fact } : null;
  }
  if (packEvents.has(e.type)) {
    if (!e.audience?.includes(actor)) return null;
    return { ...e.payload };
  }
  if (actorEvents.has(e.type) && e.payload.actorId !== actor) return null;
  if (!publicEvents.has(e.type) && !actorEvents.has(e.type)) return null;
  if (e.type === "ability_changed") {
    const { sourceDisclosed: _secret, ...p } = e.payload;
    return p;
  }
  if (e.type === "vote_summary") {
    const { tally: _derived, ...p } = e.payload;
    return p;
  }
  return { ...e.payload };
}
export function validateRadiantRequests(
  record: ReproductionRecord,
  context: {
    roster: ReadonlyMap<number, ReproductionRecord["metadata"]["players"][number]>;
    alive: ReadonlySet<number>;
    nights: ReadonlyMap<number, RadiantNightEvidence>;
    maid: number;
    count: number;
    seer: number;
    witch: number;
    dreamer: number;
  },
): void {
  const { roster, nights, maid } = context,
    last = record.checkpoints.at(-1)!;
  const inferred = new Map<
    number,
    {
      start: number[];
      before: Map<number, RadiantAbility | undefined>;
      previousSwallow: { day: number; targetId: number | null } | undefined;
    }
  >();
  const info = (day: number) => {
    const n = nights.get(day);
    if (n) return n;
    let value = inferred.get(day);
    if (value) return value;
    // Live Trace snapshots retain the prior checkpoint while an uncheckpointed request is pending.
    check(!record.finalized && day === last.snapshot.day);
    const before = new Map(
      last.players.map((p) => [
        p.id,
        structuredClone(
          Object.values((p.privateState.abilities ?? {}) as Record<string, RadiantAbility>).find(
            (a) => a.source.kind === "native",
          ),
        ),
      ]),
    );
    for (const a of before.values())
      if (a?.kind === "potion")
        Object.assign(a.state, {
          healUsedThisNight: false,
          poisonUsedThisNight: false,
          canSelfHeal: false,
        });
    const history = (
      last.players.find((p) => p.id === maid)!.privateState.eclipse as {
        history: Array<{ day: number; targetId: number | null }>;
      }
    ).history;
    value = {
      start: last.players.filter((p) => p.alive).map((p) => p.id),
      before,
      previousSwallow: history.at(-1),
    };
    inferred.set(day, value);
    return value;
  };
  const swallow = (day: number) => {
    const n = info(day),
      ds = record.decisions.filter(
        (d) => d.day === day && d.stage === "eclipse_swallow" && d.actorId === maid,
      ),
      d = ds[0];
    const a = d?.outcome.kind === "action" ? d.outcome.action : null;
    const target = a?.name === "swallow_skill" ? a.args.target_id : null;
    const legal =
      !!d &&
      d.settleOrder !== undefined &&
      a?.name === "swallow_skill" &&
      day >= 2 &&
      n.start.includes(maid) &&
      (target === null ||
        (n.start.includes(target) &&
          roster.get(target)!.camp === Camp.Good &&
          !(n.previousSwallow?.day === day - 1 && n.previousSwallow.targetId === target)));
    const original = legal && target !== null ? n.before.get(target) : undefined;
    return {
      d,
      legal,
      target,
      borrowed: original ? radiantBorrow(original, target!, day) : undefined,
    };
  };
  const settled = record.decisions
    .filter((d) => d.settleOrder !== undefined)
    .map((d) => d.settleOrder!)
    .sort((a, b) => a - b);
  check(settled.every((value, index) => value === index + 1));
  for (const d of record.decisions)
    check(
      d.settleOrder === undefined
        ? d.outcome.kind === "pending"
        : d.outcome.kind !== "pending" && d.openedAfterSettlement < d.settleOrder,
    );
  const prefixes = new Map(
    [
      ...new Set(record.decisions.filter((d) => d.request.phase === Phase.Night).map((d) => d.day)),
    ].map((day) => [day, radiantNightRequestPrefix(record, day, info(day), roster)]),
  );
  const speechCounts = new Map<string, number>();
  const exileRounds = new Map<number, number>();
  const release = (e: RecordedGameEvent, day: number) => {
    const n = prefixes
      .get(day)
      ?.find((f) => f.event.type === e.type && equal(f.event.payload, e.payload));
    if (n) return n.release;
    const max = (rows: RecordedDecision[]) =>
      Math.max(0, ...rows.map((d) => d.settleOrder ?? Number.MAX_SAFE_INTEGER));
    const night = record.decisions.filter((d) => d.day === day && d.request.phase === Phase.Night);
    if (e.type === "phase_changed")
      return e.payload.phase === Phase.Night
        ? max(record.decisions.filter((d) => d.day < Number(e.payload.day)))
        : e.payload.phase === Phase.Day
          ? max(night)
          : e.payload.phase === Phase.Voting
            ? max(record.decisions.filter((d) => d.day === day && d.request.phase === Phase.Day))
            : max(record.decisions.filter((d) => d.day <= day));
    if (e.type === "night_resolved")
      return Math.max(
        max(night),
        day === 1
          ? max(
              record.decisions.filter(
                (d) =>
                  d.day === 1 &&
                  [
                    "sheriff_nomination",
                    "sheriff_withdraw",
                    "sheriff_campaign_speech",
                    "sheriff_vote",
                    "sheriff_pk_vote",
                    "sheriff_pk_speech",
                    "on_pre_election",
                  ].includes(d.stage),
              ),
            )
          : 0,
      );
    if (e.type === "game_over") return max(record.decisions.filter((d) => d.day <= day));
    if (e.type === "eclipse_native_restored" || e.type === "eclipse_lease_closed")
      return max(night);
    const stages: Record<string, string[]> = {
      day_speech: ["day_speech", "sheriff_campaign_speech", "sheriff_pk_speech", "exile_pk_speech"],
      last_words_spoken: ["last_words"],
      sheriff_badge_transferred: ["sheriff_badge_choice"],
      sheriff_badge_destroyed: ["sheriff_badge_choice"],
      sheriff_direction_chosen: ["sheriff_choose_direction"],
      vote_summary: ["voting", "exile_pk_vote"],
      voted_out: ["voting", "exile_pk_vote"],
      sheriff_nomination_summary: ["sheriff_nomination"],
      sheriff_withdraw_summary: ["sheriff_nomination", "sheriff_withdraw"],
      sheriff_candidates_finalized: ["sheriff_nomination", "sheriff_withdraw"],
      sheriff_pk_started: ["sheriff_vote"],
      sheriff_vote_summary: [
        "sheriff_nomination",
        "sheriff_withdraw",
        "sheriff_vote",
        "sheriff_pk_vote",
      ],
    };
    if (e.type === "day_speech") {
      const key = day + "/" + e.payload.actorId,
        index = speechCounts.get(key) ?? 0;
      const candidates = record.decisions
        .filter(
          (d) =>
            d.day === day &&
            d.actorId === e.payload.actorId &&
            stages.day_speech!.includes(d.stage) &&
            d.outcome.kind === "action" &&
            d.outcome.action?.name === "speak",
        )
        .sort((a, b) => a.settleOrder! - b.settleOrder!);
      const selected = candidates[index];
      speechCounts.set(key, index + 1);
      check(
        selected?.outcome.kind === "action" &&
          selected.outcome.action?.name === "speak" &&
          selected.outcome.action.args.text.trim().length > 0,
      );
      check(
        selected.outcome.action.args.text
          .replace(/^(\s*\[(上帝|法官|系统|God|Judge|System)\]\s*)+/gi, "")
          .trim() === e.payload.text,
      );
      return selected.settleOrder!;
    }
    if (e.type === "sheriff_vote_summary")
      return max(
        record.decisions.filter(
          (d) =>
            d.day === day &&
            ((e.payload.round ?? 1) === 2
              ? d.stage === "sheriff_pk_vote"
              : ["sheriff_nomination", "sheriff_withdraw", "sheriff_vote"].includes(d.stage)),
        ),
      );
    if (e.type === "vote_summary" || e.type === "voted_out" || e.type === "exile_pk_started") {
      const round =
        e.type === "vote_summary" ? Number(e.payload.round ?? 1) : (exileRounds.get(day) ?? 1);
      const boundary = max(
        record.decisions.filter(
          (d) => d.day === day && d.stage === (round === 2 ? "exile_pk_vote" : "voting"),
        ),
      );
      if (e.type === "exile_pk_started") exileRounds.set(day, 2);
      return boundary;
    }
    const relevant = stages[e.type];
    if (relevant)
      return max(
        record.decisions.filter(
          (d) =>
            d.day === day &&
            relevant.includes(d.stage) &&
            (typeof (
              e.payload.actorId ??
              e.payload.playerId ??
              e.payload.fromId ??
              e.payload.sheriffId
            ) !== "number" ||
              d.actorId ===
                (e.payload.actorId ??
                  e.payload.playerId ??
                  e.payload.fromId ??
                  e.payload.sheriffId)),
        ),
      );
    if (e.type === "last_words_granted")
      return Math.max(
        max(night),
        day === 1
          ? max(
              record.decisions.filter(
                (d) =>
                  d.day === 1 &&
                  [
                    "sheriff_nomination",
                    "sheriff_withdraw",
                    "sheriff_campaign_speech",
                    "sheriff_vote",
                    "sheriff_pk_vote",
                    "sheriff_pk_speech",
                    "on_pre_election",
                  ].includes(d.stage),
              ),
            )
          : 0,
        e.payload.phase === Phase.Voting
          ? max(
              record.decisions.filter(
                (d) => d.day === day && ["voting", "exile_pk_vote"].includes(d.stage),
              ),
            )
          : 0,
      );
    if (e.type === "wolf_self_destruct")
      return max(record.decisions.filter((d) => d.day === day && d.stage === e.payload.window));
    return Number.MAX_SAFE_INTEGER;
  };
  const published = new Map(
    [...roster.keys()].map((id) => [
      id,
      [] as Array<{ type: string; payload: Record<string, unknown>; release: number; day: number }>,
    ]),
  );
  let eventDay = 1;
  for (const e of record.events) {
    if (e.type === "phase_changed") eventDay = Number(e.payload.day);
    const boundary = release(e, eventDay);
    for (const id of roster.keys()) {
      const p = project(e, id);
      if (p)
        published.get(id)!.push({ type: e.type, payload: p, release: boundary, day: eventDay });
    }
  }
  const used = new Set<string>();
  for (const d of record.decisions) {
    const key = `${d.actorId}/${d.day}/${d.stage}/${d.turn}`;
    check(!used.has(key));
    used.add(key);
    if (d.outcome.kind === "action" && d.outcome.action?.name === "speak")
      check(
        Object.keys(d.outcome.action.args).length === 1 &&
          Object.hasOwn(d.outcome.action.args, "text"),
      );
    check(
      roster.has(d.actorId) &&
        d.request.actorId === d.actorId &&
        d.request.context.day === d.day &&
        d.request.context.stage === d.stage &&
        stageTools[d.stage] &&
        equal(d.request.allowedTools, stageTools[d.stage]),
    );
    const ctx = d.request.context,
      isNight = [
        "eclipse_swallow",
        "radiant_shelter",
        "dreamer",
        "witch",
        "seer",
        "wolf_discussion",
        "wolf_vote",
      ].includes(d.stage);
    if (isNight) {
      const allowed = [
        "day",
        "stage",
        "visible_events",
        "turn_constraints",
        "allow_fallback",
        "action_failure_policy",
        ...(d.stage === "eclipse_swallow" ? ["swallow_candidates"] : []),
        ...(d.stage === "radiant_shelter" ? ["ability_id", "shelter_candidates"] : []),
        ...(["witch", "seer", "dreamer"].includes(d.stage) ? ["ability_id"] : []),
        ...(d.stage === "witch" ? ["wolf_target"] : []),
        ...(d.stage === "wolf_discussion" ? ["round", "max_rounds"] : []),
      ];
      check(Object.keys(ctx).every((key) => allowed.includes(key)));
      const n = info(d.day),
        s = swallow(d.day),
        kind = stageKinds[d.stage];
      check(
        d.request.phase === Phase.Night &&
          n.start.includes(d.actorId) &&
          ctx.allow_fallback === false &&
          ctx.action_failure_policy === "error",
      );
      check(
        ctx.turn_constraints.min_valid_actions === 1 &&
          ctx.turn_constraints.max_valid_actions === 1 &&
          equal(ctx.turn_constraints.required_any_tools, d.request.allowedTools),
      );
      if (d.stage === "eclipse_swallow") {
        check(d.day >= 2 && d.actorId === maid && d.turn === 1 && ctx.ability_id === undefined);
        const candidates = n.start.filter(
          (id) =>
            roster.get(id)!.camp === Camp.Good &&
            !(n.previousSwallow?.day === d.day - 1 && n.previousSwallow.targetId === id),
        );
        check(equal(ctx.swallow_candidates, candidates) && ctx.shelter_candidates === undefined);
      } else if (kind) {
        const a = d.actorId === maid ? s.borrowed : n.before.get(d.actorId);
        check(
          a &&
            a.kind === kind &&
            d.day >= a.startsOnDay &&
            ctx.ability_id === a.id &&
            d.turn === 1 &&
            (d.actorId === maid
              ? s.legal && s.d!.settleOrder! <= d.openedAfterSettlement
              : !s.legal || s.target !== d.actorId),
        );
        if (kind === "shelter") {
          const ids = n.start.filter(
            (id) =>
              id !== d.actorId && !(a.state.lastDay === d.day - 1 && a.state.lastTarget === id),
          );
          check(equal(ctx.shelter_candidates, ids));
        }
        if (kind === "potion") {
          check(d.actorId !== maid || a.state.heal > 0 || a.state.poison > 0);
          if (a.state.heal > 0) {
            const votes = record.decisions.filter(
                (x) =>
                  x.day === d.day &&
                  x.stage === "wolf_vote" &&
                  x.settleOrder !== undefined &&
                  x.settleOrder <= d.openedAfterSettlement,
              ),
              tally = new Map<number, number>();
            for (const v of votes) {
              const a = v.outcome.kind === "action" ? v.outcome.action : null;
              if (a?.name === "kill_vote" && !a.args.abstain && a.args.target_id !== null)
                tally.set(a.args.target_id, (tally.get(a.args.target_id) ?? 0) + 1);
            }
            const knife = [...tally].sort(([a, x], [b, y]) => y - x || a - b)[0]?.[0] ?? null;
            check(ctx.wolf_target === knife);
          } else check(!Object.hasOwn(ctx, "wolf_target"));
        }
      } else {
        const wolves = n.start.filter((id) => roster.get(id)!.role === Role.Wolf),
          holders = wolves.length ? wolves : n.start.includes(maid) ? [maid] : [];
        check(
          ctx.ability_id === undefined &&
            (d.stage === "wolf_discussion" ? wolves : holders).includes(d.actorId),
        );
        if (d.stage === "wolf_discussion") {
          check(d.turn <= 3 && ctx.round === d.turn && ctx.max_rounds === 3);
          for (const prior of record.decisions.filter(
            (x) =>
              x.day === d.day && x.stage === d.stage && x.actorId === d.actorId && x.turn < d.turn,
          )) {
            const a = prior.outcome.kind === "action" ? prior.outcome.action : null;
            check(
              a?.name === "speak_to_wolves" &&
                a.args.end_chat === false &&
                prior.settleOrder! <= d.openedAfterSettlement,
            );
          }
        } else check(d.turn === 1);
      }
      for (const name of ["shelter_candidates", "swallow_candidates"] as const)
        if (Object.hasOwn(ctx, name))
          check(
            d.stage === (name === "shelter_candidates" ? "radiant_shelter" : "eclipse_swallow"),
          );
    } else {
      check(
        ctx.ability_id === undefined &&
          !Object.hasOwn(ctx, "shelter_candidates") &&
          !Object.hasOwn(ctx, "swallow_candidates"),
      );
      if (d.stage === "on_pre_election" || d.stage === "on_pre_vote")
        check(
          roster.get(d.actorId)!.role === Role.Wolf &&
            d.request.phase === (d.stage === "on_pre_vote" ? Phase.Voting : Phase.Day),
        );
    }
    const visible = ctx.visible_events;
    check(visible.every((v, i) => v.seq === i + 1));
    const sources = published.get(d.actorId)!.filter((v) => v.release <= d.openedAfterSettlement);
    let expected = sources.map(({ release: _release, day: _day, ...v }) => v);
    if (!record.finalized) {
      const allPublished = published.get(d.actorId)!.filter((v) => v.day === d.day);
      const extra = (prefixes.get(d.day) ?? [])
        .filter((f) => f.release <= d.openedAfterSettlement)
        .flatMap((f) => {
          const p = project({ ...f.event, timestamp: 0 }, d.actorId);
          return p && !allPublished.some((v) => v.type === f.event.type && equal(v.payload, p))
            ? [{ type: f.event.type, payload: p }]
            : [];
        });
      expected = [...expected, ...extra];
    }
    check(
      equal(
        visible.map(({ seq: _seq, ...v }) => v),
        expected,
      ),
    );
    const latestPhase = [...visible].reverse().find((v) => v.type === "phase_changed");
    check(
      !!latestPhase &&
        latestPhase.payload.phase === d.request.phase &&
        latestPhase.payload.day === d.day,
    );
  }
}
