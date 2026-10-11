import { Role, Camp, Phase } from "../core/domain/identity";
import type { RecordedDecision, ReproductionRecord } from "./reproduction";
const strictStages = {
  alchemist_mist: "cast_mist",
  dreamer: "dream",
  wolf_discussion: "speak_to_wolves",
  wolf_vote: "kill_vote",
  raven_knife: "raven_knife",
  seer: "check_identity",
  alchemist_snake: "use_snake",
} as const;
const privateFields = [
  "mist_candidates",
  "wolf_kill_candidates",
  "snake_target",
  "snake_candidates",
  "raven_candidates",
];
const stageTools: Record<string, string[]> = {
  ...Object.fromEntries(Object.entries(strictStages).map(([stage, tool]) => [stage, [tool]])),
  on_pre_election: ["self_destruct"],
  on_daybreak: ["self_destruct"],
  on_per_speech_gap: ["self_destruct"],
  on_pre_vote: ["self_destruct"],
  sheriff_nomination: ["run_for_sheriff"],
  sheriff_withdraw: ["run_for_sheriff"],
  sheriff_campaign_speech: ["speak"],
  sheriff_pk_speech: ["speak"],
  sheriff_vote: ["vote_for_sheriff"],
  sheriff_pk_vote: ["vote_for_sheriff"],
  sheriff_choose_direction: ["choose_direction"],
  sheriff_badge_choice: ["choose_badge_successor"],
  day_speech: ["speak"],
  last_words: ["speak"],
  voting: ["vote"],
  exile_pk_speech: ["speak"],
  exile_pk_vote: ["vote"],
};
export function check(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_mist_raven_invalid");
}
/** Archive-only selection: intents share a batch; only its lowest ID is applied. */
export function selectedMistBlast(
  decisions: readonly RecordedDecision[],
  receiverOpenedAfter?: number,
  eligibleActors?: readonly number[],
): RecordedDecision | undefined {
  const choices = decisions.filter(
    (d) =>
      d.outcome.kind === "action" &&
      d.outcome.action?.name === "self_destruct" &&
      d.outcome.action.args.confirm === true &&
      (receiverOpenedAfter === undefined ||
        (d.settleOrder !== undefined && d.settleOrder <= receiverOpenedAfter)),
  );
  const first = choices[0];
  if (!first) return;
  check(
    choices.every(
      (d) =>
        d.day === first.day &&
        d.stage === first.stage &&
        d.turn === first.turn &&
        d.openedAfterSettlement === first.openedAfterSettlement &&
        d.request.actionWindow === first.request.actionWindow,
    ),
  );
  check(new Set(choices.map((d) => d.actorId)).size === choices.length);
  const turns = new Map<number, number>(),
    batch: RecordedDecision[] = [];
  for (const d of decisions.filter((d) => d.day === first.day && d.stage === first.stage)) {
    const turn = (turns.get(d.actorId) ?? 0) + 1;
    turns.set(d.actorId, turn);
    check(d.turn === turn && d.request.actionWindow === d.stage);
    if (turn === first.turn) batch.push(d);
  }
  check(
    batch.every(
      (d) =>
        d.openedAfterSettlement === first.openedAfterSettlement &&
        d.outcome.kind === "action" &&
        d.settleOrder !== undefined &&
        (receiverOpenedAfter === undefined || d.settleOrder <= receiverOpenedAfter),
    ),
  );
  if (eligibleActors)
    check(
      equal(
        batch.map((d) => d.actorId).sort((a, b) => a - b),
        [...eligibleActors].sort((a, b) => a - b),
      ),
    );
  return choices.reduce((a, b) => (a.actorId < b.actorId ? a : b));
}
export function equal(a: unknown, b: unknown): boolean {
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
export function ids(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((v) => Number.isSafeInteger(v) && v > 0 && v <= 12) &&
    new Set(value).size === value.length
  );
}
export function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((k) => Object.hasOwn(value, k))
  );
}
export function mistDraw(seed: string, path: readonly string[]): number {
  const input = JSON.stringify([seed, ...path]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++)
    hash = Math.imul(hash ^ input.charCodeAt(i), 0x01000193) >>> 0;
  let value = (hash + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export interface MistNightRequestEvidence {
  start: number[];
  mistStock: number;
  snakeStock: number;
  extraStock: number;
  awake: boolean;
  delay: boolean;
  circle: number[] | null;
  publishedDay: boolean;
}
export function validateMistRavenRequests(input: {
  record: ReproductionRecord;
  nights: ReadonlyMap<number, MistNightRequestEvidence>;
  alive: ReadonlySet<number>;
  alchemistState: { mistRemaining: number; healRemaining: number };
  ravenState: { awakenedDay: number | null; extraRemaining: number };
  actors: { alchemist: number; raven: number; dreamer: number; seer: number };
}): void {
  const {
    record,
    nights,
    alive,
    alchemistState,
    ravenState,
    actors: { alchemist, raven, dreamer, seer },
  } = input;
  const lastNight = Math.max(0, ...nights.keys()),
    roster = new Map(record.metadata.players.map((p) => [p.id, p]));
  const failure = record.checkpoints.at(-1),
    last = record.decisions.at(-1);
  const tailStart = [...alive],
    tailWolves = tailStart.filter((id) => roster.get(id)!.camp === Camp.Wolf);
  const inferred = new Map<
    number,
    {
      start: number[];
      mistStock: number;
      snakeStock: number;
      extraStock: number;
      awake: boolean;
      delay: boolean;
      circle: number[] | null;
      publishedDay: boolean;
    }
  >();
  for (const [day, n] of nights) inferred.set(day, n);
  const tail = lastNight + 1;
  if (record.decisions.some((d) => d.day === tail)) {
    check(!failure?.snapshot.gameOver);
    inferred.set(tail, {
      start: tailStart,
      mistStock: alchemistState.mistRemaining,
      snakeStock: alchemistState.healRemaining,
      extraStock: ravenState.extraRemaining,
      awake:
        ravenState.awakenedDay !== null || (tailStart.includes(raven) && tailWolves.length < 3),
      delay: tailStart.includes(alchemist) && alchemistState.healRemaining === 1,
      circle: null,
      publishedDay: false,
    });
  }
  const rank: Record<string, number> = {
    alchemist_mist: 10,
    dreamer: 20,
    wolf_discussion: 30,
    wolf_vote: 40,
    raven_knife: 50,
    seer: 60,
  };
  const valid = new Map<RecordedDecision, boolean>();
  const getCall = (d: RecordedDecision) => (d.outcome.kind === "action" ? d.outcome.action : null);
  const rows = (day: number, stage: string, id?: number) =>
    record.decisions.filter(
      (d) => d.day === day && d.stage === stage && (id === undefined || d.actorId === id),
    );
  for (const [day, n] of inferred) {
    const mist = rows(day, "alchemist_mist")[0],
      call = mist && getCall(mist);
    const provisional = call?.name === "cast_mist" ? call.args.target_ids : null;
    const circle = n.circle ?? provisional;
    const pack = n.start.filter(
      (id) => roster.get(id)!.role === Role.Wolf || (id === raven && n.awake),
    );
    for (const d of record.decisions.filter((d) => d.day === day)) {
      check(
        Object.hasOwn(stageTools, d.stage) && equal(d.request.allowedTools, stageTools[d.stage]),
      );
      check(
        d.request.actorId === d.actorId &&
          d.request.context.day === day &&
          d.request.context.stage === d.stage,
      );
      const c = d.request.context;
      if (!Object.hasOwn(strictStages, d.stage)) {
        check(n.start.includes(d.actorId));
        const voting = ["on_pre_vote", "voting", "exile_pk_vote", "exile_pk_speech"].includes(
          d.stage,
        );
        check(
          ["last_words", "sheriff_badge_choice"].includes(d.stage)
            ? [Phase.Day, Phase.Voting].includes(d.request.phase)
            : d.request.phase === (voting ? Phase.Voting : Phase.Day),
        );
        if (d.stage.startsWith("on_")) {
          check(
            roster.get(d.actorId)!.role === Role.Wolf &&
              (d.stage !== "on_pre_election" || day === 1) &&
              !c.visible_events.some(
                (e) =>
                  (e.type === "night_resolved" &&
                    Array.isArray(e.payload.deaths) &&
                    e.payload.deaths.includes(d.actorId)) ||
                  (e.type === "wolf_self_destruct" && e.payload.wolfId === d.actorId),
              ),
          );
        }
      }
      for (const field of privateFields) {
        const present = Object.hasOwn(c, field),
          belongs =
            field === "mist_candidates"
              ? d.stage === "alchemist_mist"
              : field === "wolf_kill_candidates"
                ? ["wolf_discussion", "wolf_vote"].includes(d.stage)
                : field === "raven_candidates"
                  ? d.stage === "raven_knife"
                  : d.stage === "alchemist_snake";
        check(present === belongs);
      }
      check(c.wolf_target === undefined && c.wolf_targets === undefined);
      const tool = strictStages[d.stage as keyof typeof strictStages];
      if (!tool) continue;
      const expectedActor = ["alchemist_mist", "alchemist_snake"].includes(d.stage)
        ? alchemist
        : d.stage === "raven_knife"
          ? raven
          : d.stage === "dreamer"
            ? dreamer
            : d.stage === "seer"
              ? seer
              : null;
      check(expectedActor === null || d.actorId === expectedActor);
      check(
        d.request.phase === (d.stage === "alchemist_snake" ? Phase.Day : Phase.Night) &&
          equal(d.request.allowedTools, [tool]) &&
          c.allow_fallback === false &&
          c.action_failure_policy === "error" &&
          c.turn_constraints.min_valid_actions === 1 &&
          c.turn_constraints.max_valid_actions === 1 &&
          equal(c.turn_constraints.required_any_tools, [tool]),
      );
      check(
        d.stage === "wolf_discussion"
          ? d.turn >= 1 && d.turn <= 3 && c.round === d.turn && c.max_rounds === 3
          : d.turn === 1,
      );
      if (d.stage === "alchemist_mist")
        check(
          n.start.includes(alchemist) &&
            n.mistStock === 1 &&
            n.start.length >= 3 &&
            equal(c.mist_candidates, n.start),
        );
      if (d.stage === "raven_knife")
        check(
          n.start.includes(raven) &&
            n.awake &&
            n.extraStock === 1 &&
            equal(
              c.raven_candidates,
              n.start.filter((id) => id !== raven),
            ),
        );
      if (d.stage === "dreamer")
        check(n.start.includes(dreamer) && c.ability_id === "native:dream");
      if (d.stage === "seer") check(n.start.includes(seer) && c.ability_id === "native:seer_check");
      if (d.stage === "alchemist_snake") check(n.delay);
      if (d.stage === "wolf_discussion" || d.stage === "wolf_vote")
        check(pack.includes(d.actorId) && equal(c.wolf_kill_candidates, circle ?? n.start));
      const a = getCall(d);
      let accepted = false;
      if (a?.name === tool) {
        const args = a.args as unknown as Record<string, unknown>;
        if (tool === "cast_mist")
          accepted =
            exact(args, ["target_ids"]) &&
            (args.target_ids === null ||
              (ids(args.target_ids) &&
                args.target_ids.length === 3 &&
                args.target_ids.every((id) => n.start.includes(id))));
        else if (tool === "speak_to_wolves")
          accepted =
            exact(args, ["text", "end_chat"]) &&
            typeof args.text === "string" &&
            typeof args.end_chat === "boolean";
        else if (tool === "kill_vote")
          accepted =
            exact(args, ["target_id", "abstain"]) &&
            typeof args.abstain === "boolean" &&
            (args.abstain
              ? args.target_id === null
              : typeof args.target_id === "number" && (circle ?? n.start).includes(args.target_id));
        else if (tool === "use_snake")
          accepted =
            exact(args, ["target_id"]) &&
            (args.target_id === null ||
              (typeof args.target_id === "number" &&
                c.snake_candidates?.includes(args.target_id) === true));
        else
          accepted =
            exact(args, ["target_id"]) &&
            ((tool === "raven_knife" && args.target_id === null) ||
              (typeof args.target_id === "number" &&
                args.target_id !== d.actorId &&
                n.start.includes(args.target_id)));
      }
      valid.set(d, accepted && d.settleOrder !== undefined);
      // Invalid raw replies are evidence only in an explicit terminal failed CP;
      // they cannot become a committed fact or authorize any successor request.
      if (d.outcome.kind === "action" && !accepted)
        check(d === last && failure?.complete === false && failure.snapshot.day === day);
    }
    const chain = record.decisions.filter(
      (d) => d.day === day && d.request.phase === Phase.Night && Object.hasOwn(rank, d.stage),
    );
    for (let i = 0; i < chain.length; i++) {
      const d = chain[i]!;
      if (i > 0) {
        const previous = chain[i - 1]!;
        check(
          valid.get(previous) &&
            previous.settleOrder !== undefined &&
            d.openedAfterSettlement >= previous.settleOrder &&
            rank[d.stage]! >= rank[previous.stage]!,
        );
      }
    }
    const dayRows = record.decisions.filter(
      (d) => d.day === day && d.request.phase !== Phase.Night,
    );
    const progress = Math.max(
      0,
      ...chain.map((d) => rank[d.stage]!),
      dayRows.length || n.publishedDay ? 70 : 0,
    );
    const one = (stage: string, id: number, eligible: boolean) => {
      const list = rows(day, stage, id),
        stageRank = rank[stage]!;
      check(list.length <= 1 && (eligible || list.length === 0));
      if (eligible && progress >= stageRank) check(list.length === 1);
      if (eligible && progress > stageRank) check(valid.get(list[0]!));
    };
    one(
      "alchemist_mist",
      alchemist,
      n.start.includes(alchemist) && n.mistStock === 1 && n.start.length >= 3,
    );
    one("dreamer", dreamer, n.start.includes(dreamer) && n.start.length > 1);
    one(
      "raven_knife",
      raven,
      n.start.includes(raven) && n.awake && n.extraStock === 1 && n.start.length > 1,
    );
    one("seer", seer, n.start.includes(seer) && n.start.length > 1);
    for (const id of pack) {
      const chats = rows(day, "wolf_discussion", id),
        votes = rows(day, "wolf_vote", id);
      check(chats.length <= 3 && votes.length <= 1);
      for (let i = 0; i < chats.length; i++) check(chats[i]!.turn === i + 1);
      if (progress > 30) {
        check(chats.length >= 1 && chats.every((d) => valid.get(d)));
        const a = getCall(chats.at(-1)!);
        check(a?.name === "speak_to_wolves" && (a.args.end_chat || chats.length === 3));
      }
      if (progress > 40) check(votes.length === 1 && valid.get(votes[0]!));
    }
    if (dayRows.length && chain.length) {
      const finished = chain.at(-1)!;
      check(
        valid.get(finished) &&
          finished.settleOrder !== undefined &&
          dayRows[0]!.openedAfterSettlement >= finished.settleOrder,
      );
    }
    const snakes = rows(day, "alchemist_snake");
    check(snakes.length <= 1 && (n.delay || snakes.length === 0));
    if (snakes.length) {
      const d = snakes[0]!,
        votes = rows(day, "wolf_vote");
      check(votes.length === pack.length && votes.every((d) => valid.get(d)));
      const tally = new Map<number, number>();
      for (const v of votes) {
        const a = getCall(v);
        check(a?.name === "kill_vote");
        if (!a.args.abstain && a.args.target_id !== null)
          tally.set(a.args.target_id, (tally.get(a.args.target_id) ?? 0) + 1);
      }
      let knife: number | null = null;
      if (tally.size) {
        const max = Math.max(...tally.values());
        knife = Math.min(...[...tally].filter(([, v]) => v === max).map(([id]) => id));
      } else if (circle !== null) {
        check(circle.length === 3 && pack.length > 0);
        knife =
          circle[
            Math.floor(
              mistDraw(record.metadata.random.seed, [
                ...record.metadata.random.path,
                "night",
                `day:${day}:mist-knife`,
              ]) * circle.length,
            )
          ]!;
      }
      const blasts = record.decisions.filter((b) => b.day === day && b.stage.startsWith("on_"));
      const blast = selectedMistBlast(
        blasts,
        d.openedAfterSettlement,
        n.start.filter((id) => roster.get(id)?.role === Role.Wolf),
      );
      for (const intent of blasts)
        check(roster.get(intent.actorId)?.role === Role.Wolf && n.start.includes(intent.actorId));
      if (blast) {
        const b = getCall(blast);
        check(
          roster.get(blast.actorId)?.role === Role.Wolf &&
            n.start.includes(blast.actorId) &&
            b?.name === "self_destruct" &&
            b.args.confirm === true &&
            blast.request.actionWindow !== "on_pre_vote",
        );
      }
      const living = n.start.filter((id) => id !== blast?.actorId),
        legal =
          knife !== null && living.includes(knife) && (day === 1 || knife !== alchemist)
            ? [knife]
            : [];
      check(
        d.request.context.snake_target === knife &&
          equal(d.request.context.snake_candidates, legal),
      );
      if (!blast) {
        const speeches = rows(day, "day_speech");
        check(
          equal(
            speeches.map((s) => s.actorId).sort((a, b) => a - b),
            [...living].sort((a, b) => a - b),
          ) &&
            speeches.every(
              (s) => s.settleOrder !== undefined && s.settleOrder <= d.openedAfterSettlement,
            ),
        );
      }
    }
  }
  check(record.decisions.every((d) => inferred.has(d.day)));
}
