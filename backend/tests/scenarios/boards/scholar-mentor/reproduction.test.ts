/**
 * 场景测试先录制完整学者／导师 transport 对局，再核对原始与明确伪造的归档证据。
 * 输入为真实记录前缀及手写决定／能力／事件／checkpoint 变异，预期为字面 parser／verifier
 * 拒绝与独立原生增益账本。beforeAll 录制归 transport driver，伪造副本不替换原记录、
 * 重生 golden 或把生产执行结果当作独立规则预期。
 */
import { validateScholarMentorRecord } from "../../../../src/recording/verification/scholar-mentor/validate";
import { beforeAll, expect, test } from "bun:test";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import { scholarMentorScenario } from "../../../support/features/scholar-mentor/builders/transport-plan";
import {
  parseReproductionRecord,
  type ReproductionRecord,
} from "../../../../src/recording/reproduction/format";
let record: ReproductionRecord;
beforeAll(async () => {
  record = (await runTransportGame(scholarMentorScenario(), "llm", "en")).record;
}, 120000);
const event = (r: ReproductionRecord, type: string) => r.events.find((e) => e.type === type)!;
const player = (r: ReproductionRecord, role: string) =>
  r.checkpoints.at(-1)!.players.find((p) => p.role === role)!;
const ability = (r: ReproductionRecord, role: string) =>
  Object.values(
    player(r, role).privateState.abilities as Record<
      string,
      { uses: number; state: Record<string, unknown> }
    >,
  )[0]!;
