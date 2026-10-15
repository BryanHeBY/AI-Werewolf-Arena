/**
 * 只刻画鬼新娘既有请求的真实恢复轨迹；不是新 F02 政策测试或生产补丁。
 * 使用合法十二人原板、bootstrap 返回的同一 boardConfig、实际 setup/window/factory/gateway。
 * 每个原 envelope/domain/时钟探针使用新 World，记录正确 owner 查询与真实窗口结局；
 * registered alias 自身坏、共享 context 坏、未登记／wrongWorld 分开，结果不先假设新共闭或独退。
 * 第二声明仅在 Root 看见 groom 恢复实证后单独执行；它实际尝试第二同意而不以查询代替付款。
 */
import { afterAll, expect, spyOn, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { bootstrapGame } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/app/bootstrap";
import {
  COMPONENT, World, createRandom, deferRequestDelivery,
  type ActionRequest, type GameEvent, type ToolCall,
} from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core";
import { ToolGateway } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/gateway/tool_gateway";
import { GameActionRequestFactory } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/engine/action_request_factory";
import { GhostBrideSetupWindow } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/ghost_bride/setup";
import {
  ghostBrideRequestScope, inheritGhostBrideDeadlineRequest, commitWeddingTool,
  weddingSetup, weddingPair, weddingGroup, ghostBrideReady,
} from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/ghost_bride/authority";
import { ghostBrideBoard, ghostBrideDeck } from "/home/hby/dev/AI-Werewolf-Arena/backend/tests/support/features/ghost-bride/builders/scenario";

const results: unknown[] = [];
let selectedGroup: "not-run" | "groom" | "witness" = "not-run";
const errorTag = (error: unknown) => error instanceof Error
  ? { name: error.name, message: error.message }
  : { thrownType: typeof error, undefined: error === undefined };
const call = (request: ActionRequest): ToolCall => {
  if (request.allowedTools.includes("choose_bridegroom"))
    return { name: "choose_bridegroom", args: { target_id: 2 } };
  if (request.allowedTools.includes("speak_to_partner"))
    return { name: "speak_to_partner", args: { text: "" } };
  if (request.allowedTools.includes("choose_wedding_witness"))
    return { name: "choose_wedding_witness", args: { target_id: 3 } };
  throw new Error("ghost_legacy_probe_unexpected_tool");
};
function fixture(label: string) {
  const game = bootstrapGame(ghostBrideBoard(), {
    fixedRoles: ghostBrideDeck,
    locale: "zh-CN",
    random: createRandom("ghost-legacy-probe:" + label),
  });
  const events: GameEvent[] = [];
  const window = new GhostBrideSetupWindow(game.world, new ToolGateway(), events, {
    get requestFactory() { return GameActionRequestFactory; },
  });
  return { ...game, events, window };
}
function state(g: ReturnType<typeof fixture>) {
  return structuredClone({
    setup: weddingSetup(g.world),
    pair: weddingPair(g.world),
    group: weddingGroup(g.world),
    ready: ghostBrideReady(g.world),
    brideState: structuredClone(g.world.getComponent(1, COMPONENT.Role)!.privateState),
    camps: g.playerIds.map(id => ({ id, camp: g.world.getComponent(id, COMPONENT.Camp)?.camp })),
    victory: g.playerIds.map(id => ({ id, affiliations: g.world.getComponent(id, COMPONENT.Victory)?.affiliations })),
    events: g.events.map(e => ({ type: e.type, payload: e.payload, audience: e.audience })),
  });
}
function mark(trace: unknown[], label: string, query: () => object | undefined, scope: object) {
  try {
    const value = query();
    const outcome = value === scope ? "same-scope" : value === undefined ? "undefined" : "different-object";
    trace.push({ label, outcome });
    return outcome;
  } catch (error) {
    trace.push({ label, outcome: "throw", error: errorTag(error) });
    return "throw";
  }
}

afterAll(() => {
  writeFileSync(`/tmp/awa-ghost-bride-request-f02/${selectedGroup}-results.json`, JSON.stringify({
    kind: "actual-legacy-ghost-request-characterization",
    policyChanged: false,
    selectedGroup,
    results,
    limits: [
      "Only source/fixture inputs explicitly captured in before.json are fixed; transitive dependencies are the execution workspace.",
      "Restoration is observed in scope queries and separately the actual window result; no all-permission revival inference.",
      "Alias-own context policy is recorded without imposing common-close or alias-only target semantics.",
      "Witness declaration is prepared but must be run only after Root reviews groom restoration evidence.",
      "No NightPipeline whole night, wedding knife, DeathWave, model or old suite is executed by this script.",
    ],
  }, null, 2) + "\n");
});

test("Ghost legacy groom: record original/domain/expiry recovery and alias isolation through actual setup", async () => {
  selectedGroup = "groom";
  // 六种故障独立 Worlds；一个声明包含六次完整窗口，不冒六个不同 test。
  const probes = ["stage", "context", "body", "domain", "expiry", "alias"] as const;
  for (const probe of probes) {
    const g = fixture(probe), trace: unknown[] = [], settlements: boolean[] = [];
    let domain = true, providerCalls = 0, original: ActionRequest | undefined, scope: object | undefined;
    let originalQuery: (() => object | undefined) | undefined;
    let outcome: unknown;
    try {
      outcome = { returned: await g.window.execute(g.boardConfig, {
        getAction: async request => {
          providerCalls++;
          if (request.context.stage !== "ghost_bride_groom") return call(request);
          original = request;
          scope = ghostBrideRequestScope(g.world, request);
          // 仅断言探针确实进入真实有效旧窗口；恢复结果由记录给出，不迎合新政策 oracle。
          expect(scope).toBeDefined();
          originalQuery = () => ghostBrideRequestScope(g.world, request);
          const q = originalQuery, captured = scope!;
          mark(trace, "original-bound", q, captured);
          trace.push({ label: "defer-original", accepted: deferRequestDelivery(request, yes => settlements.push(yes)) });
          const mutable = request as unknown as { context: Record<string, unknown>; allowedTools: unknown[] };
          if (probe === "stage") {
            const prior = mutable.context.stage;
            mutable.context.stage = "ghost_probe_wrong_stage";
            mark(trace, "stage-invalid-observed", q, captured);
            mutable.context.stage = prior;
            mark(trace, "stage-restored", q, captured);
          } else if (probe === "context") {
            const prior = mutable.context;
            mutable.context = { ...prior };
            mark(trace, "original-context-clone-observed", q, captured);
            mutable.context = prior;
            mark(trace, "original-context-reference-restored", q, captured);
          } else if (probe === "body") {
            const prior = mutable.allowedTools;
            mutable.allowedTools = ["speak"];
            mark(trace, "original-body-invalid-observed", q, captured);
            mutable.allowedTools = prior;
            mark(trace, "original-body-reference-restored", q, captured);
          } else if (probe === "domain") {
            domain = false;
            mark(trace, "domain-invalid-observed", q, captured);
            domain = true;
            mark(trace, "domain-restored", q, captured);
          } else if (probe === "expiry") {
            const now = Date.now(), earlier = { ...request, deadlineAtMs: now + 5_000 };
            inheritGhostBrideDeadlineRequest(request, earlier);
            mark(trace, "future-earliest-alias-bound", () => ghostBrideRequestScope(g.world, earlier), captured);
            const clock = spyOn(Date, "now").mockReturnValue(now + 5_001);
            try {
              mark(trace, "expiry-observed-original", q, captured);
              mark(trace, "expiry-observed-alias", () => ghostBrideRequestScope(g.world, earlier), captured);
              clock.mockReturnValue(now);
              mark(trace, "clock-restored-original", q, captured);
              mark(trace, "clock-restored-alias", () => ghostBrideRequestScope(g.world, earlier), captured);
            } finally { clock.mockRestore(); }
          } else {
            const alias = { ...request, deadlineAtMs: Date.now() + 60_000 };
            inheritGhostBrideDeadlineRequest(request, alias);
            mark(trace, "registered-alias-bound", () => ghostBrideRequestScope(g.world, alias), captured);
            const prior = alias.context;
            (alias as { context: ActionRequest["context"] }).context = { ...prior };
            mark(trace, "registered-alias-own-context-invalid", () => ghostBrideRequestScope(g.world, alias), captured);
            mark(trace, "original-after-alias-own-invalid", q, captured);
            (alias as { context: ActionRequest["context"] }).context = prior;
            mark(trace, "registered-alias-own-context-restored", () => ghostBrideRequestScope(g.world, alias), captured);
            const unknown = { ...request, context: { ...request.context } };
            mark(trace, "unknown-unregistered-alias", () => ghostBrideRequestScope(g.world, unknown), captured);
            mark(trace, "original-after-unknown", q, captured);
            mark(trace, "wrong-world", () => ghostBrideRequestScope(new World(), request), captured);
            mark(trace, "original-after-wrong-world", q, captured);
          }
          trace.push({ label: "before-actual-window-commit", state: state(g) });
          return call(request);
        },
      }, 1, () => domain) };
    } catch (error) {
      outcome = { thrown: errorTag(error) };
    }
    expect(providerCalls).toBeGreaterThan(0);
    if (original && scope && originalQuery) mark(trace, "after-actual-window-finally-original", originalQuery, scope);
    results.push({ probe, providerCalls, trace, settlements, outcome, after: state(g) });
  }
});

test("Ghost legacy witness: first consent proof rejection then restoration reaches actual second commit", async () => {
  selectedGroup = "witness";
  const g = fixture("first-consent"), trace: unknown[] = [];
  let first: ActionRequest | undefined, secondProbed = false, providerCalls = 0, outcome: unknown;
  try {
    outcome = { returned: await g.window.execute(g.boardConfig, {
      getAction: async request => {
        providerCalls++;
        if (request.context.stage === "ghost_bride_witness" && request.allowedTools.includes("choose_wedding_witness")) {
          if (!first) {
            first = request;
            trace.push({ label: "first-witness-before-actual-commit", actorId: request.actorId, state: state(g) });
          } else {
            secondProbed = true;
            const secondScope = ghostBrideRequestScope(g.world, request);
            expect(secondScope).toBeDefined();
            expect(first.actorId).toBe(1);
            expect(request.actorId).toBe(2);
            mark(trace, "second-bound-after-first-actual-consent", () => ghostBrideRequestScope(g.world, request), secondScope!);
            const prior = first.context.day;
            first.context.day = 2;
            mark(trace, "first-proof-invalid-observed-through-second", () => ghostBrideRequestScope(g.world, request), secondScope!);
            // 真实领域尝试，不用纯query假装第二同意已被拒；此false自身的settlement副作用如实保留。
            const refused = commitWeddingTool(secondScope!, { name: "choose_wedding_witness", args: { target_id: 3 } });
            trace.push({ label: "actual-second-commit-while-first-proof-invalid", returned: refused, state: state(g) });
            first.context.day = prior;
            mark(trace, "first-proof-restored-query-second", () => ghostBrideRequestScope(g.world, request), secondScope!);
            trace.push({ label: "restored-before-original-window-second-commit", state: state(g) });
          }
        }
        return call(request);
      },
    }, 1, () => true) };
  } catch (error) { outcome = { thrown: errorTag(error) }; }
  expect(secondProbed).toBe(true);
  results.push({ probe: "first-consent-proof", providerCalls, trace, outcome, after: state(g) });
});
