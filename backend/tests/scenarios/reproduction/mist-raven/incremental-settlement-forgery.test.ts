/**
 * 负责场景测试：雾鸦增量请求前缀在发布前后保留前置结算及私有状态。
 * 输入为实际阶段／前缀驱动、原缓存来源与行动、候选、库存、共同删除变体；输出由合法前缀准入与非法记录拒绝核对。
 * 保留原因果来源，不重生共享装配、矩阵或来源归档。
 */
import { test, expect } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { createRandom, type ActionRequest, type ToolCall } from "../../../../src/core";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
import { ReproductionTrace } from "../../../../src/recording/reproduction-trace";
import { validateMistRavenRecord } from "../../../../src/recording/mist_raven_record";
import { captureCheckpoint } from "../../../../src/runtime/simulation/reproduction_context";
import { mistRecording } from "../../../support/features/mist-raven/drivers/recording";
import { mistBoard, MIST_ROLES } from "../../../support/features/mist-raven/builders/board";
import { mistAction } from "../../../support/features/mist-raven/drivers/actions";

import { mistPrefix as prefix } from "../../../support/features/mist-raven/drivers/prefix";

function erase(r: ReproductionRecord, stage: string, day = 1) {
  const removed = r.decisions.find((d) => d.day === day && d.stage === stage)!;
  expect(removed.settleOrder).toBeDefined();
  r.decisions = r.decisions.filter((d) => d !== removed);
  for (const d of r.decisions) {
    if (d.openedAfterSettlement >= removed.settleOrder!) d.openedAfterSettlement--;
    if (d.settleOrder !== undefined && d.settleOrder > removed.settleOrder!) d.settleOrder--;
  }
}
function reject(r: ReproductionRecord) {
  const accepted = [() => validateMistRavenRecord(r), () => parseReproductionRecord(r)].map(
    (fn) => {
      try {
        fn();
        return true;
      } catch {
        return false;
      }
    },
  );
  expect(accepted).toEqual([false, false]);
}
test("real N1 Seer/N1 Sheriff/N2 Raven pending and preceding settled prepublication prefixes remain valid", async () => {
  for (const [stage, day] of [
    ["seer", 1],
    ["sheriff_nomination", 1],
    ["raven_knife", 2],
  ] as const) {
    const rows = await prefix(stage, day);
    for (const r of Object.values(rows)) expect(() => parseReproductionRecord(r)).not.toThrow();
  }
}, 120000);
for (const stage of ["alchemist_mist", "dreamer", "wolf_vote"] as const) {
  test(
    "unpublished Seer request cannot erase prerequisite " + stage,
    async () => {
      const r = structuredClone((await prefix("seer")).pending);
      erase(r, stage);
      reject(r);
    },
    120000,
  );
}
for (const kind of ["pending", "error"] as const) {
  test(
    "unpublished Seer cannot follow " + kind + " Mist action",
    async () => {
      const r = structuredClone((await prefix("seer")).pending);
      const d = r.decisions.find((d) => d.stage === "alchemist_mist")!;
      d.outcome =
        kind === "pending"
          ? { kind: "pending" }
          : { kind: "error", code: "decision_failed", name: "Error" };
      if (kind === "pending") delete d.settleOrder;
      reject(r);
    },
    120000,
  );
}
test("unpublished Seer cannot open before Mist settles", async () => {
  const r = structuredClone((await prefix("seer")).pending);
  r.decisions.at(-1)!.openedAfterSettlement = 0;
  reject(r);
}, 120000);
test("unpublished settled Mist action validates target cardinality and legal IDs", async () => {
  const r = structuredClone((await prefix("seer")).settled);
  const d = r.decisions.find((d) => d.stage === "alchemist_mist")!;
  if (d.outcome.kind !== "action") throw Error("fixture");
  d.outcome.action = { name: "cast_mist", args: { target_ids: [1, 1, 99] } };
  reject(r);
}, 120000);
test("first Day pending nomination still requires preceding native Seer action", async () => {
  const r = structuredClone((await prefix("sheriff_nomination")).pending);
  erase(r, "seer");
  reject(r);
}, 120000);
test("unpublished N2 Raven may not regain spent Mist stock", async () => {
  const r = structuredClone((await prefix("raven_knife", 2)).pending);
  const template = (await mistRecording()).decisions.find((d) => d.stage === "alchemist_mist")!;
  const fake = structuredClone(template);
  fake.day = 2;
  fake.request.context.day = 2;
  fake.outcome = { kind: "pending" };
  delete fake.settleOrder;
  fake.openedAfterSettlement = r.decisions.at(-1)!.openedAfterSettlement;
  r.decisions.push(fake);
  reject(r);
}, 120000);
test("unpublished first Night cannot grant sealed Raven a turn", async () => {
  const r = structuredClone((await prefix("seer")).pending);
  const source = (await mistRecording()).decisions.find((d) => d.stage === "raven_knife")!;
  const fake = structuredClone(source);
  fake.day = 1;
  fake.request.context.day = 1;
  fake.outcome = { kind: "pending" };
  delete fake.settleOrder;
  fake.openedAfterSettlement = r.decisions.at(-1)!.openedAfterSettlement;
  r.decisions.push(fake);
  reject(r);
}, 120000);
test("unpublished Snake window validates raw knife, candidate and source Night before Day rescue", async () => {
  const r = structuredClone((await prefix("sheriff_nomination")).pending);
  const source = (await mistRecording()).decisions.find((d) => d.stage === "alchemist_snake")!;
  const fake = structuredClone(source);
  fake.request.context.snake_target = 2;
  fake.request.context.snake_candidates = [2];
  fake.outcome = { kind: "pending" };
  delete fake.settleOrder;
  fake.openedAfterSettlement = r.decisions.at(-1)!.openedAfterSettlement;
  r.decisions.push(fake);
  reject(r);
}, 120000);

