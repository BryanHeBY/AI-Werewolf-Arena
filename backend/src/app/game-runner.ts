/**
 * 负责装配一局游戏、收缩绝对期限、关闭运行资源并汇总失败。
 * 输入为已解析的对局设置与本次执行依赖；输出为记录结果和可选审计摘要。
 * 请求别名与原体权限仍由机制所有者校验；本模块保留停止、关闭、等待与落盘的顺序，
 * 后续失败不回滚已提交的动作，也不把可选摘要失败升级为对局失败。
 * Agent 与复现记录共用本局板子来源；maxDays 在原元数据读取处捕获，循环复用该值。
 */
import { deriveBoundedRequest, isRequestDeliveryExpired } from "../domain/request-delivery";
import { animalOriginalAuditIds, animalOriginalAuditPlayer } from "../features/animal-dream/roster";
import { aliveLifeDescriptor } from "../domain/components/alive";
import { initialPlayerIdentity } from "../domain/initial-roster";
import { publicPlayerRoster } from "../domain/public-player-roster";
import { initialIdentityDeal } from "../features/initial-identity/deal";
import { text } from "@ai-werewolf-arena/game-text";
import { formatErrorDiagnostic } from "../utils/error-diagnostic";
/** 本局资源、期限、失败汇总与最终复盘由下方 runner 持有；导入不装配对局。 */
import path from "node:path";
import { bootstrapGame } from "./bootstrap";
import {
  COMPONENT,
  type ActionProvider,
  type ActionRequest,
  type AliveComponent,
  type RoleComponent,
  type RuntimeSnapshot,
  type ToolCall,
  type World,
  type IdentityComponent,
  createRandom,
} from "../domain";
import type { ResolvedAgentRuntimeProfile } from "./config/contracts";
import type { ResolvedGameSetup } from "./config/resolve-game-setup";
import { resolvePlayerProfile } from "./config/resolve-game-setup";
import {
  createConsoleLog,
  presentGameResult,
  presentStreamEvents,
} from "../adapters/console/console-presenter";
import { createAgentConsoleSink } from "../adapters/console/agent-console-presenter";
import { GameEventRecorder } from "./game-event-recorder";
import {
  buildSessionId,
  resolveDefaultRecordRoot,
  SessionRecordManager,
} from "../recording/session/recorder";
import { runWithSessionRecorder } from "../recording/session/context";
import { buildDebugSummaryMarkdown } from "../audit/debug-summary-generator";
import { createPlayerAgentRuntime, type PlayerAgentRuntime } from "./player-agent-factory";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "./simulation/reproduction-context";

/** 仅返回最终运行快照与领域事件总数；完整回放由会话记录器持久化。 */
export interface GameRunResult {
  snapshot: RuntimeSnapshot;
  eventCount: number;
}
/**
 * 每局独立的执行依赖，不进入玩家 DTO 或 JSON 配置。
 * 期限选择回调返回绝对时间，只参与取最小值；关闭观察回调接收脱离副本，异常归清理失败。
 */
export interface GameRunDependencies {
  /** 可信 controller 的显式离线故障数据；进入原 metadata.faultPlan，同一 owner 在录制和重放消费，不是模型／JSON 配置。 */
  faultPlan?: unknown;
  selectRequestDeadline?: (
    request: Readonly<{
      actorId: number;
      day: number;
      stage: ActionRequest["context"]["stage"];
      ordinal: number;
      actorOrdinal: number;
      retryAttempt: number;
      nowMs: number;
    }>,
  ) => number | undefined;
  onRuntimeClosed?: (state: PlayerAgentRuntime["runtimeState"]) => void;
}

class DeadlineAwareActionProvider implements ActionProvider {
  private ordinal = 0;
  private readonly actors = new Map<number, number>();
  // 同一玩家／日期／stage 的重试沿用已记录预算；新尝试仍受全局与原请求期限限制。
  private readonly budgets = new Map<string, number>();
  constructor(
    private readonly delegate: ActionProvider,
    private readonly deadlineAtMs: number,
    private readonly timeoutMs: number,
    private readonly selectDeadline?: GameRunDependencies["selectRequestDeadline"],
  ) {}