function remove(r: ReproductionRecord, type: string) {
  const i = r.events.findIndex((e) => e.type === type);
  expect(i).toBeGreaterThanOrEqual(0);
  r.events.splice(i, 1);
  for (const cp of r.checkpoints) if (cp.eventCount > i) cp.eventCount--;
}
const mutations: Array<[string, (r: ReproductionRecord) => void]> = [
  [
    "witch poison constraint forged",
    (r) => {
      r.decisions.find(
        (d) => d.day === 2 && d.stage === "witch",
      )!.request.context.modifier_poison_blocked = true;
    },
  ],
  [
    "witch multiple knife targets forged",
    (r) => {
      r.decisions.find((d) => d.day === 2 && d.stage === "witch")!.request.context.wolf_targets = [
        999,
      ];
    },
  ],
  [
    "witch primary knife target forged",
    (r) => {
      r.decisions.find((d) => d.day === 2 && d.stage === "witch")!.request.context.wolf_target =
        999;
    },
  ],
  [
    "witch visible knife omitted",
    (r) => {
      delete r.decisions.find((d) => d.day === 2 && d.stage === "witch")!.request.context
        .wolf_targets;
    },
  ],
  [
    "choice request actor forged",
    (r) => {
      r.decisions.find((d) => d.stage === "scholar_mentor_choice")!.request.actorId = 999;
    },
  ],
  [
    "choice request stage forged",
    (r) => {
      r.decisions.find((d) => d.stage === "scholar_mentor_choice")!.request.context.stage = "seer";
    },
  ],
  [
    "choice constraints forged",
    (r) => {
      r.decisions.find(
        (d) => d.stage === "scholar_mentor_choice",
      )!.request.context.turn_constraints = { min_valid_actions: 0, max_valid_actions: 0 };
    },
  ],
  [
    "bonus request actor forged",
    (r) => {
      r.decisions.find((d) => d.stage === "scholar_mentor_bonus")!.request.actorId = 999;
    },
  ],
  [
    "native guard phase forged",
    (r) => {
      r.decisions.find((d) => d.stage === "guard")!.request.phase =
        "day" as (typeof r.decisions)[number]["request"]["phase"];
    },
  ],
  [
    "night operation duplicated",
    (r) => {
      r.operations.push(
        structuredClone(r.operations.find((o) => o.op === "night_damage_resolved")!),
      );
    },
  ],

  ["choice omitted", (r) => remove(r, "modifier_choice_committed")],
  ["skip omitted", (r) => remove(r, "modifier_choice_skipped")],
  ["bonus omitted", (r) => remove(r, "modifier_bonus_resolved")],
  ["native guard omitted", (r) => remove(r, "guard_applied")],
  ["native seer omitted", (r) => remove(r, "seer_checked")],
  ["native poison omitted", (r) => remove(r, "witch_potion_used")],
  [
    "choice target forged",
    (r) => {
      event(r, "modifier_choice_committed").payload.targetId = 999;
    },
  ],
  [
    "choice mode forged",
    (r) => {
      event(r, "modifier_choice_committed").payload.mode = "weaken";
    },
  ],
  [
    "choice day forged",
    (r) => {
      event(r, "modifier_choice_committed").payload.day = 1;
    },
  ],
  [
    "choice audience forged",
    (r) => {
      event(r, "modifier_choice_committed").audience = [];
    },
  ],
  [
    "skip reason forged",
    (r) => {
      event(r, "modifier_choice_skipped").payload.reason = "exhausted";
    },
  ],
  [
    "bonus kind forged",
    (r) => {
      event(r, "modifier_bonus_resolved").payload.kind = "poison";
    },
  ],
  [
    "bonus actor forged",
    (r) => {
      event(r, "modifier_bonus_resolved").payload.actorId = player(r, "day_scholar").id;
    },
  ],
  [
    "bonus target repeats native",
    (r) => {
      const e = event(r, "modifier_bonus_resolved"),
        d = r.decisions.find((d) => d.day === 2 && d.stage === "wolf_vote")!;
      if (d.outcome.kind !== "action" || d.outcome.action?.name !== "kill_vote")
        throw new Error("fixture");
      e.payload.targetId = d.outcome.action.args.target_id;
    },
  ],
  [
    "bonus result forged",
    (r) => {
      r.events.find(
        (e) => e.type === "modifier_bonus_resolved" && e.payload.kind === "check",
      )!.payload.isWerewolf = false;
    },
  ],
  [
    "bonus audience forged",
    (r) => {
      event(r, "modifier_bonus_resolved").audience = [player(r, "day_scholar").id];
    },
  ],
  [
    "night deaths omitted",
    (r) => {
      event(r, "night_resolved").payload.deaths = [];
    },
  ],
  [
    "night deaths added",
    (r) => {
      (event(r, "night_resolved").payload.deaths as number[]).push(player(r, "day_scholar").id);
    },
  ],
  [
    "caster inventory forged",
    (r) => {
      (
        player(r, "day_scholar").privateState.scholarMentor as { remaining: { enhance: number } }
      ).remaining.enhance = 1;
    },
  ],
  [
    "caster history forged",
    (r) => {
      (player(r, "night_mentor").privateState.scholarMentor as { history: unknown[] }).history = [];
    },
  ],
  [
    "witch heal refilled",
    (r) => {
      ability(r, "witch").state.heal = 1;
    },
  ],
  [
    "witch poison refilled",
    (r) => {
      ability(r, "witch").state.poison = 1;
    },
  ],
  [
    "witch uses forged",
    (r) => {
      ability(r, "witch").uses++;
    },
  ],
  [
    "guard history forged",
    (r) => {
      ability(r, "guard").state.lastTarget = 999;
    },
  ],
  [
    "seer history forged",
    (r) => {
      ability(r, "seer").state.history = [];
    },
  ],
  [
    "seer result forged",
    (r) => {
      ability(r, "seer").state.lastResult = { kind: "camp", camp: "good" };
    },
  ],
  [
    "future own bonus exposed",
    (r) => {
      const e = r.events.find(
          (e) => e.type === "modifier_bonus_resolved" && e.payload.kind === "check",
        )!,
        d = r.decisions.find(
          (d) =>
            d.day === 2 && d.actorId === e.payload.actorId && d.stage === "scholar_mentor_bonus",
        )!;
      d.request.context.visible_events.push({
        seq: r.events.indexOf(e) + 1,
        type: e.type,
        payload: structuredClone(e.payload),
      });
    },
  ],
  [
    "conflict exposed",
    (r) => {
      r.decisions[0]!.request.context.visible_events.push({
        seq: 1,
        type: "modifier_conflict_resolved",
        payload: { day: 1, kind: "same_good", targetId: 1 },
      });
    },
  ],
  [
    "choice candidates widened",
    (r) => {
      const d = r.decisions.find((d) => d.stage === "scholar_mentor_choice")!;
      d.request.context.modifier_candidates = [...d.request.context.modifier_candidates!, 999];
    },
  ],
  [
    "bonus candidates widened",
    (r) => {
      const d = r.decisions.find((d) => d.stage === "scholar_mentor_bonus")!;
      d.request.context.modifier_bonus_candidates = [
        ...d.request.context.modifier_bonus_candidates!,
        999,
      ];
    },
  ],
  [
    "bonus field outside stage",
    (r) => {
      r.decisions[0]!.request.context.modifier_bonus_kind = "check";
    },
  ],
  [
    "poison field outside stage",
    (r) => {
      r.decisions[0]!.request.context.modifier_poison_blocked = true;
    },
  ],
];
test("Scholar Mentor accepts captured transport record", () =>
  expect(() => parseReproductionRecord(record)).not.toThrow());
