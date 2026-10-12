/**
 * Responsibility: independently verify animal-dream actions, ballots and death evidence.
 * Input: normalized board data and recorded causal prefixes.
 * Output: consistency checks that throw on invalid archive evidence.
 * Boundary: never invokes live effect, vote or death resolvers or owns their resources.
 */
import { animalFeedAt } from "./animal_dream_feed_record";
import { isDeepStrictEqual as equal } from "node:util";
import { ANIMAL_DREAM_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { isAnimalDreamPreset } from "../verification/board-support";
import { ANIMAL_DREAM_POLICY as policy } from "@ai-werewolf-arena/game-text";
import type { ReproductionRecord } from "./reproduction";
function check(value: unknown): asserts value {
  if (!value) throw Error("reproduction_animal_dream_invalid");
}
/** Independent arithmetic over recorded actions, original seats and actual publication prefixes.
 * No World, runtime owner, damage reducer, vote selector or visibility projection is used. */
export function validateAnimalDreamRecord(r: ReproductionRecord): void {
  const board = r.metadata.normalizedBoard;
  const animal = (type: string) => (ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(type);
  if (!board.animalDream) {
    check(
      !board.whiteCat &&
        !board.pufferfish &&
        board.bear?.signalPolicy !== "netease_dawn_live_v1" &&
        !board.roleSetups.some((row) =>
          ["white_cat", "fox_cub", "pufferfish"].includes(row.role),
        ) &&
        !r.checkpoints.some((cp) =>
          cp.players.some((p) =>
            ["whiteCat", "foxCub", "pufferfish"].some((key) => Object.hasOwn(p.privateState, key)),
          ),
        ) &&
        !r.events.some((e) => animal(e.type)) &&
        !r.checkpoints.some((c) => c.animalDream) &&
        !r.decisions.some(
          (d) =>
            d.stage === "fox_distract" ||
            d.stage === "puffer_reaction" ||
            d.request.context.fox_candidates !== undefined,
        ),
    );
    return;
  }
  check(isAnimalDreamPreset(board));
  const roster = new Map(r.metadata.players.map((p) => [p.id, p]));
  check(
    roster.size === 12 &&
      [...roster.keys()].sort((a, b) => a - b).every((id, i) => id === i + 1) &&
      [...roster.values()].every(
        (p) => p.camp === (["wolf", "wolf_beauty"].includes(p.role) ? "wolf" : "good"),
      ),
  );
  const roleId = (role: string) => {
    const rows = [...roster.values()].filter((p) => p.role === role);
    check(rows.length === 1);
    return rows[0]!.id;
  };
  const catId = roleId("white_cat"),
    foxId = roleId("fox_cub"),
    pufferId = roleId("pufferfish"),
    beautyId = roleId("wolf_beauty");
  const wolfIds = [...roster.values()].filter((p) => p.camp === "wolf").map((p) => p.id);
  let day = 1,
    phase = "night",
    completed = 0,
    currentUnit: number | null = null,
    unitKind: "exile" | "skipped_day" = "exile";
  let fox: any = { policy, usedNight: null, history: [] },
    puffer: any = { policy, usedDay: null, knifeDeathDay: null, history: [] },
    cat: any = { policy, form: { kind: "veiled" } };
  let effect: any = null,
    charm: number | null = null,
    charmDay: number | null = null,
    knife: number | null = null,
    exile: number | null = null,
    blast: number | null = null;
  let latestNight: any = null,
    latestUnit: any = null,
    blockedDay: number | null = null;
  const bearHistory: Array<{ day: number; roared: boolean }> = [];
  let charmHistory: Array<{ day: number; targetId: number | null }> = [],
    beautyExiled = false;
  let pkCandidates: number[] = [];
  let knifeVotes: any[] = [],
    ballots = new Map<number, any[]>(),
    retaliation: number[] = [],
    prepared: number[] | null = null,
    expiry: number | null = null;
  let result: any = null;
  const badges = new Map(
    [...roster.keys()].map((id) => [
      id,
      { isSheriff: false, destroyed: false, voteWeight: 1.5 } as {
        isSheriff: boolean;
        destroyed: boolean;
        voteWeight: number;
        handoffPolicy?: string;
      },
    ]),
  );
  const publicDead = new Set<number>();
  const alive = new Set(roster.keys()),
    snapshots = new Map<
      number,
      {
        alive: number[];
        publicDead: number[];
        fox: any;
        puffer: any;
        cat: any;
        completed: number;
        night: any;
        unit: any;
        effect: any;
        blockedDay: number | null;
        beauty: any;
        bear: any;
        day: number;
        phase: string;
        result: any;
        badges: Map<number, any>;
      }
    >();
  const acceptedSources = new Set<number>();
  const paidChoices = new Set<number>(),
    opened = new Set<number>();
  const save = (cursor: number) =>
    snapshots.set(cursor, {
      alive: [...alive],
      publicDead: [...publicDead],
      day,
      phase,
      result: structuredClone(result),
      badges: structuredClone(badges),
      fox: structuredClone(fox),
      puffer: structuredClone(puffer),
      cat: structuredClone(cat),
      completed,
      night: structuredClone(latestNight),
      unit: structuredClone(latestUnit),
      effect: structuredClone(effect),
      blockedDay,
      beauty: { targetId: charm, lastActedDay: charmDay, history: structuredClone(charmHistory) },
      bear: { history: structuredClone(bearHistory) },
    });
  const tool = (d: ReproductionRecord["decisions"][number]) =>
    d.outcome.kind === "action" ? d.outcome.action : null;
  const matchDecision = (type: string, actor: number, di: number, cursor: number) => {
    const name = type === "animal_fox_chosen" ? "fox_distract" : "puffer_retaliate";
    const ds = r.decisions.filter(
      (d) =>
        d.actorId === actor &&
        d.day === di &&
        tool(d)?.name === name &&
        d.openedAtEventCount! <= cursor &&
        d.settleOrder !== undefined,
    );
    check(ds.length === 1 && !paidChoices.has(r.decisions.indexOf(ds[0]!)));
    check(
      r.decisions
        .filter((d) => d.openedAtEventCount! > cursor)
        .every((d) => d.openedAfterSettlement >= ds[0]!.settleOrder!),
    );
    paidChoices.add(r.decisions.indexOf(ds[0]!));
    return tool(ds[0]!)!;
  };
  const matchSource = (name: string, actorId: number, payload: any, cursor: number) => {
    const candidates = r.decisions.filter(
      (d, index) =>
        !acceptedSources.has(index) &&
        d.actorId === actorId &&
        d.day === day &&
        d.openedAtEventCount! <= cursor &&
        tool(d)?.name === name,
    );
    const found = candidates.find((d) => {
      const args: any = tool(d)!.args;
      return name === "charm"
        ? args.target_id === payload.targetId
        : args.abstain === true || args.target_id === null
          ? payload.abstain === true && payload.targetId === null
          : payload.abstain === false && args.target_id === payload.targetId;
    });
    if (!found) {
      check(payload.fallback === true && payload.abstain === true && payload.targetId === null);
      return;
    }
    acceptedSources.add(r.decisions.indexOf(found));
  };
  const tallyTarget = (votes: any[], min = false) => {
    const tally = new Map<number, number>();
    for (const v of votes)
      if (!v.abstain && v.targetId !== null)
        tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + (v.weight ?? 1));
    const maximum = Math.max(0, ...tally.values()),
      ids = [...tally]
        .filter(([, n]) => n === maximum)
        .map(([id]) => id)
        .sort((a, b) => a - b);
    return ids.length === 1 || min ? (ids[0] ?? null) : null;
  };
  const sourceFor = (id: number, sourcePhase: string): string[] => {
    const sources: string[] = [];
    if (knife === id && sourcePhase !== "voting") sources.push("wolf_kill");
    if (blast === id) sources.push("self_destruct");
    if (exile === id && sourcePhase === "voting") sources.push("exile");
    if (retaliation.includes(id) && sourcePhase === "voting") sources.push("puffer_retaliation");
    if (
      !sources.length &&
      charm === id &&
      beautyExiled &&
      !alive.has(beautyId) &&
      puffer.knifeDeathDay !== day &&
      !effect?.beautyBlocked
    )
      sources.push("charm");
    return sources;
  };
  save(0);
  for (let i = 0; i < r.events.length; i++) {
    for (const d of r.decisions.filter(
      (d) => d.openedAtEventCount === i && ["voting", "exile_pk_vote"].includes(d.stage),
    )) {
      if (currentUnit === null) {
        currentUnit = completed + 1;
        unitKind = "exile";
        latestUnit = {
          number: currentUnit,
          day,
          kind: unitKind,
          status: "open",
          expiryPrepared: false,
          expiryCatId: null,
          finalRound: null,
          ballots: [],
          puffer: null,
        };
      }
    }
    const e = r.events[i]!,
      p: any = e.payload;
    if (
      [
        "wolf_tactical_order",
        "wolf_discussion",
        "wolf_discussion_ended",
        "wolf_kill_vote_cast",
      ].includes(e.type)
    )
      check(
        equal(
          e.audience,
          wolfIds.filter((id) => alive.has(id)).sort((a, b) => a - b),
        ),
      );
    if (e.type === "sheriff_elected") {
      check(alive.has(p.winnerId));
      for (const id of alive)
        badges.set(id, {
          isSheriff: id === p.winnerId,
          destroyed: false,
          voteWeight: 1.5,
          handoffPolicy: "awa_holder_choice_v1",
        });
    }
    if (e.type === "sheriff_badge_transferred" || e.type === "sheriff_badge_destroyed") {
      const from = e.type === "sheriff_badge_transferred" ? p.fromId : p.targetId,
        prior = badges.get(from)!;
      check(prior?.isSheriff && !prior.destroyed && !alive.has(from));
      badges.set(from, { ...prior, isSheriff: false, destroyed: true });
      if (e.type === "sheriff_badge_transferred") {
        check(alive.has(p.toId) && p.toId !== from);
        badges.set(p.toId, {
          ...badges.get(p.toId)!,
          isSheriff: true,
          destroyed: false,
          voteWeight: 1.5,
          handoffPolicy: "awa_holder_choice_v1",
        });
      }
    }

    if (e.type === "phase_changed") {
      day = p.day;
      phase = p.phase;
      if (phase === "night") {
        beautyExiled = false;
        pkCandidates = [];
        knifeVotes = [];
        ballots = new Map();
        retaliation = [];
        exile = null;
        blast = null;
        currentUnit = null;
        knife = null;
      }
    }
    if (e.type === "animal_night_opened") {
      check(p.day === day && !opened.has(day));
      opened.add(day);
      latestNight = {
        day,
        status: "open",
        requiresFox: day >= 2 && alive.has(foxId) && fox.usedNight === null,
        foxPaid: false,
      };
      blockedDay = null;
      effect = null;
    }
    if (e.type === "animal_fox_chosen") {
      check(
        opened.has(day) &&
          day >= 2 &&
          p.day === day &&
          p.actorId === foxId &&
          alive.has(foxId) &&
          fox.usedNight === null,
      );
      const c = matchDecision(e.type, foxId, day, i);
      check(
        equal(c.args, { target_id: p.targetId }) && (p.targetId === null || alive.has(p.targetId)),
      );
      fox.history.push({ day, targetId: p.targetId });
      latestNight.foxPaid = true;
      if (p.targetId !== null) fox.usedNight = day;
    }
    if (e.type === "animal_fox_effect") {
      const last = fox.history.at(-1);
      check(
        last?.day === day &&
          last.targetId === p.targetId &&
          p.targetId !== null &&
          p.actorId === foxId &&
          p.day === day,
      );
      effect = {
        day,
        targetId: p.targetId,
        knifeBlocked: wolfIds.includes(p.targetId),
        beautyBlocked: p.targetId === beautyId,
      };
      check(equal(p, { policy, actorId: foxId, ...effect }));
      if (effect.beautyBlocked) charm = null;
    }
    if (e.type === "animal_knife_notified") {
      check(
        day === 1 || !alive.has(foxId) || fox.usedNight !== null || fox.history.at(-1)?.day === day,
      );
      check(
        p.day === day &&
          wolfIds.includes(p.actorId) &&
          alive.has(p.actorId) &&
          p.eligible === !effect?.knifeBlocked,
      );
    }
    if (e.type === "wolf_kill_vote_cast") {
      matchSource("kill_vote", p.actorId, p, i);
      check(
        opened.has(day) &&
          !effect?.knifeBlocked &&
          wolfIds.includes(p.actorId) &&
          alive.has(p.actorId),
      );
      knifeVotes.push(p);
      knife = tallyTarget(knifeVotes, true);
    }
    if (e.type === "charm_applied") {
      matchSource("charm", p.actorId, p, i);
      check(!effect?.beautyBlocked && p.actorId === beautyId && alive.has(beautyId));
      charm = p.targetId;
      charmDay = day;
      charmHistory.push({ day, targetId: charm });
    }
    if (e.type === "animal_beauty_notified")
      check(
        equal(p, {
          policy,
          day,
          actorId: beautyId,
          charmAllowed: phase === "night" && !effect?.beautyBlocked,
          linkAllowed: puffer.knifeDeathDay !== day,
          targetId: charm,
          lastActedDay: charmDay,
          history: charmHistory,
        }),
      );
    if (e.type === "exile_pk_started") {
      const votes = ballots.get(1)!;
      check(votes);
      const tally = new Map<number, number>();
      for (const v of votes)
        if (!v.abstain) tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + v.weight);
      const maximum = Math.max(0, ...tally.values());
      pkCandidates = [...tally]
        .filter(([, n]) => n === maximum)
        .map(([id]) => id)
        .sort((a, b) => a - b);
      check(pkCandidates.length > 1 && equal(p.candidates, pkCandidates));
    }
    if (e.type === "vote_cast") {
      check(!pkCandidates.includes(p.actorId));
      matchSource("vote", p.actorId, p, i);
    }

    if (e.type === "vote_summary") {
      check(Array.isArray(p.votes));
      const round = p.round ?? 1;
      check(!ballots.has(round));
      const raw = r.events
        .slice(0, i)
        .filter((x) => x.type === "vote_cast")
        .slice(-p.votes.length)
        .map((x) => {
          const { fallback: _fallback, ...v } = x.payload;
          return v;
        });
      check(
        equal(raw, p.votes) && new Set(p.votes.map((v: any) => v.actorId)).size === p.votes.length,
      );
      check(
        p.votes.every(
          (v: any) =>
            alive.has(v.actorId) &&
            (v.abstain ? v.weight === 0 : alive.has(v.targetId) && [1, 1.5].includes(v.weight)),
        ),
      );
      const eligible = [...alive].filter((id) => round === 1 || !pkCandidates.includes(id));
      check(
        equal(
          p.votes.map((v: any) => v.actorId).sort((a: number, b: number) => a - b),
          eligible.sort((a, b) => a - b),
        ),
      );
      if (round === 2)
        check(
          pkCandidates.length > 1 &&
            p.votes.every((v: any) => v.abstain || pkCandidates.includes(v.targetId)),
        );
      check(p.target === tallyTarget(p.votes));
      ballots.set(round, p.votes);
      check(latestUnit !== null);
      latestUnit.ballots.push({ round, votes: structuredClone(p.votes) });
      const scores = new Map<number, number>();
      for (const v of p.votes)
        if (!v.abstain) scores.set(v.targetId, (scores.get(v.targetId) ?? 0) + v.weight);
      const maximum = Math.max(0, ...scores.values()),
        tied = maximum > 0 ? [...scores].filter(([, n]) => n === maximum) : [];
      if (round === 2 || tied.length <= 1) {
        latestUnit.finalRound = round;
        const selected = board.pufferfish!.ballotPolicy === "awa_first_ballot_v1" ? 1 : round;
        const targets = ballots
          .get(selected)!
          .filter((v) => !v.abstain && v.targetId === pufferId)
          .map((v) => v.actorId)
          .sort((a, b) => a - b);
        latestUnit.puffer =
          alive.has(pufferId) && puffer.usedDay === null && targets.length
            ? { targetIds: targets, paid: false, activated: false, closed: false }
            : null;
      }
      exile = p.target;
    }
    if (e.type === "animal_puffer_decided") {
      check(
        p.actorId === pufferId &&
          p.day === day &&
          alive.has(pufferId) &&
          puffer.usedDay === null &&
          currentUnit !== null,
      );
      const c = matchDecision(e.type, pufferId, day, i);
      check(equal(c.args, { activate: p.activate }));
      const round =
        board.pufferfish!.ballotPolicy === "awa_first_ballot_v1" ? 1 : Math.max(...ballots.keys());
      const targets = (ballots.get(round) ?? [])
        .filter((v) => !v.abstain && v.targetId === pufferId)
        .map((v) => v.actorId)
        .sort((a, b) => a - b);
      check(targets.length > 0);
      puffer.history.push({ day, activate: p.activate, targetIds: targets });
      latestUnit.puffer = { targetIds: targets, paid: true, activated: p.activate, closed: true };
      if (p.activate) {
        puffer.usedDay = day;
        retaliation = targets;
      }
    }
    if (e.type === "animal_puffer_targets")
      check(
        p.day === day &&
          p.actorId === pufferId &&
          puffer.usedDay === day &&
          equal(p.targetIds, retaliation) &&
          p.round ===
            (board.pufferfish!.ballotPolicy === "awa_first_ballot_v1"
              ? 1
              : Math.max(...ballots.keys())),
      );
    if (e.type === "wolf_self_destruct") {
      check(wolfIds.includes(p.wolfId) && p.wolfId !== beautyId);
      blast = p.wolfId;
      currentUnit = completed + 1;
      unitKind = "skipped_day";
      latestUnit = {
        number: currentUnit,
        day,
        kind: unitKind,
        status: "open",
        expiryPrepared: false,
        expiryCatId: null,
        finalRound: null,
        ballots: [],
        puffer: null,
      };
    }
    if (e.type === "animal_wave_prepared") {
      check(p.day === day && prepared === null);
      const candidates: number[] = p.proposedIds;
      check(candidates.every((id) => alive.has(id) && sourceFor(id, p.phase).length > 0));
      const blocked = candidates.includes(catId) && cat.form.kind !== "expired" ? catId : null;
      check(p.blockedCatId === blocked);
      if (blocked !== null && cat.form.kind === "veiled") {
        const clockUnit =
          unitKind === "exile"
            ? currentUnit
            : board.whiteCat!.skippedVotePolicy === "awa_expire_on_skipped_day_v1"
              ? currentUnit
              : null;
        cat.form = {
          kind: "deferred",
          deferred: {
            day,
            phase: p.phase,
            firstSources: sourceFor(catId, p.phase),
            firstUnit: clockUnit,
            expiresAfterUnit: clockUnit === null ? completed + 1 : clockUnit + 1,
          },
        };
      }
      prepared = candidates.filter((id) => id !== blocked);
      if (currentUnit !== null && latestUnit?.day === day) latestUnit.expiryPrepared = true;
    }
    if (e.type === "animal_cat_revealed")
      check(
        p.actorId === catId &&
          p.day === day &&
          cat.form.kind === "deferred" &&
          cat.form.deferred.day === day &&
          alive.has(catId),
      );
    if (e.type === "animal_cat_expiry_prepared") {
      check(
        p.actorId === catId &&
          p.day === day &&
          p.unit === currentUnit &&
          p.unitKind === unitKind &&
          cat.form.kind === "deferred",
      );
      const d = cat.form.deferred;
      check(
        unitKind === "exile"
          ? currentUnit! >= d.expiresAfterUnit
          : board.whiteCat!.skippedVotePolicy === "awa_expire_on_skipped_day_v1" &&
              (currentUnit! >= d.expiresAfterUnit ||
                (d.day === day && d.firstUnit === currentUnit)),
      );
      cat.form = { kind: "expired", deferred: d, day, unit: currentUnit, unitKind };
      expiry = catId;
      latestUnit.expiryPrepared = true;
      latestUnit.expiryCatId = catId;
    }
    if (e.type === "animal_wave_committed") {
      check(p.day === day && prepared !== null);
      const expected = [...prepared!];
      if (expiry !== null && !expected.includes(expiry)) expected.push(expiry);
      check(
        equal(
          [...p.deaths].sort((a, b) => a - b),
          expected.sort((a, b) => a - b),
        ),
      );
      for (const id of p.deaths) {
        check(alive.has(id));
        const sources =
          id === expiry
            ? sourceFor(id, p.phase).filter((s) => s === "exile" || s === "puffer_retaliation")
            : sourceFor(id, p.phase);
        if (id === expiry) sources.push("white_cat_expiry");
        check(equal([...p.deathSources[String(id)]].sort(), sources.sort()));
        alive.delete(id);
        if (id === beautyId) beautyExiled = sources.includes("exile");
        if (id === pufferId && sources.includes("wolf_kill")) {
          puffer.knifeDeathDay = day;
          blockedDay = day;
        }
      }
      prepared = null;
      expiry = null;
    }
    // No actual batch is emitted for an empty/deferred-only wave; it still consumes a preparation.
    if (
      prepared?.length === 0 &&
      expiry === null &&
      !["animal_wave_prepared", "animal_cat_revealed", "animal_cat_expiry_prepared"].includes(
        e.type,
      )
    )
      prepared = null;
    if (e.type === "animal_unit_completed") {
      check(p.day === day && p.unit === currentUnit && p.kind === unitKind);
      if (
        unitKind === "exile" ||
        board.whiteCat!.skippedVotePolicy === "awa_expire_on_skipped_day_v1"
      )
        completed++;
      latestUnit.status = "closed";
      latestUnit.expiryPrepared = true;
      if (latestUnit.puffer) latestUnit.puffer.closed = true;
      currentUnit = null;
      retaliation = [];
      exile = null;
      blast = null;
    }
    if (e.type === "game_over") result = structuredClone(p);
    if (e.type === "game_over" && p.outcome?.kind === "victory") {
      check(latestUnit === null || latestUnit.status === "closed");
      check(
        !(
          beautyExiled &&
          charm !== null &&
          alive.has(charm) &&
          puffer.knifeDeathDay !== day &&
          !effect?.beautyBlocked &&
          !(charm === catId && cat.form.kind === "deferred")
        ),
      );
      const wolves = wolfIds.filter((id) => alive.has(id)),
        gods = [catId, foxId, pufferId, roleId("bear")].filter((id) => alive.has(id)),
        villagers = [...roster.values()].filter((x) => x.role === "villager" && alive.has(x.id));
      const winner =
        gods.length === 0 || villagers.length === 0 ? "wolf" : wolves.length === 0 ? "good" : null;
      check(winner !== null && p.winner === winner);
      check(
        equal(
          p.outcome.winningPlayerIds,
          [...roster.values()]
            .filter((x) => x.camp === winner)
            .map((x) => x.id)
            .sort((a, b) => a - b),
        ),
      );
    }
    if (["night_resolved", "additional_deaths", "voted_out"].includes(e.type)) {
      const deaths = e.type === "voted_out" ? [p.target] : p.deaths;
      check(
        Array.isArray(deaths) &&
          deaths.every(
            (id: number) =>
              roster.has(id) && (!alive.has(id) || (prepared ?? []).includes(id) || id === expiry),
          ),
      );
      deaths.forEach((id: number) => publicDead.add(id));
    }
    if (e.type === "bear_roared") {
      const bear = roleId("bear"),
        seats = r.checkpoints[0]!.players.slice()
          .sort((a, b) => a.seat - b.seat)
          .map((p) => p.id),
        position = seats.indexOf(bear);
      const neighbor = (step: number) => {
        for (let n = 1; n < seats.length; n++) {
          const id = seats[(position + step * n + seats.length * 2) % seats.length]!;
          if (alive.has(id)) return id;
        }
        return null;
      };
      const expected =
        alive.has(bear) &&
        [neighbor(-1), neighbor(1)].some((id) => id !== null && wolfIds.includes(id));
      check(p.roared === expected);
      check(p.day === day && !bearHistory.some((row) => row.day === day));
      bearHistory.push({ day, roared: p.roared });
    }
    if (latestNight && phase !== "night") latestNight.status = "normal";
    save(i + 1);
  }
  if (r.finalized)
    for (const [type, op] of [
      ["wolf_kill_vote_cast", "wolf_kill_vote_cast"],
      ["vote_cast", "vote_cast"],
    ]) {
      for (const [i, e] of r.events.entries())
        if (e.type === type)
          check(
            r.operations.some(
              (o) =>
                o.op === op &&
                o.actor_id === e.payload.actorId &&
                o.event_count === i + 1 &&
                equal(o.output, {
                  target_id: e.payload.targetId,
                  abstain: e.payload.abstain,
                  ...(type === "vote_cast" ? { weight: e.payload.weight } : {}),
                }),
            ),
          );
    }
  for (const cp of r.checkpoints) {
    const s = snapshots.get(cp.eventCount),
      a: any = cp.animalDream;
    check(s && a);
    let expectedFox = s.fox,
      expectedPuffer = s.puffer,
      expectedEffect = s.effect;
    const expectedNight = structuredClone(s.night),
      expectedUnit = structuredClone(s.unit);
    if (!cp.complete) {
      for (const d of r.decisions.slice(0, cp.decisionCount ?? 0)) {
        const c = tool(d);
        if (!c || d.settleOrder === undefined) continue;
        if (c.name === "fox_distract" && !expectedFox.history.some((h: any) => h.day === d.day)) {
          check(
            d.actorId === foxId &&
              expectedNight?.day === d.day &&
              expectedNight.requiresFox &&
              d.openedAtEventCount! <= cp.eventCount &&
              expectedFox.usedNight === null &&
              d.day >= 2 &&
              snapshots.get(d.openedAtEventCount!)!.alive.includes(foxId) &&
              Object.keys(c.args).length === 1 &&
              (c.args.target_id === null ||
                snapshots.get(d.openedAtEventCount!)!.alive.includes(c.args.target_id)),
          );
          expectedFox = {
            ...expectedFox,
            usedNight: c.args.target_id === null ? null : d.day,
            history: [...expectedFox.history, { day: d.day, targetId: c.args.target_id }],
          };
          expectedNight.foxPaid = true;
          expectedEffect =
            c.args.target_id === null
              ? null
              : {
                  day: d.day,
                  targetId: c.args.target_id,
                  knifeBlocked: wolfIds.includes(c.args.target_id),
                  beautyBlocked: c.args.target_id === beautyId,
                };
        }
        if (
          c.name === "puffer_retaliate" &&
          !expectedPuffer.history.some((h: any) => h.day === d.day)
        ) {
          check(
            d.actorId === pufferId &&
              expectedUnit?.day === d.day &&
              expectedUnit.puffer !== null &&
              expectedPuffer.usedDay === null &&
              snapshots.get(d.openedAtEventCount!)!.alive.includes(pufferId) &&
              Object.keys(c.args).length === 1 &&
              typeof c.args.activate === "boolean",
          );
          const targets = expectedUnit.puffer.targetIds;
          expectedPuffer = {
            ...expectedPuffer,
            usedDay: c.args.activate ? d.day : null,
            history: [
              ...expectedPuffer.history,
              { day: d.day, activate: c.args.activate, targetIds: targets },
            ],
          };
          expectedUnit.puffer = {
            targetIds: targets,
            paid: true,
            activated: c.args.activate,
            closed: true,
          };
        }
      }
      if (expectedNight) expectedNight.status = "aborted";
      if (expectedUnit && expectedUnit.status !== "closed") expectedUnit.status = "aborted";
      if (expectedUnit?.puffer) expectedUnit.puffer.closed = true;
    }
    if (cp.cycle > 0)
      check(
        equal(a.night, expectedNight) &&
          equal(a.unit, expectedUnit) &&
          equal(a.effect, expectedEffect) &&
          a.beautyLinkBlockedDay === s.blockedDay &&
          a.stopped === !cp.complete,
      );
    check(
      equal(a.policies, {
        skippedVotePolicy: board.whiteCat!.skippedVotePolicy,
        ballotPolicy: board.pufferfish!.ballotPolicy,
      }),
    );
    check(
      s &&
        a &&
        a.foxId === foxId &&
        a.catId === catId &&
        a.pufferId === pufferId &&
        equal(a.fox, expectedFox) &&
        equal(a.puffer, expectedPuffer) &&
        equal(a.cat, s.cat) &&
        a.completedUnits === s.completed,
    );
    check(
      cp.operationCount !== undefined &&
        cp.settlementCount !== undefined &&
        cp.decisionCount !== undefined,
    );
    check(
      cp.decisionCount ===
        (cp.cycle === 0
          ? 0
          : r.decisions.filter((d) => d.openedAtEventCount! <= cp.eventCount).length),
    );
    check(
      cp.settlementCount ===
        r.decisions.slice(0, cp.decisionCount).filter((d) => d.outcome.kind !== "pending").length,
    );
    if (r.finalized)
      check(
        cp.operationCount ===
          r.operations.filter((o) => o.event_count !== undefined && o.event_count <= cp.eventCount)
            .length,
      );
    if (cp.complete) {
      const ended = s.result !== null,
        nextDay = cp.cycle > 0 && !ended ? cp.cycle + 1 : s.day,
        nextPhase =
          cp.cycle > 0 && !ended && s.unit?.day === s.day && s.unit.kind === "skipped_day"
            ? "night"
            : s.phase;
      const expectedSnapshot = {
        day: ended ? s.result.decidedAt.day : nextDay,
        phase: ended ? "game_over" : nextPhase,
        gameOver: ended,
        result: s.result,
      };
      check(equal(cp.snapshot, expectedSnapshot));
    }
    if (!cp.complete)
      check(
        equal(cp.snapshot, {
          day: s.day,
          phase: s.phase,
          gameOver: s.result !== null,
          result: s.result,
        }),
      );
    for (const p of cp.players) {
      check(
        equal(p.badge, s.badges.get(p.id)) &&
          equal(p.vote, { weight: s.badges.get(p.id)!.isSheriff ? 1.5 : 1, canVote: true }),
      );
      check(
        p.seat === p.id &&
          equal(p.victory, { affiliations: [{ kind: "faction", faction: p.camp }] }),
      );
      const original = roster.get(p.id);
      check(
        original &&
          p.name === original.name &&
          p.role === original.role &&
          p.camp === original.camp,
      );
    }
    if (cp.cycle === 0)
      check(
        a.night === null &&
          a.unit === null &&
          a.effect === null &&
          a.stopped === false &&
          a.beautyLinkBlockedDay === null &&
          a.completedUnits === 0 &&
          cp.decisionCount === 0 &&
          cp.settlementCount === 0 &&
          cp.operationCount === 0,
      );
    check(
      equal(
        cp.players.filter((p) => p.alive).map((p) => p.id),
        s.alive.filter((id) => !s.publicDead.includes(id)),
      ),
    );
    if (cp.complete) {
      check(!a.stopped);
      if (cp.cycle > 0) check(opened.has(cp.cycle));
    }
    check(equal(cp.players.find((p) => p.id === roleId("bear"))!.privateState, { bear: s.bear }));
    const beautyStock = structuredClone(s.beauty);
    if (expectedEffect?.beautyBlocked) beautyStock.targetId = null;
    check(
      equal(cp.players.find((p) => p.id === beautyId)!.privateState, { wolf_beauty: beautyStock }),
    );
    for (const [id, key, state] of [
      [foxId, "foxCub", expectedFox],
      [catId, "whiteCat", s.cat],
      [pufferId, "pufferfish", expectedPuffer],
    ] as const)
      check(equal(cp.players.find((p) => p.id === id)?.privateState[key], state));
  }
  for (const d of r.decisions) {
    check(
      d.openedAtEventCount !== undefined &&
        d.openedAtEventCount <= r.events.length &&
        d.actorId === d.request.actorId &&
        d.day === d.request.context.day &&
        d.stage === d.request.context.stage,
    );
    if (d.stage === "fox_distract")
      check(
        opened.has(d.day) &&
          r.events
            .slice(0, d.openedAtEventCount)
            .some((e) => e.type === "animal_night_opened" && e.payload.day === d.day) &&
          d.actorId === foxId &&
          d.day >= 2 &&
          equal(d.request.allowedTools, ["fox_distract"]) &&
          equal(d.request.context.fox_candidates, snapshots.get(d.openedAtEventCount)!.alive) &&
          d.request.context.allow_fallback === false,
      );
    if (d.stage === "exile_pk_vote") {
      const prefix = r.events.slice(0, d.openedAtEventCount),
        pk = [...prefix].reverse().find((e) => e.type === "exile_pk_started");
      check(
        pk &&
          equal(d.request.context.exile_candidates, pk.payload.candidates) &&
          !(pk.payload.candidates as number[]).includes(d.actorId) &&
          d.request.context.round === 2,
      );
    }
    if (d.stage === "puffer_reaction")
      check(
        d.actorId === pufferId &&
          equal(d.request.allowedTools, ["puffer_retaliate"]) &&
          d.request.context.allow_fallback === false,
      );
    const feed = d.request.context.visible_events;
    check(equal(feed, animalFeedAt(r, d.openedAtEventCount!, d.actorId)));
    check(feed.every((v, i) => v.seq === i + 1));
    for (const v of feed.filter((v) => animal(v.type))) {
      check(
        ![
          "animal_night_opened",
          "animal_fox_effect",
          "animal_puffer_targets",
          "animal_wave_prepared",
          "animal_wave_committed",
          "animal_cat_expiry_prepared",
          "animal_unit_completed",
        ].includes(v.type),
      );
      check(
        ["animal_cat_revealed", "animal_puffer_revealed"].includes(v.type) ||
          v.payload.actorId === d.actorId,
      );
      check(
        r.events
          .slice(0, d.openedAtEventCount)
          .some((e) => e.type === v.type && equal(e.payload, v.payload)),
      );
    }
  }
}