  getAction(request: ActionRequest): Promise<ToolCall | null> {
    const nowMs = Date.now(),
      actorOrdinal = (this.actors.get(request.actorId) ?? 0) + 1;
    this.actors.set(request.actorId, actorOrdinal);
    const ordinal = ++this.ordinal;
    const retryAttempt = request.context.retry_attempt ?? 0;
    const selected = this.selectDeadline?.({
      actorId: request.actorId,
      day: request.context.day,
      stage: request.context.stage,
      ordinal,
      actorOrdinal,
      retryAttempt,
      nowMs,
    });
    if (selected !== undefined && !Number.isFinite(selected))
      throw new RangeError("game_request_deadline_invalid");
    const key = `${request.actorId}/${request.context.day}/${request.context.stage}`;
    // 期限只取最早绝对时间，重试不重置整份超时；运行时授权随原请求一起派生。
    const deadline = Math.min(
      this.deadlineAtMs,
      request.deadlineAtMs ?? Infinity,
      nowMs + this.timeoutMs,
      selected ?? Infinity,
      retryAttempt > 0 ? (this.budgets.get(key) ?? Infinity) : Infinity,
    );
    this.budgets.set(key, deadline);
    const timed = deriveBoundedRequest(request, deadline);
    return this.delegate.getAction(timed);
  }
}

