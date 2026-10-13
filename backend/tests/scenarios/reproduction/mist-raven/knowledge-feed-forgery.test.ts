/**
 * Reproduction scenarios verify Mist/Raven knowledge feeds cannot grant unpublished, unauthorized or future facts.
 * Input: Actual mistRecording/mistPrefix sources and copied appended-feed or pending/published visibility mutations.
 * Output and oracle: Explicit original prefix acceptance and forged-feed rejection retain disclosure timing; generated records supply test input without computing an expected World.
 */
import { expect, test } from "bun:test";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
import { mistRecording } from "../../../support/features/mist-raven/drivers/recording";
import { mistPrefix } from "../../../support/features/mist-raven/drivers/prefix";
const append = (
  r: ReproductionRecord,
  stage: string,
  type: string,
  payload: Record<string, unknown>,
  day = 1,
) => {
  const d = r.decisions.find((x) => x.day === day && x.stage === stage)!;
  d.request.context.visible_events.push({
    seq: d.request.context.visible_events.length + 1,
    type,
    payload,
  });
};
const negatives: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "unknown inventory",
    (r) => append(r, "alchemist_snake", "foreign_private_inventory", { actorId: 2, remaining: 9 }),
  ],
  [
    "another player's Seer result",
    (r) =>
      append(r, "alchemist_snake", "seer_checked", {
        actorId: 2,
        targetId: 9,
        isWerewolf: true,
        result: { kind: "camp", camp: "wolf" },
      }),
  ],
  [
    "own future Snake result",
    (r) =>
      append(r, "alchemist_snake", "alchemist_snake_chosen", {
        actorId: 1,
        day: 1,
        targetId: null,
      }),
  ],
  ["early night death", (r) => append(r, "alchemist_snake", "night_resolved", { deaths: [11] })],
  [
    "future Seer result",
    (r) =>
      append(r, "seer", "seer_checked", {
        actorId: 2,
        targetId: 9,
        isWerewolf: true,
        result: { kind: "camp", camp: "wolf" },
      }),
  ],
  [
    "parallel nomination result",
    (r) => append(r, "sheriff_nomination", "sheriff_nomination_summary", { candidates: [] }),
  ],
  [
    "future wolf snapshot",
    (r) =>
      append(r, "sheriff_nomination", "raven_unsealed", {
        actorId: 9,
        day: 2,
        awakened: true,
        knownTeammateIds: [10],
      }),
  ],
  [
    "derived tally",
    (r) => {
      const e = r.decisions
        .flatMap((d) => d.request.context.visible_events)
        .find((e) => e.type === "vote_summary")!;
      e.payload.tally = { 12: 10 };
    },
  ],
  [
    "sequence gap",
    (r) => {
      r.decisions.find(
        (d) => d.stage === "alchemist_snake",
      )!.request.context.visible_events[2]!.seq = 99;
    },
  ],
  [
    "reordered known prefix",
    (r) => {
      const d = r.decisions.find((d) => d.stage === "alchemist_snake")!,
        f = d.request.context.visible_events;
      [f[0], f[2]] = [f[2]!, f[0]!];
      f.forEach((e, i) => (e.seq = i + 1));
    },
  ],
  [
    "omitted event with continuous numbering",
    (r) => {
      const f = r.decisions.find((d) => d.stage === "alchemist_snake")!.request.context
        .visible_events;
      f.splice(2, 1);
      f.forEach((e, i) => (e.seq = i + 1));
    },
  ],
  [
    "duplicate event with continuous numbering",
    (r) => {
      const f = r.decisions.find((d) => d.stage === "alchemist_snake")!.request.context
        .visible_events;
      f.splice(2, 0, structuredClone(f[2]!));
      f.forEach((e, i) => (e.seq = i + 1));
    },
  ],
  [
    "dead wolf added to unseal knowledge",
    (r) => {
      r.decisions
        .find((d) => d.stage === "raven_knife")!
        .request.context.visible_events.find(
          (e) => e.type === "raven_unsealed",
        )!.payload.knownTeammateIds = [10, 11];
    },
  ],
  [
    "old sealed Night chat re-injected",
    (r) => append(r, "raven_knife", "wolf_tactical_order", { order: [10, 11, 12] }, 2),
  ],
];
for (const [name, mutate] of negatives)
  test(
    "Mist feed rejects " + name,
    async () => {
      const r = structuredClone(await mistRecording());
      mutate(r);
      expect(() => parseReproductionRecord(r)).toThrow("reproduction_mist_raven_invalid");
    },
    120000,
  );
