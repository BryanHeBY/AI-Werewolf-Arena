/**
 * Reproduction scenarios verify complete and failed Radiant Eclipse recordings preserve exact paid prefixes and reject copied state forgeries.
 * Input: Original named full plans, locale/failure/action matrices and shared recording helper calls.
 * Output and oracle: Explicit checkpoint, private-state, publication and malformed-record assertions remain attached to generated game inputs; source archives and expected tables are unchanged.
 */
import { Camp } from "../../../../src/core";
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/radiant_eclipse_recording";
import { radiantFullPlans } from "../../../support/radiant_eclipse_full_plans";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
const stored = new Map<string, Promise<ReproductionRecord>>();
function recording(name: string, locale: "zh-CN" | "en") {
  const plan = radiantFullPlans.find((p) => p.name === name)!,
    key = name + locale;
  if (!stored.has(key)) stored.set(key, radiantRecording({ planName: plan.name, locale }));
  return stored.get(key)!;
}
for (const plan of radiantFullPlans)
  for (const locale of ["zh-CN", "en"] as const)
    test(`real recording / independent ledger / exact Tape: ${plan.name}/${locale}`, async () => {
      const r = await recording(plan.name, locale);
      expect(r.finalized).toBe(true);
      expect(r.checkpoints.at(-1)!.snapshot.result).toMatchObject({
        winner: plan.winner,
        decidedAt: { day: plan.nights.length, phase: plan.phase },
      });
      expect(
        r.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
      ).toEqual(plan.nightDeaths.map((row) => [...row]));
      expect(
        r.events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
      ).toEqual([...plan.lastWords]);
      expect(r.events.filter((e) => e.type === "dream_death").map((e) => e.payload)).toEqual([
        ...plan.dreamDeaths,
      ]);
      for (let i = 1; i < r.checkpoints.length; i++)
        expect(r.checkpoints[i]!.players.filter((p) => p.alive).map((p) => p.id)).toEqual([
          ...plan.alive[i - 1]!,
        ]);
      const damage = r.operations
        .filter((o) => o.op === "night_damage_resolved")
        .map((o) => o.output!.death_sources as Record<string, string[]>);
      const sorted = (o: Record<string, readonly string[]>) =>
        Object.fromEntries(Object.entries(o).map(([id, causes]) => [id, [...causes].sort()]));
      expect(damage.map(sorted)).toEqual(plan.sources.map(sorted));
      expect(r.events.filter((e) => e.type === "game_over")).toHaveLength(1);
      expect(r.events.at(-1)?.type).toBe("game_over");
      if (plan.name === "borrowed-dream-death-badge-words")
        expect(
          r.events.filter((e) => e.type === "sheriff_badge_transferred").map((e) => e.payload),
        ).toEqual([{ fromId: 1, toId: 2, reason: "night_death" }]);
    }, 120000);
for (const stage of [
  "eclipse_swallow",
  "radiant_shelter",
  "dreamer",
  "wolf_discussion",
  "wolf_vote",
  "witch",
  "seer",
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`real failed ${stage}/${locale} preserves prefix and closes lease`, async () => {
      const r = await radiantRecording({ failureStage: stage, locale });
      expect(r.finalized).toBe(true);
      expect(r.checkpoints.at(-1)?.complete).toBe(false);
      expect(r.checkpoints.at(-1)?.snapshot).toMatchObject({
        day: 2,
        phase: "night",
        gameOver: false,
        result: null,
      });
      expect(r.events.filter((e) => e.type === "night_resolved")).toHaveLength(1);
      expect(r.events.at(-1)).toMatchObject({
        type: "eclipse_lease_closed",
        payload: { day: 2, status: "aborted" },
        audience: [],
      });
      expect(r.termination).toMatchObject({ reason: "runtime_error", winner: null });
    }, 120000);
for (const invalid of [false, true])
  test(`badge soft ${invalid ? "invalid" : "missing"} choice destroys badge`, async () => {
    const r = await radiantRecording({
      planName: "borrowed-dream-death-badge-words",
      provider: (_game, manual) => ({
        getAction: (q) =>
          q.context.stage === "sheriff_badge_choice"
            ? Promise.resolve(
                invalid ? { name: "choose_badge_successor", args: { target_id: 999 } } : null,
              )
            : manual.getAction(q),
      }),
    });
    expect(
      r.events.filter((e) => e.type === "sheriff_badge_destroyed").map((e) => e.payload),
    ).toEqual([{ targetId: 1, reason: "night_death" }]);
    expect(r.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
  }, 120000);
const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "native policy immutable",
    (r) => {
      (r.checkpoints[0]!.players[1]!.privateState.abilities as any)["native:shelter"].state.policy =
        "unknown";
    },
  ],
  [
    "source stock not refreshed",
    (r) => {
      (r.checkpoints.at(-1)!.players[3]!.privateState.abilities as any)[
        "native:potion"
      ].state.poison = 0;
    },
  ],
  [
    "fresh copy not source history",
    (r) => {
      (r.checkpoints[3]!.players[0]!.privateState.abilities as any)[
        "copy:eclipse:night:3"
      ].state.canary = "source-history";
    },
  ],
  [
    "closure audience God only",
    (r) => {
      r.events.find((e) => e.type === "eclipse_lease_closed")!.audience = [1];
    },
  ],
  [
    "speech text matches real fact",
    (r) => {
      const d = r.decisions.find((d) => d.stage === "day_speech")!;
      if (d.outcome.kind === "action" && d.outcome.action?.name === "speak")
        d.outcome.action.args.text = "FORGED";
    },
  ],
  [
    "duplicate settlement rejected",
    (r) => {
      r.decisions.find((d) => d.stage === "seer")!.settleOrder = 1;
    },
  ],
  [
    "unfinalized supplied damage evidence checked",
    (r) => {
      r.finalized = false;
      r.operations.find((o) => o.op === "night_damage_resolved")!.output = {
        deaths: [],
        death_sources: {},
      };
    },
  ],
  [
    "no last words after final victory",
    (r) => {
      r.events.push({
        timestamp: 1,
        type: "last_words_granted",
        payload: { playerId: 1, day: 3, phase: "voting" },
      });
      r.checkpoints.at(-1)!.eventCount++;
    },
  ],
];
for (const [name, mutate] of mutations)
  test(`independent archive rejects ${name}`, async () => {
    const r = structuredClone(await recording("last-wolf-borrow-backlash", "en"));
    mutate(r);
    expect(() => parseReproductionRecord(r)).toThrow();
  });
