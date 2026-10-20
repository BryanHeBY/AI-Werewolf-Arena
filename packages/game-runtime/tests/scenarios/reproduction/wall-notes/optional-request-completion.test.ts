/**
 * 场景测试负责匿名墙可选请求的处理完成、纸条未付款与录制候选的区别。
 * 输入为手写 null／坏形态候选和显式拒绝规则；独立预期是六份原库存不扣、原拒绝事实和原候选。
 * 前两例运行一次真实周期并做同构建严格 Tape 重放；第三例只核显式规则下的窗口重放，
 * 不把未写入 Tape 的自定义 validator 当成默认精确重放已经支持的输入，不调用模型或本机端口。
 */
import { expect, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { RuleError } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { GameEventRecorder } from "../../../../src/app/game-event-recorder";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../../src/app/simulation/reproduction-context";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import {
  COMPONENT,
  Role,
  PotionType,
  createRandom,
  type ActionRequest,
  type GameEvent,
  type ToolCall,
} from "../../../../src/domain";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ActionValidator } from "../../../../src/engine/actions/action-validator";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { ToolValidationRuleRegistry } from "../../../../src/engine/actions/tool-validation-rule-registry";
import { WallNotesWindow } from "../../../../src/features/wall-notes/window";
import { ReproductionTrace } from "../../../../src/recording/reproduction/trace";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

const roles = [Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager];
const ids = [1, 2, 3, 4, 5, 6];
const badShape: ToolCall = { name: "write_note", args: { text: "" } };
const validNote: ToolCall = { name: "write_note", args: { text: "literal note" } };
function fixture(seed: string) {
  return bootstrapGame(
    { ...foxBoard(roles), events: { pack: "awa_wall_notes_once_v1" as const } },
    { fixedRoles: roles, random: createRandom(seed) },
  );
}
function normalCandidate(request: ActionRequest): ToolCall | null {
  if (request.allowedTools.includes("speak_to_wolves"))
    return { name: "speak_to_wolves", args: { text: "done", end_chat: true } };
  if (request.allowedTools.includes("kill_vote"))
    return { name: "kill_vote", args: { target_id: null, abstain: true } };
  if (request.allowedTools.includes("check_identity"))
    return { name: "check_identity", args: { target_id: 1 } };
  if (request.allowedTools.includes("use_potion"))
    return {
      name: "use_potion",
      args: { target_id: request.actorId, potion_type: PotionType.None },
    };
  if (request.allowedTools.includes("vote"))
    return { name: "vote", args: { target_id: null, abstain: true } };
  if (request.allowedTools.includes("speak"))
    return { name: "speak", args: { text: "literal speech" } };
  throw new Error(`unexpected literal fixture stage: ${request.context.stage}`);
}
function assertUnpaidNotes(
  game: ReturnType<typeof fixture>,
  events: readonly GameEvent[],
  rejected: boolean,
) {
  expect(game.world.getAliveEntityIds()).toEqual(ids);
  for (const id of ids)
    expect(game.world.getComponent(id, COMPONENT.WallNote)).toMatchObject({
      remaining: 1,
      expired: true,
    });
  const changes = events.filter((event) => event.type === "wall_note_changed");
  expect(
    changes
      .filter((event) => event.payload.operation === "granted")
      .map((event) => event.payload.actorId),
  ).toEqual(ids);
  expect(changes.filter((event) => event.payload.operation === "accepted")).toEqual([]);
  expect(
    changes
      .filter((event) => event.payload.operation === "rejected")
      .map((event) => event.payload.actorId),
  ).toEqual(rejected ? ids : []);
  expect(
    changes
      .filter((event) => event.payload.operation === "expired")
      .map((event) => event.payload.actorId),
  ).toEqual(ids);
  expect(
    events
      .filter((event) => event.type === "wall_notes_published")
      .map((event) => event.payload.texts),
  ).toEqual([[]]);
}
async function recordedCycle(candidate: ToolCall | null, label: string) {
  const game = fixture(`wall-optional-${label}`);
  const manager = await SessionRecordManager.create(
    {
      sessionId: `wall-optional-${label}`,
      board: "literal_wall_optional",
      locale: "zh-CN",
      startedAtIso: new Date().toISOString(),
      random: game.random.metadata,
    },
    await createTestTempDirectory(`awa-wall-optional-${label}-`),
  );
  const recorder = new GameEventRecorder(
    { world: game.world, replayManager: manager },
    game.phaseManager.getSnapshot().phase,
  );
  const engine = await currentEngineVersion();
  await runWithSessionRecorder(manager, async () => {
    const trace = beginGameReproduction(manager, game, {
      engine,
      boardId: "literal_wall_optional",
      locale: "zh-CN",
      maxDays: 10,
    });
    let cycleFailure: unknown;
    try {
      await game.phaseManager.runSingleCycle(
        {
          getAction: (request) =>
            trace.decide(request, {
              getAction: async (input) =>
                input.context.stage === "wall_notes"
                  ? structuredClone(candidate)
                  : normalCandidate(input),
            }),
        },
        10,
      );
    } catch (error) {
      cycleFailure = error;
      trace.noteFailure("cycle", error);
    }
    const events = game.phaseManager.getEvents();
    recorder.flush(events);
    const checkpoint = captureCheckpoint(
      game.world,
      game.phaseManager.getSnapshot(),
      1,
      cycleFailure === undefined,
      events.length,
      cycleFailure,
    );
    trace.checkpoint(checkpoint, events);
    await manager.finalize({
      endedAtIso: new Date().toISOString(),
      winner: null,
      finishReason: cycleFailure === undefined ? "runtime_timeout" : "runtime_error",
      players: checkpoint.players.map((player) => ({
        player_id: player.id,
        name: player.name,
        role: player.role,
        camp: player.camp,
        alive: player.alive,
      })),
    });
    if (cycleFailure !== undefined) throw cycleFailure;
  });
  return { game, record: await readReproduction(manager.sessionDir + "/reproduction.json") };
}

