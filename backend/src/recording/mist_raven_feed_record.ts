import { MIST_RAVEN_EVENT_TYPES, readMistRavenFact } from "@ai-werewolf-arena/game-text";
import { Camp, Phase, Role } from "../core/domain/identity";
import type { RecordedDecision, RecordedGameEvent, ReproductionRecord } from "./reproduction";
import {
  check,
  equal,
  exact,
  ids,
  mistDraw,
  selectedMistBlast,
  type MistNightRequestEvidence,
} from "./mist_raven_requests";
import { createMistSheriffEvidence } from "./mist_raven_sheriff_record";
import { sanitizeSpeechText } from "../utils/speech_text";

// An archive oracle, deliberately independent of the live visibility registry and projector.
const publicTypes = new Set([
  "phase_changed",
  "day_speech",
  "night_resolved",
  "vote_summary",
  "voted_out",
  "game_over",
  "wolf_self_destruct",
  "idiot_revealed",
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
const packTypes = new Set([
  "wolf_tactical_order",
  "wolf_discussion",
  "wolf_discussion_ended",
  "wolf_kill_vote_cast",
  "mist_knife_drawn",
]);
const ownTypes = new Set([
  "seer_checked",
  "dream_applied",
  ...MIST_RAVEN_EVENT_TYPES.filter((t) => t !== "mist_knife_drawn"),
]);
const nightStages = new Set([
  "alchemist_mist",
  "dreamer",
  "wolf_discussion",
  "wolf_vote",
  "raven_knife",
  "seer",
]);
type WireFact = { seq: number; type: string; payload: Record<string, unknown> };
const publicWireKeys: Record<string, string[]> = {
  phase_changed: ["day", "phase"],
  day_speech: ["actorId", "text"],
  night_resolved: ["deaths"],
  vote_summary: ["votes", "target", "round"],
  voted_out: ["target"],
  wolf_self_destruct: ["wolfId", "window"],
  idiot_revealed: ["targetId"],
  last_words_granted: ["playerId", "phase", "day"],
  last_words_spoken: ["playerId", "phase", "day", "text"],
  sheriff_nomination_summary: ["candidates"],
  sheriff_withdraw_summary: ["withdrawn"],
  sheriff_candidates_finalized: ["candidates"],
  sheriff_pk_started: ["candidates"],
  exile_pk_started: ["candidates"],
  sheriff_vote_summary: ["votes", "winnerId", "round"],
  sheriff_badge_transferred: ["fromId", "toId", "reason"],
  sheriff_badge_destroyed: ["targetId", "reason"],
  sheriff_direction_chosen: ["sheriffId", "direction"],
};

export function validateMistRavenFeeds(
  record: ReproductionRecord,
  nights: ReadonlyMap<number, MistNightRequestEvidence>,
): void {
  const roster = new Map(record.metadata.players.map((p) => [p.id, p]));
  const rows = (day: number, stages: readonly string[], actor?: number) =>
    record.decisions.filter(
      (d) =>
        d.day === day && stages.includes(d.stage) && (actor === undefined || d.actorId === actor),
    );
  const settled = (ds: RecordedDecision[]) =>
    Math.max(0, ...ds.map((d) => d.settleOrder ?? Infinity));
  const call = (d: RecordedDecision) => (d.outcome.kind === "action" ? d.outcome.action : null);
  const visible = (e: Pick<RecordedGameEvent, "type" | "payload" | "audience">, actor: number) => {
    if (publicTypes.has(e.type)) return true;
    if (ownTypes.has(e.type)) return e.payload.actorId === actor;
    return packTypes.has(e.type) && e.audience?.includes(actor) === true;
  };
  const payload = (e: Pick<RecordedGameEvent, "type" | "payload">) => {
    if (e.type !== "vote_summary") return e.payload;
    const { tally: _tally, ...p } = e.payload;
    return p;
  };
  const timeline: Array<{ event: RecordedGameEvent; day: number; release: number }> = [];
  let day = 1,
    release = 0;
  const consumedSpeech = new Set<RecordedDecision>();
  for (const event of record.events) {
    const p = event.payload,
      type = event.type;
    if (type === "phase_changed") {
      day = Number(p.day);
      if (p.phase === Phase.Night)
        release = Math.max(release, settled(record.decisions.filter((d) => d.day < day)));
      if (p.phase === Phase.Day) release = Math.max(release, settled(rows(day, [...nightStages])));
      if (p.phase === Phase.Voting)
        release = Math.max(
          release,
          settled(
            record.decisions.filter(
              (d) =>
                d.day === day &&
                d.request.phase === Phase.Day &&
                d.stage !== "sheriff_badge_choice",
            ),
          ),
        );
    }
    const stage =
      type === "alchemist_mist_chosen" || type === "alchemist_mist_skipped"
        ? "alchemist_mist"
        : type === "alchemist_snake_chosen"
          ? "alchemist_snake"
          : type === "raven_knife_chosen"
            ? "raven_knife"
            : type === "dream_applied"
              ? "dreamer"
              : type === "seer_checked"
                ? "seer"
                : type === "wolf_kill_vote_cast"
                  ? "wolf_vote"
                  : type === "sheriff_direction_chosen"
                    ? "sheriff_choose_direction"
                    : null;
    if (stage)
      release = Math.max(release, settled(rows(day, [stage], Number(p.actorId ?? p.sheriffId))));
    if (type === "wolf_discussion" || type === "wolf_discussion_ended")
      release = Math.max(
        release,
        settled(
          rows(day, ["wolf_discussion"], Number(p.actorId)).filter((d) => d.turn === p.round),
        ),
      );
    if (type === "day_speech") {
      const source = rows(
        day,
        ["day_speech", "sheriff_campaign_speech", "sheriff_pk_speech", "exile_pk_speech"],
        Number(p.actorId),
      ).find((d) => {
        const a = call(d);
        return (
          !consumedSpeech.has(d) &&
          a?.name === "speak" &&
          sanitizeSpeechText(a.args.text) === p.text
        );
      });
      if (source) {
        consumedSpeech.add(source);
        release = Math.max(release, source.settleOrder ?? Infinity);
      }
    }
    if (type === "last_words_spoken")
      release = Math.max(
        release,
        settled(
          rows(day, ["last_words"], Number(p.playerId)).filter((d) => d.request.phase === p.phase),
        ),
      );
    if (["sheriff_nomination_summary", "sheriff_candidates_finalized"].includes(type))
      release = Math.max(release, settled(rows(day, ["sheriff_nomination"])));
    if (type === "sheriff_withdraw_summary")
      release = Math.max(release, settled(rows(day, ["sheriff_withdraw"])));
    if (type === "sheriff_vote_summary")
      release = Math.max(
        release,
        settled(rows(day, [p.round === 2 ? "sheriff_pk_vote" : "sheriff_vote"])),
      );
    if (type === "vote_summary")
      release = Math.max(release, settled(rows(day, [p.round === 2 ? "exile_pk_vote" : "voting"])));
    if (type === "wolf_self_destruct")
      release = Math.max(release, settled(rows(day, [String(p.window)])));
    if (["sheriff_badge_transferred", "sheriff_badge_destroyed"].includes(type))
      release = Math.max(
        release,
        settled(rows(day, ["sheriff_badge_choice"], Number(p.fromId ?? p.targetId))),
      );
    if (["wolf_tactical_order", "raven_unsealed"].includes(type))
      release = Math.max(
        release,
        settled(rows(day, ["alchemist_mist", "dreamer"]).filter((d) => type !== "raven_unsealed")),
      );
    if (["raven_knife_skipped", "mist_knife_drawn"].includes(type))
      release = Math.max(release, settled(rows(day, ["wolf_vote"])));
    if (type === "night_resolved")
      release = Math.max(release, settled(rows(day, ["alchemist_snake"])));
    timeline.push({ event, day, release });
  }
  const previous = new Map<number, WireFact[]>();
  for (const d of record.decisions) {
    const feed = d.request.context.visible_events;
    check(feed.every((e, i) => exact(e, ["seq", "type", "payload"]) && e.seq === i + 1));
    const slots = new Set<string>();
    let feedDay = 0,
      phaseRank = -1;
    for (const e of feed) {
      const keys = publicWireKeys[e.type];
      if (keys) check(exact(e.payload, keys));
      if (e.type === "phase_changed") {
        const number = Number(e.payload.day),
          rank =
            e.payload.phase === Phase.Night
              ? 0
              : e.payload.phase === Phase.Day
                ? 1
                : e.payload.phase === Phase.Voting
                  ? 2
                  : 3;
        check(number >= feedDay && (number > feedDay || rank > phaseRank));
        feedDay = number;
        phaseRank = rank;
      }
      if (ownTypes.has(e.type) || packTypes.has(e.type)) {
        check(phaseRank === (e.type === "alchemist_snake_chosen" ? 1 : 0));
        if (e.payload.day !== undefined) check(e.payload.day === feedDay);
      }
      if (e.type === "day_speech") continue;
      const key = JSON.stringify([
        feedDay,
        e.type,
        e.payload.actorId ?? e.payload.fromId ?? e.payload.targetId ?? e.payload.playerId,
        e.type.startsWith("last_words") ? e.payload.phase : undefined,
        e.type === "phase_changed" ? e.payload.phase : undefined,
        e.type.startsWith("wolf_discussion")
          ? e.payload.round
          : e.type.endsWith("vote_summary")
            ? (e.payload.round ?? 1)
            : undefined,
      ]);
      check(!slots.has(key));
      slots.add(key);
    }
    const prior = previous.get(d.actorId) ?? [];
    check(feed.length >= prior.length && equal(feed.slice(0, prior.length), prior));
    previous.set(d.actorId, feed);
    validateElectionFeed(d);
    const opened = record.decisions.slice(0, record.decisions.indexOf(d) + 1);
    for (const words of opened.filter((x) => x.stage === "last_words")) {
      const granted = { playerId: words.actorId, phase: words.request.phase, day: words.day };
      check(feed.some((e) => e.type === "last_words_granted" && equal(e.payload, granted)));
      const a = call(words);
      if (
        words.settleOrder !== undefined &&
        words.settleOrder <= d.openedAfterSettlement &&
        a?.name === "speak"
      )
        check(
          feed.some(
            (e) =>
              e.type === "last_words_spoken" &&
              equal(e.payload, { ...granted, text: sanitizeSpeechText(a.args.text) }),
          ),
        );
    }
    for (let number = 1; number <= d.day; number++) {
      let current = 0;
      const speeches = feed.filter((e) => {
        if (e.type === "phase_changed") current = Number(e.payload.day);
        return current === number && e.type === "day_speech";
      });
      const sources = record.decisions
        .filter(
          (x) =>
            x.day === number &&
            [
              "day_speech",
              "sheriff_campaign_speech",
              "sheriff_pk_speech",
              "exile_pk_speech",
            ].includes(x.stage) &&
            x.settleOrder !== undefined &&
            x.settleOrder <= d.openedAfterSettlement,
        )
        .sort((a, b) => a.settleOrder! - b.settleOrder!)
        .flatMap((x) => {
          const a = call(x);
          return a?.name === "speak"
            ? [{ actorId: x.actorId, text: sanitizeSpeechText(a.args.text) }]
            : [];
        });
      check(
        equal(
          speeches.map((e) => e.payload),
          sources,
        ),
      );
    }
    const expected = timeline
      .filter(
        (t) =>
          visible(t.event, d.actorId) && t.day <= d.day && t.release <= d.openedAfterSettlement,
      )
      .map(({ event }, i) => ({ seq: i + 1, type: event.type, payload: payload(event) }));
    // Checkpoints publish only an event prefix. A live request may have a later, unarchived tail.
    check(feed.length >= expected.length && equal(feed.slice(0, expected.length), expected));
    if (record.finalized || record.checkpoints.some((c) => c.complete && c.cycle >= d.day))
      check(feed.length === expected.length);
    let tailDay = Number(
      [...expected].reverse().find((e) => e.type === "phase_changed")?.payload.day ?? 1,
    );
    let tailPhase: unknown =
      [...expected].reverse().find((e) => e.type === "phase_changed")?.payload.phase ?? Phase.Night;
    for (const e of feed.slice(expected.length)) {
      if (e.type === "phase_changed") {
        tailDay = Number(e.payload.day);
        tailPhase = e.payload.phase;
      }
      validateUnpublished(e, d, tailDay, tailPhase);
    }
    const lastPhase = [...feed].reverse().find((e) => e.type === "phase_changed")?.payload;
    check(lastPhase?.day === d.day && lastPhase.phase === d.request.phase);
  }

  function validateUnpublished(
    e: WireFact,
    d: RecordedDecision,
    factDay: number,
    factPhase: unknown,
  ): void {
    const p = e.payload,
      role = roster.get(d.actorId)!.role;
    check(publicTypes.has(e.type) || ownTypes.has(e.type) || packTypes.has(e.type));
    if (e.type === "phase_changed") {
      check(
        exact(p, ["day", "phase"]) &&
          Number.isSafeInteger(p.day) &&
          Number(p.day) <= d.day &&
          [Phase.Night, Phase.Day, Phase.Voting].includes(p.phase as Phase),
      );
      if (p.day === d.day)
        check(
          [Phase.Night, Phase.Day, Phase.Voting].indexOf(p.phase as Phase) <=
            [Phase.Night, Phase.Day, Phase.Voting].indexOf(d.request.phase),
        );
      return;
    }
    if (
      e.type === "night_resolved" ||
      (e.type.startsWith("sheriff_") && !e.type.startsWith("sheriff_badge"))
    )
      check(factPhase === Phase.Day);
    if (["vote_summary", "exile_pk_started", "voted_out", "idiot_revealed"].includes(e.type))
      check(factPhase === Phase.Voting);
    if (ownTypes.has(e.type)) check(p.actorId === d.actorId);
    if (packTypes.has(e.type)) {
      check(
        role === Role.Wolf ||
          (role === Role.RavenClawWolf &&
            d.request.context.visible_events.some(
              (x) => x.type === "raven_unsealed" && Number(x.payload.day) <= d.day,
            )),
      );
    }
    const source = (
      stages: string[],
      actor: number,
      predicate: (x: RecordedDecision) => boolean,
    ) => {
      const matches = rows(Number(p.day ?? factDay), stages, actor).filter(predicate);
      check(
        matches.length === 1 &&
          matches[0]!.settleOrder !== undefined &&
          matches[0]!.settleOrder! <= d.openedAfterSettlement,
      );
      return call(matches[0]!);
    };
    if ((MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(e.type)) {
      check(readMistRavenFact(e.type, p) && Number(p.day) <= d.day);
      if (e.type === "alchemist_mist_skipped") {
        const n = nights.get(Number(p.day)),
          cp = record.checkpoints.at(-1)!.players.find((x) => x.id === d.actorId)!;
        const start =
          n?.start ??
          record.checkpoints
            .at(-1)!
            .players.filter((x) => x.alive)
            .map((x) => x.id);
        const stock =
          n?.mistStock ?? (cp.privateState.alchemist as { mistRemaining: number }).mistRemaining;
        check(
          role === Role.Alchemist &&
            rows(Number(p.day), ["alchemist_mist"]).length === 0 &&
            p.reason ===
              (!start.includes(d.actorId) ? "dead" : stock === 0 ? "spent" : "no_targets") &&
            (!start.includes(d.actorId) || stock === 0 || start.length < 3),
        );
      } else if (e.type === "alchemist_mist_chosen") {
        const a = source(["alchemist_mist"], d.actorId, () => true);
        check(
          role === Role.Alchemist &&
            a?.name === "cast_mist" &&
            equal(a.args.target_ids, p.targetIds),
        );
      } else if (e.type === "alchemist_snake_chosen" || e.type === "raven_knife_chosen") {
        const stage = e.type === "alchemist_snake_chosen" ? "alchemist_snake" : "raven_knife";
        const a = source([stage], d.actorId, () => true);
        check(
          a?.name === (stage === "alchemist_snake" ? "use_snake" : "raven_knife") &&
            a.args.target_id === p.targetId,
        );
      } else if (e.type === "raven_unsealed") {
        const n = nights.get(Number(p.day));
        const start =
          n?.start ??
          record.checkpoints
            .at(-1)!
            .players.filter((x) => x.alive)
            .map((x) => x.id);
        const wolves = start.filter((id) => roster.get(id)!.camp === Camp.Wolf);
        check(
          role === Role.RavenClawWolf &&
            wolves.length < 3 &&
            equal(
              p.knownTeammateIds,
              wolves.filter((id) => id !== d.actorId).sort((a, b) => a - b),
            ),
        );
      } else if (e.type === "raven_knife_skipped") {
        check(
          role === Role.RavenClawWolf &&
            (p.reason === "sealed"
              ? !nights.get(Number(p.day))?.awake &&
                record.checkpoints.at(-1)!.players.filter((x) => x.alive && x.camp === Camp.Wolf)
                  .length >= 3
              : record.decisions.some(
                  (x) =>
                    x.day < Number(p.day) &&
                    x.stage === "raven_knife" &&
                    call(x)?.name === "raven_knife" &&
                    call(x)!.args &&
                    (call(x)!.args as Record<string, unknown>).target_id !== null,
                )),
        );
      } else {
        const mist = rows(Number(p.day), ["alchemist_mist"])[0],
          a = mist && call(mist);
        const ballots = rows(Number(p.day), ["wolf_vote"]);
        check(
          a?.name === "cast_mist" &&
            ids(a.args.target_ids) &&
            ballots.length > 0 &&
            settled(ballots) <= d.openedAfterSettlement &&
            ballots.every((b) => {
              const action = call(b);
              return action?.name === "kill_vote" && action.args.abstain;
            }) &&
            equal(p.candidates, a.args.target_ids) &&
            p.targetId ===
              a.args.target_ids[
                Math.floor(
                  mistDraw(record.metadata.random.seed, [
                    ...record.metadata.random.path,
                    "night",
                    `day:${p.day}:mist-knife`,
                  ]) * a.args.target_ids.length,
                )
              ],
        );
      }
      return;
    }
    if (e.type === "dream_applied") {
      const a = source(["dreamer"], d.actorId, () => true);
      check(
        role === Role.Dreamer &&
          exact(p, ["actorId", "targetId", "day", "consecutive"]) &&
          a?.name === "dream" &&
          a.args.target_id === p.targetId &&
          typeof p.consecutive === "boolean",
      );
      const earlier = rows(Number(p.day) - 1, ["dreamer"], d.actorId)[0];
      const before = earlier && call(earlier);
      check(p.consecutive === (before?.name === "dream" && before.args.target_id === p.targetId));
      return;
    }
    if (e.type === "seer_checked") {
      const a = source(
        ["seer"],
        d.actorId,
        (x) => x.settleOrder !== undefined && x.settleOrder <= d.openedAfterSettlement,
      );
      check(
        role === Role.Seer &&
          exact(p, ["actorId", "targetId", "isWerewolf", "result"]) &&
          a?.name === "check_identity" &&
          a.args.target_id === p.targetId &&
          p.isWerewolf === (roster.get(Number(p.targetId))?.camp === Camp.Wolf) &&
          equal(p.result, { kind: "camp", camp: roster.get(Number(p.targetId))?.camp }),
      );
      return;
    }
    if (e.type === "wolf_tactical_order") {
      const n = nights.get(factDay),
        start =
          n?.start ??
          record.checkpoints
            .at(-1)!
            .players.filter((x) => x.alive)
            .map((x) => x.id),
        wolves = start.filter((id) => roster.get(id)!.camp === Camp.Wolf),
        awake =
          n?.awake ??
          (wolves.length < 3 ||
            d.request.context.visible_events.some(
              (x) => x.type === "raven_unsealed" && Number(x.payload.day) <= factDay,
            )),
        pack = start.filter(
          (id) =>
            roster.get(id)!.role === Role.Wolf ||
            (roster.get(id)!.role === Role.RavenClawWolf && awake),
        );
      check(
        exact(p, ["order"]) &&
          ids(p.order) &&
          p.order.includes(d.actorId) &&
          equal(
            [...p.order].sort((a, b) => a - b),
            pack.sort((a, b) => a - b),
          ),
      );
      return;
    }
    if (e.type === "wolf_discussion" || e.type === "wolf_discussion_ended") {
      const a = source(["wolf_discussion"], Number(p.actorId), (x) => x.turn === p.round);
      check(
        a?.name === "speak_to_wolves" &&
          (e.type.endsWith("ended")
            ? a.args.end_chat &&
              p.reason === sanitizeSpeechText(a.args.text) &&
              exact(p, ["actorId", "reason", "round"])
            : !a.args.end_chat &&
              p.text === sanitizeSpeechText(a.args.text) &&
              p.endChat === false &&
              exact(p, ["actorId", "text", "endChat", "round"])),
      );
      return;
    }
    if (e.type === "wolf_kill_vote_cast") {
      const a = source(["wolf_vote"], Number(p.actorId), () => true);
      check(
        a?.name === "kill_vote" &&
          exact(p, ["actorId", "targetId", "abstain"]) &&
          equal(a.args, { target_id: p.targetId, abstain: p.abstain }),
      );
      return;
    }
    if (e.type === "sheriff_nomination_summary" || e.type === "sheriff_candidates_finalized") {
      const candidates = rows(factDay, ["sheriff_nomination"])
        .filter((x) => {
          const a = call(x);
          return a?.name === "run_for_sheriff" && a.args.run === true;
        })
        .map((x) => x.actorId);
      const withdrew = rows(factDay, ["sheriff_withdraw"])
        .filter((x) => {
          const a = call(x);
          return a?.name === "run_for_sheriff" && a.args.run === false;
        })
        .map((x) => x.actorId);
      check(
        settled(
          rows(
            factDay,
            e.type === "sheriff_nomination_summary"
              ? ["sheriff_nomination"]
              : ["sheriff_nomination", "sheriff_withdraw"],
          ),
        ) <= d.openedAfterSettlement &&
          exact(p, ["candidates"]) &&
          equal(
            p.candidates,
            e.type === "sheriff_nomination_summary"
              ? candidates
              : candidates.filter((id) => !withdrew.includes(id)),
          ),
      );
      return;
    }
    if (e.type === "sheriff_withdraw_summary") {
      const decisions = rows(factDay, ["sheriff_withdraw"]);
      check(
        settled(decisions) <= d.openedAfterSettlement &&
          exact(p, ["withdrawn"]) &&
          equal(
            p.withdrawn,
            decisions
              .filter((x) => {
                const a = call(x);
                return a?.name === "run_for_sheriff" && !a.args.run;
              })
              .map((x) => x.actorId),
          ),
      );
      return;
    }
    if (e.type === "day_speech") {
      const sources = rows(
        factDay,
        ["day_speech", "sheriff_campaign_speech", "sheriff_pk_speech", "exile_pk_speech"],
        Number(p.actorId),
      ).filter((x) => {
        const a = call(x);
        return (
          a?.name === "speak" &&
          sanitizeSpeechText(a.args.text) === p.text &&
          x.settleOrder !== undefined &&
          x.settleOrder <= d.openedAfterSettlement
        );
      });
      let number = 0;
      const seen = d.request.context.visible_events.slice(0, e.seq).filter((x) => {
        if (x.type === "phase_changed") number = Number(x.payload.day);
        return number === factDay && x.type === e.type && equal(x.payload, p);
      }).length;
      check(exact(p, ["actorId", "text"]) && sources.length >= seen);
      return;
    }
    if (e.type === "sheriff_vote_summary" || e.type === "sheriff_pk_started") return; // Election ledger above.
    if (e.type === "sheriff_direction_chosen") {
      const a = source(["sheriff_choose_direction"], Number(p.sheriffId), () => true);
      check(
        exact(p, ["sheriffId", "direction"]) &&
          p.direction ===
            (a?.name === "choose_direction" &&
            ["clockwise", "counter_clockwise"].includes(a.args.direction)
              ? a.args.direction
              : "clockwise"),
      );
      return;
    }
    if (e.type === "wolf_self_destruct") {
      const a = source([String(p.window)], Number(p.wolfId), (x) => {
        const a = call(x);
        return a?.name === "self_destruct" && a.args.confirm === true;
      });
      const selected = selectedMistBlast(
        rows(factDay, [String(p.window)]),
        d.openedAfterSettlement,
      );
      check(
        roster.get(Number(p.wolfId))?.role === Role.Wolf &&
          a?.name === "self_destruct" &&
          a.args.confirm === true &&
          selected?.actorId === p.wolfId &&
          exact(p, ["wolfId", "window"]),
      );
      return;
    }
    if (e.type === "night_resolved") {
      check(exact(p, ["deaths"]) && equal(p.deaths, unpublishedDamage(d, factDay)));
      return;
    }
    if (e.type === "last_words_granted" || e.type === "last_words_spoken") {
      const before = d.request.context.visible_events.slice(0, e.seq - 1);
      check(p.day === factDay && [Phase.Day, Phase.Voting].includes(p.phase as Phase));
      if (e.type === "last_words_granted")
        check(
          exact(p, ["playerId", "phase", "day"]) &&
            before.some(
              (x) =>
                (x.type === "night_resolved" &&
                  factDay === 1 &&
                  Array.isArray(x.payload.deaths) &&
                  x.payload.deaths.includes(p.playerId)) ||
                (x.type === "voted_out" && x.payload.target === p.playerId),
            ),
        );
      else {
        const a = source(["last_words"], Number(p.playerId), (x) => x.request.phase === p.phase);
        check(
          exact(p, ["playerId", "phase", "day", "text"]) &&
            a?.name === "speak" &&
            sanitizeSpeechText(a.args.text) === p.text &&
            before.some(
              (x) =>
                x.type === "last_words_granted" &&
                x.payload.playerId === p.playerId &&
                x.payload.day === p.day &&
                x.payload.phase === p.phase,
            ),
        );
      }
      return;
    }
    if (e.type === "vote_summary") {
      const stage = p.round === 2 ? "exile_pk_vote" : "voting",
        ds = rows(factDay, [stage]);
      check(ds.length > 0 && settled(ds) <= d.openedAfterSettlement);
      const visibleBefore = d.request.context.visible_events.slice(0, e.seq - 1);
      const live = new Set(
        nights.get(factDay)?.start ??
          record.checkpoints
            .at(-1)!
            .players.filter((x) => x.alive)
            .map((x) => x.id),
      );
      for (const x of visibleBefore) {
        if (x.type === "night_resolved")
          for (const id of x.payload.deaths as number[]) live.delete(id);
        if (x.type === "wolf_self_destruct") live.delete(Number(x.payload.wolfId));
      }
      const pk =
        p.round === 2
          ? visibleBefore.filter((x) => x.type === "exile_pk_started").at(-1)?.payload.candidates
          : undefined;
      const eligible = Array.isArray(pk)
        ? (pk as number[])
        : [...live].filter(
            (id) =>
              !visibleBefore.some((x) => x.type === "idiot_revealed" && x.payload.targetId === id),
          );
      const actors = [...new Set(ds.map((x) => x.actorId))];
      const voters = actors.map((actor) => {
        const attempts = ds.filter((x) => x.actorId === actor);
        check(attempts.length <= 4 && attempts.every((x, i) => x.turn === i + 1));
        const selected = attempts.find((x) => {
          const a = call(x);
          return (
            a?.name === "vote" &&
            typeof a.args.abstain === "boolean" &&
            (a.args.abstain ||
              (typeof a.args.target_id === "number" && eligible.includes(a.args.target_id)))
          );
        });
        const a = selected && call(selected);
        check(!selected || selected === attempts.at(-1));
        let sheriff: unknown;
        for (const event of visibleBefore) {
          if (event.type === "sheriff_direction_chosen") sheriff = event.payload.sheriffId;
          if (event.type === "sheriff_badge_transferred") sheriff = event.payload.toId;
          if (event.type === "sheriff_badge_destroyed") sheriff = null;
        }
        const target = a?.name === "vote" ? a.args.target_id : null,
          abstain = a?.name === "vote" ? a.args.abstain : true;
        return {
          actorId: actor,
          targetId: target,
          abstain,
          weight: abstain ? 0 : actor === sheriff ? 1.5 : 1,
        };
      });
      const tally = new Map<number, number>();
      for (const v of voters)
        if (!v.abstain && v.targetId !== null)
          tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + v.weight);
      const max = Math.max(0, ...tally.values()),
        top = [...tally].filter(([, n]) => n === max).map(([id]) => id);
      check(
        exact(p, ["votes", "target", "round"]) &&
          equal(p.votes, voters) &&
          p.target === (top.length === 1 ? top[0] : null),
      );
      return;
    }
    if (e.type === "exile_pk_started" || e.type === "voted_out" || e.type === "idiot_revealed") {
      const summary = d.request.context.visible_events
        .slice(0, e.seq - 1)
        .filter((x) => x.type === "vote_summary")
        .at(-1)?.payload;
      check(summary);
      if (e.type === "exile_pk_started") {
        const tally = new Map<number, number>();
        for (const v of summary.votes as Array<{
          targetId: number | null;
          abstain: boolean;
          weight: number;
        }>)
          if (!v.abstain && v.targetId !== null)
            tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + v.weight);
        const max = Math.max(0, ...tally.values()),
          top = [...tally]
            .filter(([, n]) => n === max && max > 0)
            .map(([id]) => id)
            .sort((a, b) => a - b);
        check(exact(p, ["candidates"]) && top.length > 1 && equal(p.candidates, top));
      } else
        check(
          exact(p, [e.type === "voted_out" ? "target" : "targetId"]) &&
            (p.target ?? p.targetId) === summary.target &&
            (e.type !== "idiot_revealed" || roster.get(Number(p.targetId))?.role === Role.Idiot),
        );
      return;
    }
    if (e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed") {
      const actor = Number(p.fromId ?? p.targetId),
        ds = rows(factDay, ["sheriff_badge_choice"], actor);
      const a = ds[0] && call(ds[0]),
        candidates = ds[0]?.request.context.badge_candidates;
      check(ds.length === 1 && settled(ds) <= d.openedAfterSettlement && Array.isArray(candidates));
      const successor =
        a?.name === "choose_badge_successor" &&
        a.args.target_id !== null &&
        candidates.includes(a.args.target_id)
          ? a.args.target_id
          : null;
      check(
        e.type === "sheriff_badge_transferred"
          ? p.toId === successor && successor !== null
          : successor === null,
      );
      return;
    }
    // Public publication facts need the full state ledger; never trust a request's own claim.
    check(false);
  }

  function validateElectionFeed(d: RecordedDecision): void {
    const ledger = createMistSheriffEvidence(record);
    const alive = new Set(record.metadata.players.map((p) => p.id));
    let number = 1,
      phase = Phase.Night;
    const accept = (e: RecordedGameEvent) =>
      ledger.accept(e, {
        day: number,
        phase,
        alive,
        idiot: record.metadata.players.find((p) => p.role === Role.Idiot)!.id,
        idiotRevealed: false,
      });
    for (const e of d.request.context.visible_events) {
      if (e.type === "phase_changed") {
        number = Number(e.payload.day);
        phase = e.payload.phase as Phase;
      }
      if (e.type === "wolf_self_destruct") alive.delete(Number(e.payload.wolfId));
      if (e.type === "night_resolved")
        for (const id of e.payload.deaths as number[]) alive.delete(id);
      if (e.type === "sheriff_nomination_summary" || e.type === "sheriff_withdraw_summary") {
        const stage =
          e.type === "sheriff_nomination_summary" ? "sheriff_nomination" : "sheriff_withdraw";
        check(settled(rows(number, [stage])) <= d.openedAfterSettlement);
        for (const x of rows(number, [stage])) {
          const a = call(x);
          if (
            a?.name === "run_for_sheriff" &&
            typeof a.args.run === "boolean" &&
            (stage === "sheriff_nomination" || a.args.run === false)
          )
            accept({
              type: "sheriff_candidate_declared",
              timestamp: 0,
              payload: { actorId: x.actorId, run: a.args.run },
            });
        }
      }
      if (e.type === "sheriff_vote_summary") {
        const stage = e.payload.round === 2 ? "sheriff_pk_vote" : "sheriff_vote";
        check(settled(rows(number, [stage])) <= d.openedAfterSettlement);
        for (const x of rows(number, [stage])) {
          const a = call(x);
          if (
            a?.name === "vote_for_sheriff" &&
            typeof a.args.abstain === "boolean" &&
            (a.args.target_id === null ||
              (Number.isSafeInteger(a.args.target_id) && a.args.target_id! > 0)) &&
            (a.args.abstain
              ? a.args.target_id === null
              : x.request.context.sheriff_candidates?.includes(a.args.target_id!))
          )
            accept({
              type: "sheriff_vote_cast",
              timestamp: 0,
              payload: { actorId: x.actorId, targetId: a.args.target_id, abstain: a.args.abstain },
            });
        }
      }
      accept({ type: e.type, timestamp: 0, payload: e.payload });
    }
  }
  function unpublishedDamage(d: RecordedDecision, number: number): number[] {
    const n = nights.get(number),
      start =
        n?.start ??
        record.checkpoints
          .at(-1)!
          .players.filter((p) => p.alive)
          .map((p) => p.id);
    const before = record.decisions.filter(
      (x) =>
        x.day === number && x.settleOrder !== undefined && x.settleOrder <= d.openedAfterSettlement,
    );
    const action = (stage: string) => {
      const x = before.find((x) => x.stage === stage);
      return x && call(x);
    };
    const ballots = before.filter((x) => x.stage === "wolf_vote"),
      tally = new Map<number, number>();
    check(ballots.length > 0);
    for (const x of ballots) {
      const a = call(x);
      check(a?.name === "kill_vote");
      if (!a.args.abstain && a.args.target_id !== null)
        tally.set(a.args.target_id, (tally.get(a.args.target_id) ?? 0) + 1);
    }
    const max = Math.max(0, ...tally.values());
    const mist = action("alchemist_mist"),
      circle = mist?.name === "cast_mist" ? mist.args.target_ids : null;
    const knife =
      max > 0
        ? Math.min(...[...tally].filter(([, v]) => v === max).map(([id]) => id))
        : (circle?.[
            Math.floor(
              mistDraw(record.metadata.random.seed, [
                ...record.metadata.random.path,
                "night",
                `day:${number}:mist-knife`,
              ]) * circle.length,
            )
          ] ?? null);
    const dream = action("dreamer"),
      m = dream?.name === "dream" ? dream.args.target_id : null;
    const previous = rows(number - 1, ["dreamer"])[0],
      prior = previous && call(previous);
    const consecutive = prior?.name === "dream" && prior.args.target_id === m;
    const extra = action("raven_knife"),
      raven = extra?.name === "raven_knife" ? extra.args.target_id : null;
    const snake = action("alchemist_snake"),
      heal = snake?.name === "use_snake" ? snake.args.target_id : null;
    const alchemist = record.metadata.players.find((p) => p.role === Role.Alchemist)!.id;
    const stock = record.checkpoints.at(-1)!.players.find((p) => p.id === alchemist)!.privateState
      .alchemist as { healRemaining: number };
    if (n?.delay ?? (start.includes(alchemist) && stock.healRemaining === 1))
      check(snake?.name === "use_snake");
    const alive = new Set(start);
    const blast = selectedMistBlast(
      record.decisions.filter((x) => x.day === number && x.request.actionWindow !== "on_pre_vote"),
      d.openedAfterSettlement,
    );
    if (blast) alive.delete(blast.actorId);
    const causes = new Map<number, string[]>();
    const add = (id: number, cause: string) => {
      if (alive.has(id)) causes.set(id, [...(causes.get(id) ?? []), cause]);
    };
    if (knife !== null && knife !== m) add(knife, "wolf_kill");
    if (m !== null && consecutive) add(m, "dream");
    const ordered = [...causes].sort(([a], [b]) => a - b);
    causes.clear();
    for (const [id, list] of ordered) causes.set(id, list);
    if (raven !== null) add(raven, "raven_claw_knife");
    if (heal !== null) {
      const remaining = (causes.get(heal) ?? []).filter((c) => c !== "wolf_kill");
      if (remaining.length) causes.set(heal, remaining);
      else causes.delete(heal);
    }
    const dreamer = record.metadata.players.find((p) => p.role === Role.Dreamer)!.id;
    if (m !== null && causes.has(dreamer)) add(m, "dream");
    return [...causes.keys()];
  }
}
