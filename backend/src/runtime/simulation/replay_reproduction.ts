/**
 * 负责严格 Tape 的原生 replay 装配、请求匹配与结算调度；输入为已记录归档和实际输出目录。
 * 输出为原生执行的事件／操作／checkpoint 与精确差异；真实 source、lock 和 RNG 身份必须先匹配。
 * 记录请求规范化由轨迹模块提供；本执行器保留自己的消费、等待、游标与清理，不创建兼容来源或改写原归档。
 */
import { unwrapRecordingEnvelope } from "@ai-werewolf-arena/replay-contract";
import { reproductionIdentitiesMatch } from "../../recording/archive_identity";
import { initialPlayerIdentity } from "../../domain/initial-roster";
import { initialIdentityDeal } from "../../game/mechanisms/roles/initial_identity/deal";
import type { Locale } from "@ai-werewolf-arena/game-contract";
import { readFile } from "node:fs/promises";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../app/bootstrap";
import {
  createRandom,
  RANDOM_ALGORITHM,
  RANDOM_STREAM_POLICY,
  type ActionProvider,
  type ActionRequest,
  type GameEvent,
} from "../../domain";
import { parseReproductionRecord, recordedErrorName, type RecordedDecision, type RecordedGameEvent, type ReproductionRecord } from "../../recording/reproduction";
import { normalizedRequest } from "../../recording/reproduction-trace";
import { SessionRecordManager } from "../../recording/session_recorder";
import { runWithSessionRecorder } from "../../recording/recording_context";
import { GameEventRecorder } from "../game_event_recorder";
import { captureCheckpoint, currentEngineVersion } from "./reproduction_context";

function stableJson(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, value]) => [key, sort(value)]),
      );
    return item;
  };
  return JSON.stringify(sort(value));
}

export class ReproductionMismatchError extends Error {}
function requireMatch(condition: boolean, code: string): asserts condition {
  if (!condition) throw new ReproductionMismatchError(code);
}

function decisionKey(decision: Pick<RecordedDecision, "actorId" | "day" | "stage" | "turn">) {
  return `${decision.actorId}/${decision.day}/${decision.stage}/${decision.turn}`;
}

class RecordedActions implements ActionProvider {
  private readonly decisions = new Map<string, RecordedDecision>();
  private readonly turns = new Map<string, number>();
  private readonly consumed = new Set<string>();
  private readonly openings = new Map<number, Set<string>>();
  private nextSettlement = 1;
  private eventCursor?: () => number;
  setEventCursor(cursor: () => number): void {
    if (this.eventCursor) throw Error("reproduction_provider_cursor_already_bound");
    this.eventCursor = cursor;
  }
  get cursors() {
    return { settlementCount: this.nextSettlement - 1, decisionCount: this.consumed.size };
  }
  private settlementScheduled = false;
  private deadlockTimer?: ReturnType<typeof setTimeout>;
  private readonly total: number;
  private readonly settlementWaiters: Array<{
    resolve: () => void;
    reject: (error: unknown) => void;
  }> = [];
  private readonly pending = new Map<
    number,
    {
      decision: RecordedDecision;
      resolve: (action: import("../../domain").ToolCall | null) => void;
      reject: (error: unknown) => void;
    }
  >();
  constructor(record: ReproductionRecord) {
    this.total = record.decisions.length;
    const orders = record.decisions
      .map((decision) => decision.settleOrder)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    requireMatch(
      orders.every((order, index) => order === index + 1) &&
        record.decisions.every(
          (decision) => decision.openedAfterSettlement < decision.settleOrder!,
        ),
      "reproduction_settlement_order_invalid",
    );
    for (const decision of record.decisions) {
      const key = decisionKey(decision);
      requireMatch(
        !this.decisions.has(key) &&
          decision.request.actorId === decision.actorId &&
          decision.request.context.day === decision.day &&
          decision.request.context.stage === decision.stage,
        "reproduction_decision_invalid",
      );
      this.decisions.set(key, decision);
      if (!this.openings.has(decision.openedAfterSettlement))
        this.openings.set(decision.openedAfterSettlement, new Set());
      this.openings.get(decision.openedAfterSettlement)!.add(key);
    }
  }