test("settled unpublished Seer must validate actual tool and self target", async () => {
  const r = structuredClone((await prefix("sheriff_nomination")).settled);
  const d = r.decisions.find((d) => d.stage === "seer")!;
  d.outcome = { kind: "action", action: { name: "check_identity", args: { target_id: 2 } } };
  reject(r);
}, 120000);

async function oneCycle(
  mode:
    | "soft-null"
    | "soft-invalid"
    | "sheriff-clockwise"
    | "sheriff-counter-clockwise"
    | "sheriff-invalid",
) {
  const board = await mistBoard(),
    seed = "mist-raven-real-runtime";
  const game = bootstrapGame(board.config, {
    locale: "en",
    random: createRandom(seed),
    fixedRoles: MIST_ROLES,
  });
  const trace = new ReproductionTrace((await mistRecording()).metadata, () => {});
  const cp = (cycle: number) =>
    trace.checkpoint(
      captureCheckpoint(
        game.world,
        game.phaseManager.getSnapshot(),
        cycle,
        true,
        game.phaseManager.getEvents().length,
      ),
      game.phaseManager.getEvents(),
    );
  cp(0);
  const provider = {
    async getAction(q: ActionRequest): Promise<ToolCall | null> {
      const s = q.context.stage;
      if (mode.startsWith("sheriff")) {
        if (s === "sheriff_nomination")
          return { name: "run_for_sheriff", args: { run: q.actorId === 1 } };
        if (s === "sheriff_campaign_speech")
          return { name: "speak", args: { text: "Vote for me" } };
        if (s === "sheriff_withdraw") return { name: "run_for_sheriff", args: { run: true } };
        if (s === "sheriff_choose_direction")
          return mode === "sheriff-invalid"
            ? null
            : {
                name: "choose_direction",
                args: {
                  direction: mode === "sheriff-clockwise" ? "clockwise" : "counter_clockwise",
                },
              };
      }
      if (
        mode.startsWith("soft") &&
        (s === "day_speech" || s === "last_words" || (s === "voting" && q.actorId === 5))
      ) {
        return mode === "soft-null"
          ? null
          : { name: "vote", args: { target_id: 99, abstain: false } };
      }
      return mistAction(q, "linked");
    },
  };
  await game.phaseManager.runSingleCycle({ getAction: (q) => trace.decide(q, provider) }, 8);
  cp(1);
  return { trace, events: game.phaseManager.getEvents() };
}
for (const mode of [
  "soft-null",
  "soft-invalid",
  "sheriff-clockwise",
  "sheriff-counter-clockwise",
  "sheriff-invalid",
] as const) {
  test(
    "real Mist one-cycle record preserves ordinary behavior/" + mode,
    async () => {
      const { trace, events } = await oneCycle(mode);
      expect(events.some((e) => e.type === "alchemist_snake_chosen")).toBe(true);
      if (mode.startsWith("sheriff")) {
        expect(events.find((e) => e.type === "sheriff_elected")?.payload.winnerId).toBe(1);
        expect(
          events.filter((e) => e.type === "day_speech").map((e) => e.payload.actorId),
        ).not.toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
      } else expect(events.filter((e) => e.type === "day_speech")).toHaveLength(0);
      expect(() => trace.build()).not.toThrow();
    },
    120000,
  );
}