for (const [name, mutate] of mutations)
  test("Scholar Mentor rejects tampered record/" + name, () => {
    const copy = structuredClone(record);
    mutate(copy);
    expect(() => parseReproductionRecord(copy)).toThrow();
  });

for (const field of [
  "modifier_modes",
  "modifier_candidates",
  "modifier_bonus_kind",
  "modifier_bonus_candidates",
  "modifier_poison_blocked",
  "wolf_targets",
])
  test("Scholar Mentor rejects modifier context on ordinary board/" + field, () => {
    const ordinary = {
      metadata: { normalizedBoard: { roleSetups: [] } },
      events: [],
      checkpoints: [],
      decisions: [{ stage: "guard", request: { allowedTools: [], context: { [field]: [] } } }],
    } as unknown as ReproductionRecord;
    expect(() => validateScholarMentorRecord(ordinary)).toThrow(
      "reproduction_scholar_mentor_invalid",
    );
  });

for (const mutation of ["extra-wolf", "wrong-camp", "duplicate-id"] as const)
  test("Scholar Mentor rejects initial roster forgery/" + mutation, () => {
    const copy = structuredClone(record);
    copy.events = [];
    copy.decisions = [];
    copy.checkpoints = [];
    copy.finalized = false;
    const villager = copy.metadata.players.find((p) => p.role === "villager")!;
    if (mutation === "extra-wolf") {
      villager.role = "wolf" as typeof villager.role;
      villager.camp = "wolf" as typeof villager.camp;
    } else if (mutation === "wrong-camp") villager.camp = "wolf" as typeof villager.camp;
    else villager.id = copy.metadata.players.find((p) => p.id !== villager.id)!.id;
    expect(() => validateScholarMentorRecord(copy)).toThrow("reproduction_scholar_mentor_invalid");
  });
test("Scholar Mentor accepts unstarted roster audit prefix", () => {
  const copy = structuredClone(record);
  copy.events = [];
  copy.decisions = [];
  copy.checkpoints = [];
  copy.finalized = false;
  expect(() => validateScholarMentorRecord(copy)).not.toThrow();
});

for (const change of ["deaths", "sources", "status", "missing"] as const)
  test("Scholar Mentor rejects night operation forgery/" + change, () => {
    const copy = structuredClone(record),
      index = copy.operations.findIndex(
        (o) =>
          o.op === "night_damage_resolved" &&
          Array.isArray(o.output?.deaths) &&
          o.output.deaths.length > 0,
      );
    expect(index).toBeGreaterThanOrEqual(0);
    const op = copy.operations[index]!;
    if (change === "missing") copy.operations.splice(index, 1);
    else if (change === "deaths") op.output!.deaths = [];
    else if (change === "sources") op.output!.death_sources = {};
    else op.status = "error";
    expect(() => validateScholarMentorRecord(copy)).toThrow("reproduction_scholar_mentor_invalid");
  });
test("Scholar Mentor rejects bonus request for unopened night", () => {
  const copy = structuredClone(record),
    d = structuredClone(copy.decisions.find((d) => d.stage === "scholar_mentor_bonus")!);
  d.day = 999;
  d.request.context.day = 999;
  copy.decisions.push(d);
  expect(() => validateScholarMentorRecord(copy)).toThrow("reproduction_scholar_mentor_invalid");
});

for (const outcome of ["error", "pending", "action"] as const)
  test(
    "Scholar rejects a suppressed native guard request without a success event/" + outcome,
    () => {
      const copy = structuredClone(record);
      const forged = structuredClone(
        copy.decisions.find((d) => d.day === 2 && d.stage === "guard")!,
      );
      forged.day = 3;
      forged.request.context.day = 3;
      forged.request.context.visible_events = [];
      forged.turn = 1;
      forged.settleOrder = Math.max(...copy.decisions.map((d) => d.settleOrder ?? 0)) + 1;
      if (outcome === "error")
        forged.outcome = { kind: "error", code: "decision_failed", name: "Error" };
      if (outcome === "pending") forged.outcome = { kind: "pending" };
      copy.decisions.push(forged);
      expect(() => validateScholarMentorRecord(copy)).toThrow(
        "reproduction_scholar_mentor_invalid",
      );
    },
  );
