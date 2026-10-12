/**
 * Responsibility: independently verify recorded order prince execution evidence.
 * Input: immutable reproduction decisions, facts, operations and checkpoints;
 * output: accepted evidence or the existing stable reproduction rejection.
 * This verifier owns its reconstructed arithmetic/state and never authorizes
 * engine actions, pays resources or invokes production settlement as its oracle.
 * Shared readers only establish data shape; historical success and failure
 * prefixes, causal cursors and feature-specific policy checks remain unchanged.
 */
import { isTimeConsortPreset } from "@ai-werewolf-arena/game-text";
import { isTricksterPreset } from "@ai-werewolf-arena/game-text";
import { readExileMappingFact } from "@ai-werewolf-arena/game-contract/facts/trickster";
import { sanitizeSpeechText } from "../utils/speech_text";
import {
  readOrderPrinceChoiceFact,
  readOrderPrinceRevoteFact,
} from "@ai-werewolf-arena/game-contract/facts/order-prince";
import { Camp, Role, Phase, WinCondition } from "../core/domain";
import type { ReproductionRecord, RecordedDecision } from "./reproduction";
const choiceType = "order_prince_choice_committed",
  resetType = "order_prince_revote_started";
const policy = "awa_order_prince_first_ballot_v1";
function check(value: unknown): asserts value {
  if (!value) throw new Error("reproduction_order_prince_invalid");
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
function strict(d: RecordedDecision): void {
  check(
    d.request.phase === Phase.Voting &&
      d.request.actorId === d.actorId &&
      d.request.context.day === d.day &&
      d.request.context.stage === d.stage,
  );
  check(
    d.request.context.action_failure_policy === "error" &&
      d.request.context.allow_fallback === false,
  );
}
export function validateOrderPrinceRecord(record: ReproductionRecord): void {
  const board = record.metadata.normalizedBoard;
  const owns = board.roleSetups.some((r) => r.role === Role.OrderPrince && r.count > 0);
  const artifacts =
    record.events.some((e) => e.type === choiceType || e.type === resetType) ||
    record.decisions.some(
      (d) =>
        d.stage.startsWith("order_prince") || d.request.allowedTools.includes("reset_exile_vote"),
    ) ||
    record.checkpoints.some((c) =>
      c.players.some((p) => Object.hasOwn(p.privateState, "orderPrince")),
    );
  if (!owns) {
    check(
      !board.orderPrince &&
        !artifacts &&
        !record.metadata.players.some((p) => p.role === Role.OrderPrince),
    );
    return;
  }
  const expected = { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, order_prince: 1 };
  const tricksterBoard = isTricksterPreset(board);
  check(
    isTimeConsortPreset(board) ||
      tricksterBoard ||
      (board.boardSize === 12 &&
        board.roleSetups.length === 6 &&
        equal(Object.fromEntries(board.roleSetups.map((r) => [r.role, r.count])), expected)),
  );
  const mappedDays = new Set<number>();
  const rawFinalTargets = new Map<number, number | null>();
  check(
    board.orderPrince?.policy === policy &&
      equal(board.winConditions, [WinCondition.SlaughterSide]) &&
      board.voting?.exilePolicy === "awa_one_pk_v1",
  );
  const original = new Map(record.metadata.players.map((p) => [p.id, p]));
  const actors = record.metadata.players.filter((p) => p.role === Role.OrderPrince);
  check(original.size === 12 && actors.length === 1 && actors[0]!.camp === Camp.Good);
  const actor = actors[0]!.id,
    alive = new Set(original.keys());
  const histories: Array<Array<{ day: number; activate: boolean }>> = [[]],
    living: number[][] = [[...alive]];
  const history: Array<{ day: number; activate: boolean }> = [],
    facts = new Map<number, { activate: boolean }>();
  const pkSpeakers = new Set<number>();
  const resetDays = new Set<number>(),
    votingDays = new Set<number>();
  let day = 1,
    phase: Phase = Phase.Night,
    spent = false,
    round = 1,
    reset = false;
  let sheriff: number | null = null;
  const sheriffPrefixes: Array<number | null> = [null];
  let votes: Array<{ actorId: number; targetId: number | null; abstain: boolean; weight: number }> =
    [];
  let candidates: number[] | null = null,
    finalTarget: number | null = null,
    speech = false;
  const uniqueTop = () => {
    const tally = new Map<number, number>();
    for (const vote of votes)
      if (!vote.abstain && vote.targetId !== null)
        tally.set(vote.targetId, (tally.get(vote.targetId) ?? 0) + vote.weight);
    const max = Math.max(0, ...tally.values());
    return {
      tally: Object.fromEntries(tally),
      top: [...tally]
        .filter(([, n]) => n === max)
        .map(([id]) => id)
        .sort((a, b) => a - b),
    };
  };
  for (const e of record.events) {
    if (e.type === "phase_changed") {
      check(
        Number.isSafeInteger(e.payload.day) &&
          typeof e.payload.day === "number" &&
          e.payload.day > 0,
      );
      day = e.payload.day;
      phase = e.payload.phase as Phase;
      if (phase === Phase.Voting) {
        round = 1;
        reset = false;
        votes = [];
        candidates = null;
        finalTarget = null;
        speech = false;
        votingDays.add(day);
      }
    }
    if (e.type === "sheriff_elected") {
      check(typeof e.payload.winnerId === "number" && alive.has(e.payload.winnerId));
      sheriff = e.payload.winnerId;
    }
    if (e.type === "sheriff_badge_transferred") {
      check(
        e.payload.fromId === sheriff &&
          typeof e.payload.toId === "number" &&
          alive.has(e.payload.toId),
      );
      sheriff = e.payload.toId;
    }
    if (e.type === "sheriff_badge_destroyed") {
      check(e.payload.targetId === sheriff);
      sheriff = null;
    }
    if (e.type === "day_speech" && phase === Phase.Voting && reset && round === 2) {
      const speaker = e.payload.actorId;
      check(
        typeof speaker === "number" &&
          (candidates as number[] | null)?.includes(speaker) &&
          !pkSpeakers.has(speaker),
      );
      const ds = record.decisions.filter(
        (d) => d.day === day && d.actorId === speaker && d.stage === "exile_pk_speech",
      );
      check(ds.length === 1);
      const d = ds[0]!;
      strict(d);
      check(
        d.outcome.kind === "action" &&
          d.outcome.action?.name === "speak" &&
          sanitizeSpeechText(d.outcome.action.args.text) === e.payload.text,
      );
      pkSpeakers.add(speaker);
    }
    if (e.type === "vote_cast") {
      if (reset && round === 2) check(candidates && pkSpeakers.size === candidates.length);
      check(phase === Phase.Voting);
      const { actorId, targetId, abstain, weight } = e.payload;
      check(
        typeof actorId === "number" &&
          alive.has(actorId) &&
          !votes.some((v) => v.actorId === actorId),
      );
      check(typeof abstain === "boolean" && typeof weight === "number" && Number.isFinite(weight));
      check(
        abstain
          ? targetId === null && weight === 0
          : typeof targetId === "number" && alive.has(targetId) && weight > 0,
      );
      const voteStage = round === 2 ? "exile_pk_vote" : reset ? "order_prince_revote" : "voting";
      const ds = record.decisions.filter(
        (d) => d.actorId === actorId && d.day === day && d.stage === voteStage,
      );
      const matched = ds.some(
        (d) =>
          d.outcome.kind === "action" &&
          d.outcome.action?.name === "vote" &&
          d.outcome.action.args.target_id === targetId &&
          (d.outcome.action.args.abstain === true) === abstain,
      );
      check(matched || (!reset && abstain && e.payload.fallback === true && ds.length > 0));
      if (reset) for (const d of ds) strict(d);
      check(
        weight === (abstain ? 0 : actorId === sheriff ? (board.sheriff?.voteWeight ?? 1.5) : 1),
      );
      if (candidates) {
        check(!candidates.includes(actorId));
        if (!abstain) check(candidates.includes(targetId as number));
      }
      if (reset) check(speech);
      votes.push({ actorId, targetId: targetId as number | null, abstain, weight });
    }
    if (e.type === choiceType) {
      const fact = readOrderPrinceChoiceFact(e.type, e.payload);
      check(
        fact &&
          fact.actorId === actor &&
          fact.day === day &&
          phase === Phase.Voting &&
          round === 1 &&
          !spent &&
          !facts.has(day) &&
          alive.has(actor),
      );
      check(e.audience?.length === 1 && e.audience[0] === actor);
      const ds = record.decisions.filter((d) => d.day === day && d.stage === "order_prince_choice");
      check(ds.length === 1);
      const d = ds[0]!;
      strict(d);
      check(d.actorId === actor && equal(d.request.allowedTools, ["reset_exile_vote"]));
      check(
        d.outcome.kind === "action" &&
          d.outcome.action?.name === "reset_exile_vote" &&
          equal(d.outcome.action.args, { activate: fact.activate }),
      );
      check(votes.length === alive.size);
      history.push({ day, activate: fact.activate });
      facts.set(day, { activate: fact.activate });
      spent = fact.activate;
    }
    if (e.type === resetType) {
      const fact = readOrderPrinceRevoteFact(e.type, e.payload);
      check(
        fact?.actorId === actor &&
          e.audience === undefined &&
          phase === Phase.Voting &&
          facts.get(day)?.activate === true &&
          !resetDays.has(day),
      );
      resetDays.add(day);
      reset = true;
      votes = [];
      candidates = null;
      finalTarget = null;
      rawFinalTargets.set(day, null);
    }
    if (e.type === "day_speech" && reset && e.payload.actorId === actor && !speech) {
      const ds = record.decisions.filter((d) => d.day === day && d.stage === "order_prince_speech");
      check(ds.length === 1);
      const d = ds[0]!;
      strict(d);
      check(
        d.actorId === actor &&
          d.outcome.kind === "action" &&
          d.outcome.action?.name === "speak" &&
          sanitizeSpeechText(d.outcome.action.args.text) === e.payload.text,
      );
      speech = true;
    }
    if (e.type === "vote_summary") {
      const expectedVoters = [...alive]
        .filter((id) => !candidates?.includes(id))
        .sort((a, b) => a - b);
      check(
        equal(
          votes.map((v) => v.actorId).sort((a, b) => a - b),
          expectedVoters,
        ),
      );
      if (reset && round === 2) check(candidates && pkSpeakers.size === candidates.length);
      check(phase === Phase.Voting && equal(e.payload.votes, votes));
      const tally = uniqueTop();
      check(equal(e.payload.tally, tally.tally));
      check(e.payload.target === (tally.top.length === 1 ? tally.top[0] : null));
      if (alive.has(actor) && !spent) check(facts.has(day));
      if (reset) check(speech);
      finalTarget = e.payload.target as number | null;
      rawFinalTargets.set(day, finalTarget);
    }
    if (e.type === "exile_pk_started") {
      const top = uniqueTop().top;
      check(
        round === 1 &&
          top.length > 1 &&
          equal(
            [...(e.payload.candidates as number[])].sort((a, b) => a - b),
            top,
          ),
      );
      round = 2;
      pkSpeakers.clear();
      candidates = top;
      votes = [];
      finalTarget = null;
      rawFinalTargets.set(day, null);
    }
    if (e.type === "exile_target_mapped") {
      const f = readExileMappingFact(e.type, e.payload);
      check(
        tricksterBoard &&
          f &&
          phase === Phase.Voting &&
          e.audience === undefined &&
          !mappedDays.has(day) &&
          finalTarget !== null &&
          f.requestedId === finalTarget &&
          original.has(f.effectiveId) &&
          f.missed === !alive.has(f.effectiveId),
      );
      mappedDays.add(day);
      finalTarget = f.missed ? null : f.effectiveId;
    }
    if (e.type === "voted_out") {
      if (tricksterBoard) check(mappedDays.has(day));
      check(
        typeof e.payload.target === "number" &&
          e.payload.target === finalTarget &&
          alive.has(e.payload.target),
      );
      alive.delete(e.payload.target);
    }
    if (e.type === "night_resolved" || e.type === "additional_deaths") {
      check(Array.isArray(e.payload.deaths));
      for (const id of e.payload.deaths) {
        check(typeof id === "number" && original.has(id));
        alive.delete(id);
      }
    }
    if (e.type === "wolf_self_destruct") {
      check(
        typeof e.payload.wolfId === "number" && original.get(e.payload.wolfId)?.camp === Camp.Wolf,
      );
      alive.delete(e.payload.wolfId);
    }
    if (e.type === "hunter_shot" || e.type === "player_shot") {
      check(typeof e.payload.targetId === "number" && original.has(e.payload.targetId));
      alive.delete(e.payload.targetId);
    }
    histories.push(structuredClone(history));
    living.push([...alive]);
    sheriffPrefixes.push(sheriff);
  }
  if (tricksterBoard)
    for (const [n, target] of rawFinalTargets) {
      if (target !== null && record.checkpoints.some((cp) => cp.complete && cp.cycle >= n))
        check(mappedDays.has(n));
    }
  for (const [day, fact] of facts) if (fact.activate) check(resetDays.has(day));
  const checkpointed = Math.max(0, ...record.checkpoints.map((c) => c.cycle));
  for (const d of record.decisions) {
    if (!record.finalized && d.day > checkpointed) continue;
    if (d.stage === "order_prince_choice") {
      strict(d);
      check(
        d.actorId === actor &&
          votingDays.has(d.day) &&
          !history.some((h) => h.day < d.day && h.activate),
      );
      if (record.checkpoints.some((c) => c.complete && c.cycle >= d.day)) check(facts.has(d.day));
    }
    if (
      d.stage === "order_prince_speech" ||
      d.stage === "order_prince_revote" ||
      (resetDays.has(d.day) && ["exile_pk_speech", "exile_pk_vote"].includes(d.stage))
    ) {
      strict(d);
      check(resetDays.has(d.day));
      if (d.stage === "order_prince_speech") check(d.actorId === actor);
    }
    for (const event of d.request.context.visible_events) {
      if (event.type === choiceType)
        check(
          d.actorId === actor &&
            record.events.some((e) => e.type === choiceType && equal(e.payload, event.payload)),
        );
      if (event.type === resetType)
        check(record.events.some((e) => e.type === resetType && equal(e.payload, event.payload)));
    }
  }
  for (const cp of record.checkpoints) {
    check(
      cp.eventCount >= 0 && cp.eventCount < histories.length && cp.players.length === original.size,
    );
    const ids = new Set<number>();
    for (const p of cp.players) {
      const originalPlayer = original.get(p.id);
      check(originalPlayer && !ids.has(p.id));
      ids.add(p.id);
      check(
        p.role === originalPlayer.role &&
          p.camp === originalPlayer.camp &&
          p.name === originalPlayer.name &&
          p.alive === living[cp.eventCount]!.includes(p.id),
      );
      if (p.alive) {
        check(
          p.vote.canVote === true &&
            p.vote.weight ===
              (p.id === sheriffPrefixes[cp.eventCount] ? (board.sheriff?.voteWeight ?? 1.5) : 1),
        );
        check(p.badge.isSheriff === (p.id === sheriffPrefixes[cp.eventCount]));
      }
      if (p.id === actor)
        check(
          equal(p.privateState, { orderPrince: { policy, history: histories[cp.eventCount] } }),
        );
      else check(!Object.hasOwn(p.privateState, "orderPrince"));
    }
  }
}