for (const kind of ["null", "invalid-shape"] as const)
  test(`optional Wall ${kind} remains unpaid and strict replay retains the processed candidate`, async () => {
    const candidate = kind === "null" ? null : badShape;
    const { game, record } = await recordedCycle(candidate, kind);
    // 库存和事实是字面预期；下面的重放相等只声明本局录制一致性。
    assertUnpaidNotes(game, game.phaseManager.getEvents(), kind !== "null");
    expect(game.phaseManager.getSnapshot()).toMatchObject({ day: 2, gameOver: false });
    const decisions = record.decisions.filter((decision) => decision.stage === "wall_notes");
    expect(decisions.map((decision) => decision.actorId)).toEqual(ids);
    expect(decisions.map((decision) => decision.outcome)).toEqual(
      ids.map(() => ({ kind: "action", action: candidate })),
    );
    const replay = await replayReproduction(
      record,
      await createTestTempDirectory("awa-wall-optional-exact-"),
    );
    expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
  });

function rejectingGateway() {
  // 这是显式测试输入，不是默认生产规则，也不声称 Tape 已序列化这个规则注册表。
  return new ToolGateway(
    new ActionValidator(
      new ToolValidationRuleRegistry({
        write_note: () => ({ code: RuleError.WallNoteText }),
      }),
    ),
  );
}
async function rejectedWindow(candidates?: ReadonlyMap<number, ToolCall | null>) {
  const game = fixture("wall-optional-gateway-rejection"),
    events: GameEvent[] = [];
  const initial = captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0);
  const trace = new ReproductionTrace(
    {
      engine: await currentEngineVersion(),
      random: game.random.metadata,
      ruleset: RULESET,
      boardId: "literal_wall_gateway_rejection",
      normalizedBoard: game.rulePlan.encodeParameters(),
      locale: "zh-CN",
      maxDays: 10,
      dealMode: "fixed",
      players: initial.players.map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        camp: player.camp,
      })),
    },
    () => {},
  );
  trace.checkpoint(initial, []);
  await new WallNotesWindow(game.world, rejectingGateway(), events).execute(
    game.boardConfig,
    new GameActionRequestFactory(game.world, events, 1),
    {
      getAction: (request) =>
        trace.decide(request, {
          getAction: async () => structuredClone(candidates?.get(request.actorId) ?? validNote),
        }),
    },
    1,
    () => true,
    () => createRandom("wall-optional-rejected-order"),
  );
  return { game, events, decisions: trace.build().decisions };
}

test("optional Wall gateway rejection settles the candidate after its rejection fact without payment", async () => {
  const first = await rejectedWindow();
  assertUnpaidNotes(first.game, first.events, true);
  expect(first.decisions.map((decision) => decision.outcome)).toEqual(
    ids.map(() => ({ kind: "action", action: validNote })),
  );
  const candidates = new Map<number, ToolCall | null>();
  for (const decision of first.decisions) {
    expect(decision.outcome.kind).toBe("action");
    if (decision.outcome.kind !== "action") throw new Error("literal processed candidate missing");
    candidates.set(decision.actorId, decision.outcome.action);
  }
  // 同一显式 validator 输入下重放候选；这不是默认 replayReproduction 的全局规则兼容承诺。
  const replayed = await rejectedWindow(candidates);
  assertUnpaidNotes(replayed.game, replayed.events, true);
  expect(replayed.events.map(({ type, payload }) => ({ type, payload }))).toEqual(
    first.events.map(({ type, payload }) => ({ type, payload })),
  );
});