for (const [stage, day, actor] of [
  ["seer", 1, 2],
  ["sheriff_nomination", 1, 9],
  ["day_speech", 1, 5],
  ["alchemist_snake", 1, 1],
  ["raven_knife", 2, 9],
  ["last_words", 1, 11],
  ["on_pre_vote", 1, 10],
] as const)
  test(`Mist feed real unpublished/published prefixes ${stage}/${day}/${actor}`, async () => {
    for (const r of Object.values(await mistPrefix(stage, day, false, actor)))
      expect(() => parseReproductionRecord(r)).not.toThrow();
  }, 120000);
for (const mode of [
  "duplicate-phase",
  "drop-ready-speeches",
  "reorder-ready-speeches",
  "duplicate-unseal",
  "incomplete-second-order",
  "backward-phase",
] as const)
  test(
    "Mist unpublished feed rejects " + mode,
    async () => {
      const raven = ["duplicate-unseal", "incomplete-second-order", "backward-phase"].includes(
        mode,
      );
      const r = structuredClone(
        (await mistPrefix(raven ? "raven_knife" : "alchemist_snake", raven ? 2 : 1)).pending,
      );
      const d = r.decisions.at(-1)!,
        f = d.request.context.visible_events;
      const push = (type: string, payload: Record<string, unknown>) =>
        f.push({ seq: f.length + 1, type, payload });
      if (mode === "duplicate-phase") push("phase_changed", { day: 1, phase: "day" });
      if (mode === "drop-ready-speeches")
        d.request.context.visible_events = f.filter((e) => e.type !== "day_speech");
      if (mode === "reorder-ready-speeches") {
        const a = f.findIndex((e) => e.type === "day_speech"),
          b = a + 1;
        [f[a], f[b]] = [f[b]!, f[a]!];
      }
      if (mode === "duplicate-unseal")
        push("raven_unsealed", { actorId: 9, day: 2, awakened: true, knownTeammateIds: [10] });
      if (mode === "incomplete-second-order") push("wolf_tactical_order", { order: [9] });
      if (mode === "backward-phase") {
        push("phase_changed", { day: 1, phase: "day" });
        push("phase_changed", { day: 2, phase: "night" });
      }
      d.request.context.visible_events.forEach((e, i) => (e.seq = i + 1));
      expect(() => parseReproductionRecord(r)).toThrow("reproduction_mist_raven_invalid");
    },
    120000,
  );

for (const mode of [
  "omit-lastwords-wave",
  "duplicate-lastwords",
  "phase-before-private-result",
] as const)
  test(
    "Mist unpublished publication order rejects " + mode,
    async () => {
      const r = structuredClone(
        (
          await mistPrefix(
            mode === "phase-before-private-result" ? "sheriff_nomination" : "on_pre_vote",
            1,
            false,
            mode === "phase-before-private-result" ? 9 : 10,
          )
        ).pending,
      );
      const d = r.decisions.at(-1)!,
        f = d.request.context.visible_events;
      if (mode === "omit-lastwords-wave")
        d.request.context.visible_events = f.filter((e) => !e.type.startsWith("last_words"));
      if (mode === "duplicate-lastwords")
        f.push(structuredClone(f.find((e) => e.type === "last_words_spoken")!));
      if (mode === "phase-before-private-result") {
        const day = f.findIndex((e) => e.type === "phase_changed" && e.payload.phase === "day"),
          skip = f.findIndex((e) => e.type === "raven_knife_skipped");
        const [event] = f.splice(day, 1);
        f.splice(skip, 0, event!);
      }
      d.request.context.visible_events.forEach((e, i) => (e.seq = i + 1));
      expect(() => parseReproductionRecord(r)).toThrow("reproduction_mist_raven_invalid");
    },
    120000,
  );