/** 调用方先完成设置解析；这里装配并执行对局，不读取配置来源文件。 */
export async function runGame(
  setup: ResolvedGameSetup,
  dependencies: GameRunDependencies = {},
): Promise<GameRunResult> {
  const context = bootstrapGame(setup.boardConfig, {
    random: createRandom(setup.context.seed),
    locale: setup.context.locale,
    playerNames: Object.fromEntries(
      Object.entries(setup.players).flatMap(([seat, entry]) =>
        entry.name !== undefined ? [[seat, entry.name]] : [],
      ),
    ),
    ...(dependencies.faultPlan !== undefined ? { faultPlan: dependencies.faultPlan } : {}),
  });
  const profilesByActor = selectPlayerProfiles(context.world, setup);
  const players = publicPlayerRoster(context.world);
  const sessionId = buildSessionId();
  const recordRoot = setup.options.recordRootDir ?? resolveDefaultRecordRoot();
  const replayManager = await SessionRecordManager.create(
    {
      players,
      sessionId,
      locale: setup.context.locale,
      board: setup.options.board,
      startedAtIso: new Date().toISOString(),
      random: context.random.metadata,
    },
    recordRoot,
    setup.context.displayLocale,
  );

  return runWithSessionRecorder(replayManager, async () => {
    const { options } = setup;
    const log = createConsoleLog(options.color);
    const startedAt = Date.now();
    const deadlineAtMs = startedAt + options.maxRuntimeMs;
    // 对局／记录失败统一汇总；并发动作和关闭失败暂存，收尾时按原顺序补入。
    const failures: unknown[] = [];
    const eventRecorder = new GameEventRecorder(
      {
        world: context.world,
        replayManager,
      },
      context.phaseManager.getSnapshot().phase,
    );
    const flushEvents = () => {
      const delta = eventRecorder.flush(context.phaseManager.getEvents());
      if (options.streamEvents)
        presentStreamEvents(
          delta,
          options.printPrivateEvents,
          log,
          setup.context.displayLocale,
          players,
        );
    };
    let agentRuntime: PlayerAgentRuntime | undefined;
    let heartbeat: NodeJS.Timeout | undefined;
    let streamTimer: NodeJS.Timeout | undefined;
    let timedOut = false;
    // stopping 立即拒绝新动作和迟到回复；closing 合并关闭调用，inFlight 单独负责等待结算。
    let stopping = false;
    let closing: Promise<void> | undefined;
    const stopReason = new DOMException("game_actions_stopped", "AbortError");
    const inFlight = new Set<Promise<ToolCall | null>>();
    const actionFailures: unknown[] = [];
    const cleanupFailures: unknown[] = [];
    let maxDays: number;
    // 先撤运行入口，再异步关闭 Agent；关闭异常暂存，不能覆盖触发停止的原始失败。
    const closeRuntime = (): Promise<void> => {
      stopping = true;
      closing ??= Promise.resolve()
        .then(() => agentRuntime?.close())
        .catch((error) => {
          cleanupFailures.push(error);
        });
      return closing;
    };
    const drainActions = async () => {
      while (inFlight.size) await Promise.allSettled([...inFlight]);
    };

    try {
      const reproduction = beginGameReproduction(replayManager, context, {
        engine: await currentEngineVersion(),
        boardId: options.board,
        locale: context.world.locale,
        maxDays: (maxDays = options.maxDays),
        profiles: profilesByActor,
      });
      agentRuntime = await createPlayerAgentRuntime({
        world: context.world,
        boardConfig: context.boardConfig,
        profilesByActor,
        acpWorkspaceRoot: path.join(recordRoot, sessionId, "acp-workspaces"),
        llmTimeoutMs: options.llmTimeoutMs,
        trace: options.trace,
        displayLocale: setup.context.displayLocale,
        colorizeLogs: options.color,
        printLlmIo: options.printLlmIo,
        printThinking: options.printThinking,
        outputSink: createAgentConsoleSink({
          players,
          log,
          locale: setup.context.displayLocale,
          trace: options.trace,
          printThinking: options.printThinking,
          printLlmIo: options.printLlmIo,
        }),
      });
      const selectedProvider: ActionProvider = {
        async getAction(request) {
          if (stopping) throw stopReason;
          const action = await agentRuntime!.provider.getAction(request);
          if (stopping) throw stopReason;
          return action;
        },
      };
      const decisionProvider: ActionProvider = {
        getAction: (request) => {
          const decision = reproduction.decide(request, selectedProvider);
          let tracked!: Promise<ToolCall | null>;
          tracked = decision.then(
            (action) => {
              inFlight.delete(tracked);
              return action;
            },
            (error) => {
              inFlight.delete(tracked);
              // 机制明确允许期满收口的请求仍交回原窗口关闭；不提前停掉整局和其它 Agent。
              if (isRequestDeliveryExpired(error, request) && error.recoverable) throw error;
              if (error !== stopReason) actionFailures.push(error);
              // 保留记录器已写的决策前缀，再开始取消其它动作，保留原异常的因果先后。
              void closeRuntime();
              throw error;
            },
          );
          inFlight.add(tracked);
          return tracked;
        },
      };
      const provider = new DeadlineAwareActionProvider(
        decisionProvider,
        deadlineAtMs,
        options.llmTimeoutMs,
        dependencies.selectRequestDeadline,
      );
      log(
        `[run_game] start board=${options.board} replay_session_id=${sessionId} record_dir=${replayManager.sessionDir} · ${text(setup.context.displayLocale, "runtime.start")}`,
        "info",
      );

      if (options.trace) {
        heartbeat = setInterval(() => {
          const snapshot = context.phaseManager.getSnapshot();
          log(
            `[run_game] heartbeat day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt} · ${text(setup.context.displayLocale, "runtime.heartbeat")}`,
            "muted",
          );
        }, 5000);
      }
      streamTimer = setInterval(() => {
        try {
          flushEvents();
        } catch (error) {
          failures.push(error);
          replayManager.noteReproductionFailure("recording", error);
          void closeRuntime();
          if (streamTimer) clearInterval(streamTimer);
        }
      }, 1000);

      let cycle = 0;
      while (!context.phaseManager.getSnapshot().gameOver && failures.length === 0) {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= options.maxRuntimeMs) {
          timedOut = true;
          log(
            `[run_game] runtime_timeout elapsed_ms=${elapsed} · ${text(setup.context.displayLocale, "runtime.timeout")}`,
            "warn",
          );
          break;
        }
        cycle++;
        let complete = false;
        let cycleFailure: unknown;
        try {
          await context.phaseManager.runSingleCycle(provider, maxDays);
          complete = true;
        } catch (error) {
          cycleFailure = error;
          if (error !== stopReason) failures.push(error);
          replayManager.noteReproductionFailure("cycle", error);
          await closeRuntime();
          await drainActions();
        }
        // 无论周期成功或失败都保存实际结算前缀；失败周期先关闭并等待已在途动作。
        try {
          reproduction.checkpoint(
            captureCheckpoint(
              context.world,
              context.phaseManager.getSnapshot(),
              cycle,
              complete,
              context.phaseManager.getEvents().length,
              cycleFailure,
            ),
            context.phaseManager.getEvents(),
          );
        } catch (error) {
          failures.push(error);
          reproduction.invalidate();
          replayManager.noteReproductionFailure("recording", error);
        }
        if (failures.length) break;
        const snapshot = context.phaseManager.getSnapshot();
        log(
          `[run_game] cycle day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt} · ${text(setup.context.displayLocale, "runtime.cycle")}`,
          "info",
        );
      }
    } catch (error) {
      failures.push(error);
      replayManager.noteReproductionFailure("initialization", error);
    } finally {
      // 先停定时任务并补事件，再关闭／等待动作；最终记录只在这些原收尾步骤之后发布。
      if (heartbeat) clearInterval(heartbeat);
      if (streamTimer) clearInterval(streamTimer);
      try {
        flushEvents();
      } catch (error) {
        failures.push(error);
        replayManager.noteReproductionFailure("recording", error);
      }
      await closeRuntime();
      await drainActions();
      if (agentRuntime && dependencies.onRuntimeClosed) {
        try {
          dependencies.onRuntimeClosed(structuredClone(agentRuntime.runtimeState));
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
      // 取消标记不列为独立动作错误；原异常按引用去重，清理失败仍按发生顺序追加。
      for (const error of actionFailures)
        if (!failures.includes(error)) {
          failures.push(error);
          replayManager.noteReproductionFailure("controller", error);
        }
      for (const error of cleanupFailures) {
        failures.push(error);
        replayManager.noteReproductionFailure("cleanup", error);
      }
      try {
        const snapshot = context.phaseManager.getSnapshot();
        const summaryInput = await replayManager.finalize({
          endedAtIso: new Date().toISOString(),
          winner: snapshot.result?.winner ?? null,
          ...(snapshot.result ? { gameResult: snapshot.result } : {}),
          finishReason: failures.length
            ? "runtime_error"
            : (snapshot.result?.reason ?? (timedOut ? "runtime_timeout" : "completed")),
          players: replayPlayers(context.world),
        });
        // 核心终档失败进入汇总；诊断摘要为可选输出，其异常只写日志。
        try {
          await replayManager.writeDebugSummary(
            await buildDebugSummaryMarkdown(
              {
                ...summaryInput,
                locale: setup.context.locale,
                displayLocale: setup.context.displayLocale,
              },
              setup.audit,
            ),
          );
        } catch (error) {
          log(
            `[audit] debug_summary_failed err=${formatErrorDiagnostic(error, setup.context.displayLocale)}`,
            "warn",
          );
        }
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "game_run_failed");
    const snapshot = context.phaseManager.getSnapshot();
    const events = context.phaseManager.getEvents();
    presentGameResult({
      players,
      locale: setup.context.displayLocale,
      board: options.board,
      snapshot,
      events,
      timedOut,
      printAllEvents: options.printAllEvents,
      printChat: options.printChat,
      streamEvents: options.streamEvents,
      log,
    });
    return { snapshot, eventCount: events.length };
  });
}

function selectPlayerProfiles(
  world: World,
  setup: ResolvedGameSetup,
): Map<number, ResolvedAgentRuntimeProfile> {
  const profiles = new Map<number, ResolvedAgentRuntimeProfile>();
  for (const id of world.entityIds()) {
    const role = world.getComponent(id, COMPONENT.Role)?.role;
    profiles.set(id, resolvePlayerProfile(setup, id, role));
  }
  return profiles;
}

/**
 * 构造 God 终档的身份记录，不复用玩家观察视图。
 * 动物梦境读取已捕获的原名单／身份与原生命；初始身份机制保留原发牌，普通局使用当前组件。
 */
function replayPlayers(world: World) {
  const originalIds = animalOriginalAuditIds(world);
  if (originalIds)
    return originalIds.map((id) => {
      const original = animalOriginalAuditPlayer(world, id)!,
        identity = JSON.parse(original.identityJson);
      return {
        player_id: id,
        role: original.scope.roleId,
        camp: original.scope.campValue,
        alive: aliveLifeDescriptor(original.scope.life)!.get!.call(original.scope.life),
        ...(identity.name !== undefined ? { name: identity.name } : {}),
      };
    });
  // 原名单／开局牌组是历史数据；仅普通fallback在原字段位置查询当前Camp。
  const initial = initialIdentityDeal(world);
  return world.entityIds().map((id, index) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return {
      player_id: id,
      role: initialPlayerIdentity(world, id)?.role ?? initial?.[index] ?? role?.role ?? "unknown",
      camp:
        initialPlayerIdentity(world, id)?.camp ??
        (initial
          ? initial[index] === "wolf"
            ? "wolf"
            : "good"
          : ((role && world.getComponent(id, COMPONENT.Camp)?.camp) ?? "unknown")),
      alive: world.getComponent(id, COMPONENT.Alive)?.alive === true,
      name: world.getComponent(id, COMPONENT.Identity)?.name,
    };
  });
}