  getAction(request: ActionRequest): Promise<import("../../domain").ToolCall | null> {
    const base = `${request.actorId}/${request.context.day}/${request.context.stage}`;
    const turn = (this.turns.get(base) ?? 0) + 1;
    this.turns.set(base, turn);
    const key = `${base}/${turn}`;
    const decision = this.decisions.get(key);
    requireMatch(Boolean(decision), "reproduction_unexpected_request");
    requireMatch(
      stableJson(normalizedRequest(request)) === stableJson(decision!.request),
      "reproduction_observation_mismatch",
    );
    requireMatch(
      decision!.openedAfterSettlement === this.nextSettlement - 1,
      "reproduction_opening_boundary_mismatch",
    );
    if (decision!.openedAtEventCount !== undefined)
      requireMatch(
        this.eventCursor?.() === decision!.openedAtEventCount,
        "reproduction_request_event_boundary_mismatch",
      );
    this.consumed.add(key);
    return new Promise((resolve, reject) => {
      this.pending.set(decision!.settleOrder!, { decision: decision!, resolve, reject });
      this.scheduleSettlement();
    });
  }

  private scheduleSettlement() {
    if (this.settlementScheduled) return;
    this.settlementScheduled = true;
    queueMicrotask(() => {
      this.settlementScheduled = false;
      while (this.pending.has(this.nextSettlement) && this.boundaryOpened()) {
        const { decision, resolve, reject } = this.pending.get(this.nextSettlement)!;
        this.pending.delete(this.nextSettlement++);
        if (decision.outcome.kind === "error") {
          const error = new Error("reproduction_recorded_decision_failed");
          error.name = decision.outcome.name;
          reject(error);
        } else if (decision.outcome.kind === "action")
          resolve(structuredClone(decision.outcome.action));
        else reject(new ReproductionMismatchError("reproduction_decision_pending"));
        if (this.nextSettlement > this.total)
          for (const waiter of this.settlementWaiters.splice(0)) waiter.resolve();
      }
      if ((this.pending.size || this.settlementWaiters.length) && !this.deadlockTimer) {
        // 离线引擎只推进本地决定工作；微任务耗尽后仍没有因果上的下一请求，
        // 表示被改动的录制无法继续，按原定时边界检查死锁。
        this.deadlockTimer = setTimeout(() => {
          this.deadlockTimer = undefined;
          if (
            this.nextSettlement <= this.total &&
            (!this.pending.has(this.nextSettlement) || !this.boundaryOpened())
          )
            this.close(new ReproductionMismatchError("reproduction_causal_order_invalid"));
        }, 0);
      }
    });
  }

  private boundaryOpened() {
    return [...(this.openings.get(this.nextSettlement - 1) ?? [])].every((key) =>
      this.consumed.has(key),
    );
  }

  close(error = new ReproductionMismatchError("reproduction_replay_closed")) {
    if (this.deadlockTimer) clearTimeout(this.deadlockTimer);
    this.deadlockTimer = undefined;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    for (const waiter of this.settlementWaiters.splice(0)) waiter.reject(error);
  }

  waitForSettlements(): Promise<void> {
    if (this.nextSettlement > this.total) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.settlementWaiters.push({ resolve, reject });
      this.scheduleSettlement();
    });
  }

  assertConsumed() {
    requireMatch(this.consumed.size === this.decisions.size, "reproduction_unconsumed_decisions");
  }
}

function normalizedEvents(events: readonly (GameEvent | RecordedGameEvent)[]) {
  return events.map(({ timestamp: _timestamp, ...event }) => event);
}

/** 文件入口同时保留真实声明和原 payload；CLI 不在读文件后丢弃 header 再执行。 */
export async function readReproductionArchive(file: string) {
  const raw = await readFile(file, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("reproduction_json_invalid");
  }
  const archive = unwrapRecordingEnvelope(value, "strict_reproduction");
  return { record: parseReproductionRecord(archive.payload), identities: archive.identities, input: value };
}

/** 旧数据消费 API 只返回 canonical Tape；执行文件需使用 readReproductionArchive 保留声明。 */
export async function readReproduction(file: string): Promise<ReproductionRecord> {
  return (await readReproductionArchive(file)).record;
}

