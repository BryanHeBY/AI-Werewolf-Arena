/**
 * Scenario tests consume complete Mist/Raven recordings and deliberate copied Tape/checkpoint mutations.
 * Inputs are the original four variants and both locales; handwritten deaths, snake/raven choices, unsealing knowledge and rejection assertions are the independent oracle.
 * The recording driver owns execution and filesystem resources. Mutations affect only detached records, never archived fixture bytes or the original running authority.
 */
import { expect, test } from "bun:test";
import { Camp } from "../../../../src/core";
import { mistRecording } from "../../../support/mist_raven_recording";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
import { validateMistRavenRecord } from "../../../../src/recording/mist_raven_record";
for (const variant of ["linked", "saved-dreamer", "protected-heal", "draw"] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist/Raven complete independent native ledger and exact Tape replay ${variant}/${locale}`, async () => {
      const r = await mistRecording(variant, locale);
      expect(r.finalized).toBe(true);
      expect(r.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
      const deaths = r.events
        .filter((e) => e.type === "night_resolved")
        .map((e) => e.payload.deaths);
      expect(deaths).toEqual(
        variant === "protected-heal"
          ? [[], [11], [6, 3, 5]]
          : variant === "saved-dreamer"
            ? [[11], [5], [6]]
            : [[11], [3, 5], [6]],
      );
      const snake = r.events
        .filter((e) => e.type === "alchemist_snake_chosen")
        .map((e) => e.payload.targetId);
      expect(snake).toEqual(variant === "protected-heal" ? [5] : [null, 3]);
      const extra = r.events
        .filter((e) => e.type === "raven_knife_chosen")
        .map((e) => e.payload.targetId);
      expect(extra).toEqual([variant === "saved-dreamer" ? 5 : 3]);
      const known = r.events
        .filter((e) => e.type === "raven_unsealed")
        .map((e) => e.payload.knownTeammateIds);
      expect(known).toEqual(variant === "protected-heal" ? [[]] : [[10]]);
      const draw = r.events.filter((e) => e.type === "mist_knife_drawn");
      expect(draw).toHaveLength(variant === "draw" ? 1 : 0);
      if (variant === "draw")
        expect(draw[0]!.payload).toEqual({ day: 1, candidates: [10, 11, 12], targetId: 11 });
    }, 120000);
const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "foreign ability request",
    (r) => {
      const d = structuredClone(r.decisions.find((d) => d.stage === "seer")!);
      d.actorId = 5;
      d.request.actorId = 5;
      d.stage = "guard";
      d.request.context.stage = "guard";
      d.request.allowedTools = ["guard"];
      d.request.context.turn_constraints.required_any_tools = ["guard"];
      d.request.context.ability_id = "native:guard";
      const max = Math.max(...r.decisions.map((d) => d.settleOrder ?? 0));
      d.openedAfterSettlement = max;
      d.settleOrder = max + 1;
      d.outcome = {
        kind: "action",
        action: { name: "guard", args: { target_id: 6, abstain: false } },
      };
      r.decisions.push(d);
    },
  ],
  [
    "foreign wall component",
    (r) => {
      r.checkpoints[1]!.players.find((p) => p.id === 5)!.wallNote = {
        instanceId: "wall:1:5",
        source: { kind: "wall_event", eventId: "awa_wall_notes_v1", day: 1 },
        remaining: 1,
        expired: false,
      };
    },
  ],
  [
    "foreign resource marks",
    (r) => {
      r.checkpoints[1]!.players.find((p) => p.id === 5)!.marks = ["private-canary"];
    },
  ],
  [
    "forged vote right",
    (r) => {
      r.checkpoints[1]!.players.find((p) => p.id === 5)!.vote.weight = 99;
    },
  ],
  [
    "forged badge",
    (r) => {
      r.checkpoints[1]!.players.find((p) => p.id === 5)!.badge.isSheriff = true;
    },
  ],
  [
    "forged checkpoint phase",
    (r) => {
      r.checkpoints[1]!.snapshot.day = 91;
    },
  ],
  [
    "raw votes disagree with recorded exile",
    (r) => {
      for (const d of r.decisions.filter((d) => d.stage === "voting" && d.day === 1))
        d.outcome = {
          kind: "action",
          action: {
            name: "vote",
            args: { target_id: d.actorId === 10 ? null : 10, abstain: d.actorId === 10 },
          },
        };
    },
  ],
  [
    "unsupported gun event",
    (r) => {
      r.events.push({ timestamp: 1, type: "player_shot", payload: { actorId: 5, targetId: 6 } });
      r.checkpoints.at(-1)!.eventCount++;
    },
  ],
  [
    "copied dream source",
    (r) => {
      r.events.find((e) => e.type === "dream_applied")!.payload.abilityId = "gift:dream";
    },
  ],
  [
    "dream reason moved after exile",
    (r) => {
      const i = r.events.findIndex((e) => e.type === "dream_death");
      const [fact] = r.events.splice(i, 1);
      const at = r.events.findIndex((e, index) => index > i && e.type === "voted_out");
      r.events.splice(at + 1, 0, fact!);
    },
  ],
  [
    "stock restored",
    (r) => {
      (
        r.checkpoints.at(-1)!.players.find((p) => p.role === "alchemist")!.privateState
          .alchemist as Record<string, unknown>
      ).healRemaining = 1;
    },
  ],
  [
    "mist stock restored",
    (r) => {
      (
        r.checkpoints[1]!.players.find((p) => p.role === "alchemist")!.privateState
          .alchemist as Record<string, unknown>
      ).mistRemaining = 1;
    },
  ],
  [
    "extra stock restored",
    (r) => {
      (
        r.checkpoints[2]!.players.find((p) => p.role === "raven_claw_wolf")!.privateState
          .ravenClaw as Record<string, unknown>
      ).extraRemaining = 1;
    },
  ],
  [
    "add previously dead wolf to knowledge",
    (r) => {
      r.events.find((e) => e.type === "raven_unsealed")!.payload.knownTeammateIds = [11];
    },
  ],
  [
    "miss the threshold",
    (r) => {
      r.events.find((e) => e.type === "raven_unsealed")!.payload.day = 1;
    },
  ],
  [
    "premature night announcement",
    (r) => {
      const i = r.events.findIndex((e) => e.type === "night_resolved");
      const [event] = r.events.splice(i, 1);
      r.events.splice(14, 0, event!);
    },
  ],
  [
    "remove penetrating source",
    (r) => {
      const op = r.operations.filter((o) => o.op === "night_damage_resolved")[1]!;
      (op.output!.death_sources as Record<string, unknown>)["3"] = ["wolf_kill"];
    },
  ],
  [
    "forge linked reason",
    (r) => {
      r.events.find((e) => e.type === "dream_death")!.payload.reason = "consecutive";
    },
  ],
  [
    "restore a linked body",
    (r) => {
      r.checkpoints[2]!.players.find((p) => p.id === 5)!.alive = true;
    },
  ],
  [
    "leak original knife through seer context",
    (r) => {
      r.decisions.find((d) => d.stage === "seer")!.request.context.wolf_target = 11;
    },
  ],
  [
    "shift wolf candidates outside circle",
    (r) => {
      r.decisions.find((d) => d.stage === "wolf_vote")!.request.context.wolf_kill_candidates = [
        1, 2, 3,
      ];
    },
  ],
  [
    "loosen required constraints",
    (r) => {
      r.decisions.find(
        (d) => d.stage === "alchemist_snake",
      )!.request.context.turn_constraints.min_valid_actions = 0;
    },
  ],
];
for (const [name, mutate] of mutations)
  test(`Mist/Raven independent ledger rejects ${name}`, async () => {
    const r = structuredClone(await mistRecording());
    mutate(r);
    expect(() => validateMistRavenRecord(r)).toThrow("reproduction_mist_raven_invalid");
    expect(() => parseReproductionRecord(r)).toThrow();
  }, 120000);
test("Mist/Raven independent RNG refuses another otherwise legal circle target", async () => {
  const r = structuredClone(await mistRecording("draw"));
  r.events.find((e) => e.type === "mist_knife_drawn")!.payload.targetId = 10;
  expect(() => validateMistRavenRecord(r)).toThrow("reproduction_mist_raven_invalid");
}, 120000);