for (const stage of ["dreamer", "wolf_vote"] as const)
  for (const kind of ["pending", "error"] as const) {
    test(
      "unpublished Seer cannot follow " + kind + " " + stage,
      async () => {
        const r = structuredClone((await prefix("seer")).pending),
          d = r.decisions.find((d) => d.stage === stage)!;
        d.outcome =
          kind === "pending"
            ? { kind: "pending" }
            : { kind: "error", code: "decision_failed", name: "Error" };
        if (kind === "pending") delete d.settleOrder;
        reject(r);
      },
      120000,
    );
  }
for (const mode of ["missing", "pending", "error"] as const) {
  test(
    "actual explicit-pass Mist prerequisite may not become " + mode,
    async () => {
      const r = structuredClone((await prefix("seer", 1, true)).pending);
      if (mode === "missing") erase(r, "alchemist_mist");
      else {
        const d = r.decisions.find((d) => d.stage === "alchemist_mist")!;
        d.outcome =
          mode === "pending"
            ? { kind: "pending" }
            : { kind: "error", code: "decision_failed", name: "Error" };
        if (mode === "pending") delete d.settleOrder;
      }
      reject(r);
    },
    120000,
  );
}

function erasePublishedFact(r: ReproductionRecord, type: string) {
  const index = r.events.findIndex((e) => e.type === type);
  expect(index).toBeGreaterThanOrEqual(0);
  const [removed] = r.events.splice(index, 1);
  for (const cp of r.checkpoints) if (cp.eventCount > index) cp.eventCount--;
  for (const d of r.decisions)
    d.request.context.visible_events = d.request.context.visible_events
      .filter(
        (e) =>
          e.type !== removed!.type ||
          JSON.stringify(e.payload) !== JSON.stringify(removed!.payload),
      )
      .map((e, i) => ({ ...e, seq: i + 1 }));
}
test("published Day still rejects jointly erased Seer action and fact with stock rolled to cp0", async () => {
  const r = structuredClone((await prefix("sheriff_nomination")).published);
  erase(r, "seer");
  erasePublishedFact(r, "seer_checked");
  const stock = r.checkpoints[0]!.players.find((p) => p.id === 2)!.privateState;
  for (const cp of r.checkpoints.slice(1))
    cp.players.find((p) => p.id === 2)!.privateState = structuredClone(stock);
  reject(r);
}, 120000);
test("published Night successor still rejects jointly erased Mist action and fact with stock rolled to cp0", async () => {
  const r = structuredClone((await prefix("seer")).published);
  erase(r, "alchemist_mist");
  erasePublishedFact(r, "alchemist_mist_chosen");
  const stock = r.checkpoints[0]!.players.find((p) => p.id === 1)!.privateState;
  for (const cp of r.checkpoints.slice(1))
    cp.players.find((p) => p.id === 1)!.privateState = structuredClone(stock);
  reject(r);
}, 120000);