/** 按真实引擎复现记录行动；不加载模型传输或认证，显式身份不能放宽精确构建检查。 */
export async function replayReproduction(
  input: unknown,
  recordRoot: string,
  displayLocale?: Locale,
) {
  const archive = unwrapRecordingEnvelope(input, "strict_reproduction");
  const record = parseReproductionRecord(archive.payload);
  requireMatch(
    record.finalized &&
      record.termination !== null &&
      record.decisions.every((item) => item.outcome.kind !== "pending"),
    "reproduction_not_finalized",
  );
  const version = await currentEngineVersion();
  requireMatch(
    record.metadata.engine.sourceHash === version.sourceHash &&
      record.metadata.engine.lockHash === version.lockHash,
    "reproduction_engine_or_lock_incompatible",
  );
  requireMatch(
    record.metadata.random.algorithm === RANDOM_ALGORITHM &&
      record.metadata.random.streamPolicy === RANDOM_STREAM_POLICY &&
      record.metadata.random.path.every((name) => name.trim().length > 0),
    "reproduction_rng_incompatible",
  );
  requireMatch(
    record.metadata.ruleset.id === RULESET.id &&
      record.metadata.ruleset.version === RULESET.version,
    "reproduction_ruleset_incompatible",
  );
  // 语义声明在原精确来源／RNG／规则检查之后验证；不能用手写版本打开旧构建。
  requireMatch(reproductionIdentitiesMatch(archive.identities, record), "reproduction_contract_identity_incompatible");
  // 内层 Tape 已通过原严格板子 schema；不要再次用更窄的公开配置重建，
  // 否则会丢失历史可选字段并更改默认值。
  const board = record.metadata.normalizedBoard;
  requireMatch(
    record.metadata.players.length === board.boardSize &&
      record.metadata.players.every((player, index) => player.id === index + 1),
    "reproduction_players_invalid",
  );
  requireMatch(
    record.checkpoints.every(
      (checkpoint, index) =>
        checkpoint.cycle === index &&
        (checkpoint.complete || index === record.checkpoints.length - 1) &&
        Boolean(checkpoint.failure) === !checkpoint.complete &&
        checkpoint.eventCount <= record.events.length,
    ),
    "reproduction_checkpoints_invalid",
  );
  requireMatch(
    record.checkpoints[0].complete &&
      record.checkpoints.at(-1)!.eventCount === record.events.length,
    "reproduction_event_count_invalid",
  );
  const finalResult = record.checkpoints.at(-1)!.snapshot.result;
  const finalCheckpoint = record.checkpoints.at(-1)!;
  requireMatch(
    finalCheckpoint.snapshot.gameOver === (finalResult !== null),
    "reproduction_termination_invalid",
  );
  const recordedErrors = record.termination!.errors;
  const cycleErrors = recordedErrors.filter((error) => error.scope === "cycle");
  const reason = record.termination!.reason;
  requireMatch(
    record.termination!.winner === (finalResult?.winner ?? null) &&
      (reason === "runtime_error"
        ? recordedErrors.length > 0
        : finalResult
          ? reason === finalResult.reason
          : reason === "runtime_timeout" && finalCheckpoint.complete) &&
      (finalCheckpoint.complete
        ? cycleErrors.length === 0
        : reason === "runtime_error" &&
          cycleErrors.length === 1 &&
          cycleErrors[0].name === finalCheckpoint.failure!.name),
    "reproduction_termination_invalid",
  );
  const provider = new RecordedActions(record);
  let random = createRandom(record.metadata.random.seed);
  for (const name of record.metadata.random.path) random = random.fork(name);
  const context = bootstrapGame(board, {
    random,
    locale: record.metadata.locale,
    ...(record.metadata.faultPlan ? { faultPlan: record.metadata.faultPlan } : {}),
    ...(record.metadata.dealMode === "fixed"
      ? {
          fixedRoles:
            record.metadata.initialDeal ?? record.metadata.players.map((player) => player.role),
        }
      : {}),
    playerNames: Object.fromEntries(
      record.metadata.players.map((player) => [String(player.id), player.name]),
    ),
  });
  requireMatch(
    stableJson(initialIdentityDeal(context.world) ?? null) ===
      stableJson(record.metadata.initialDeal ?? null),
    "reproduction_initial_deal_mismatch",
  );
  if (board.animalDream || board.nobleSecretBody || board.fragrantPairSeer)
    provider.setEventCursor(() => context.phaseManager.getEvents().length);
  const initial = captureCheckpoint(
    context.world,
    context.phaseManager.getSnapshot(),
    0,
    true,
    context.phaseManager.getEvents().length,
  );
  requireMatch(
    stableJson(initial) === stableJson(record.checkpoints[0]),
    "reproduction_initial_state_mismatch",
  );
  requireMatch(
    stableJson(
      initial.players.map((player) => ({
        id: player.id,
        role: player.role,
        camp: player.camp,
        name: player.name,
      })),
    ) === stableJson(record.metadata.players.map(({ agent: _agent, ...player }) => player)),
    "reproduction_identity_mismatch",
  );
  const manager = await SessionRecordManager.create(
    {
      sessionId: `reproduction-${crypto.randomUUID()}`,
      board: record.metadata.boardId,
      locale: context.world.locale,
      startedAtIso: new Date().toISOString(),
      random: context.random.metadata,
    },
    recordRoot,
    displayLocale ?? record.metadata.locale,
  );
  if (board.animalDream || board.nobleSecretBody || board.fragrantPairSeer)
    manager.setReplayEventCursor(() => context.phaseManager.getEvents().length);
  const recorder = new GameEventRecorder(
    { world: context.world, replayManager: manager },
    context.phaseManager.getSnapshot().phase,
  );
  let summary: Awaited<ReturnType<SessionRecordManager["finalize"]>> | undefined;
  await runWithSessionRecorder(manager, async () => {
    const failures: unknown[] = [];
    try {
      for (const checkpoint of record.checkpoints.slice(1)) {
        let complete = false;
        let cycleFailure: unknown;
        try {
          await context.phaseManager.runSingleCycle(provider, record.metadata.maxDays);
          // 周期成功也须核对原角色名册与合法库存，再标记 complete；不跳过成功路径的 checkpoint 校验。
          captureCheckpoint(
            context.world,
            context.phaseManager.getSnapshot(),
            checkpoint.cycle,
            true,
            context.phaseManager.getEvents().length,
          );
          complete = true;
        } catch (error) {
          if (error instanceof ReproductionMismatchError || checkpoint.complete) throw error;
          cycleFailure = error;
          requireMatch(
            checkpoint.failure!.name === recordedErrorName(error),
            "reproduction_failure_mismatch",
          );
        }
        const actual = captureCheckpoint(
          context.world,
          context.phaseManager.getSnapshot(),
          checkpoint.cycle,
          complete,
          context.phaseManager.getEvents().length,
          cycleFailure,
          provider.cursors,
        );
        requireMatch(
          stableJson(actual) === stableJson(checkpoint),
          "reproduction_checkpoint_mismatch",
        );
        recorder.flush(context.phaseManager.getEvents());
      }
      await provider.waitForSettlements();
      provider.assertConsumed();
      if (record.checkpoints.at(-1)!.complete) context.phaseManager.assertFaultPlanConsumed();
      requireMatch(
        stableJson(normalizedEvents(context.phaseManager.getEvents())) ===
          stableJson(normalizedEvents(record.events)),
        "reproduction_events_mismatch",
      );
    } catch (error) {
      failures.push(error);
    } finally {
      provider.close();
      try {
        recorder.flush(context.phaseManager.getEvents());
      } catch (error) {
        failures.push(error);
      }
      try {
        summary = await manager.finalize({
          endedAtIso: new Date().toISOString(),
          winner: context.phaseManager.getSnapshot().result?.winner ?? null,
          ...(context.phaseManager.getSnapshot().result
            ? { gameResult: context.phaseManager.getSnapshot().result! }
            : {}),
          finishReason: failures.length ? "runtime_error" : record.termination!.reason,
          players: captureCheckpoint(
            context.world,
            context.phaseManager.getSnapshot(),
            0,
            record.checkpoints.at(-1)!.complete,
            0,
          ).players.map((player, index) => ({
            player_id: player.id,
            name: player.name,
            role:
              initialPlayerIdentity(context.world, player.id)?.role ??
              initialIdentityDeal(context.world)?.[index] ??
              player.role,
            camp:
              initialPlayerIdentity(context.world, player.id)?.camp ??
              (initialIdentityDeal(context.world)
                ? record.metadata.players[index]!.camp
                : player.camp),
            alive: player.alive,
          })),
        });
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, "reproduction_replay_failed");
  });
  // 并行预检完成可能重排操作；仍比较完整领域操作多重集，不丢失重复项或字段。
  const actualOps = (summary!.logicOps ?? [])
    .filter((op) => op.scope !== "llm_action_provider")
    .map(({ seq: _seq, timestamp: _timestamp, ...op }) => stableJson(op))
    .sort();
  const recordedOps = record.operations.map((op) => stableJson(op)).sort();
  requireMatch(
    stableJson(actualOps) === stableJson(recordedOps),
    "reproduction_operations_mismatch",
  );
  return {
    seed: record.metadata.random.seed,
    snapshot: context.phaseManager.getSnapshot(),
    sourceTermination: record.termination,
    eventCount: context.phaseManager.getEvents().length,
    decisionCount: record.decisions.length,
    recordDir: manager.sessionDir,
  };
}
