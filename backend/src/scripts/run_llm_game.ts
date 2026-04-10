
/**
 * 真实 LLM 对局运行脚本：用于本地回放与可观测调试。
 */
import { bootstrapGame } from "../app/bootstrap";
import { appConfig } from "../config";
import { AliveComponent } from "../domain/components/alive";
import {
  ActionProvider,
  ActionRequest,
  GameEvent,
  RuntimeSnapshot,
  ToolCall,
} from "../domain/model";
import { OpenAIClient } from "../infra/llm/openai_client";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { buildAgentBroadcastFeed } from "../engine/agent_broadcast_feed";
import { getDefaultScriptEventRenderRegistry } from "../mechanisms";
import { sixPlayerMvpConfig } from "../scenarios/six_player_mvp";
import {
  buildSessionId,
  resolveDefaultRecordRoot,
  SessionRecordHub,
  SessionRecordManager,
} from "../session_recording";
import { twelvePlayerStandardConfig } from "../scenarios/twelve_player_standard";
import { colorize, isAnsiEnabled } from "../utils/ansi";
import { BaselineBotActionProvider } from "../agents/providers/action_providers";
import { LlmActionProvider } from "../agents/llm/llm_action_provider";

/**
 * 支持的对局板子名称。
 */
export type LlmBoard = "six_player_mvp" | "twelve_player_standard";

/**
 * 对局运行参数。
 */
export interface RunLlmGameOptions {
  board: LlmBoard;
  maxDays: number;
  trace: boolean;
  maxRuntimeMs: number;
  llmTimeoutMs: number;
  printAllEvents: boolean;
  printChat: boolean;
  streamEvents: boolean;
  color: boolean;
  printLlmIo: boolean;
  printThinking: boolean;
  printPrivateEvents: boolean;
  recordRootDir?: string;
}

function parseArgs(argv: string[]): Partial<RunLlmGameOptions> {
  const out: Partial<RunLlmGameOptions> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--board" && argv[i + 1]) {
      out.board = argv[i + 1] as LlmBoard;
      i += 1;
      continue;
    }
    if (token === "--max-days" && argv[i + 1]) {
      out.maxDays = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--trace" && argv[i + 1]) {
      out.trace = ["1", "true", "yes", "on"].includes(argv[i + 1].toLowerCase());
      i += 1;
      continue;
    }
    if (token === "--max-runtime-ms" && argv[i + 1]) {
      out.maxRuntimeMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--llm-timeout-ms" && argv[i + 1]) {
      out.llmTimeoutMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--print-all-events" && argv[i + 1]) {
      out.printAllEvents = ["1", "true", "yes", "on"].includes(
        argv[i + 1].toLowerCase(),
      );
      i += 1;
      continue;
    }
    if (token === "--print-chat" && argv[i + 1]) {
      out.printChat = ["1", "true", "yes", "on"].includes(
        argv[i + 1].toLowerCase(),
      );
      i += 1;
      continue;
    }
    if (token === "--stream-events" && argv[i + 1]) {
      out.streamEvents = ["1", "true", "yes", "on"].includes(
        argv[i + 1].toLowerCase(),
      );
      i += 1;
      continue;
    }
    if (token === "--color" && argv[i + 1]) {
      out.color = ["1", "true", "yes", "on"].includes(argv[i + 1].toLowerCase());
      i += 1;
      continue;
    }
    if (token === "--print-llm-io" && argv[i + 1]) {
      out.printLlmIo = ["1", "true", "yes", "on"].includes(
        argv[i + 1].toLowerCase(),
      );
      i += 1;
      continue;
    }
    if (token === "--print-thinking" && argv[i + 1]) {
      out.printThinking = ["1", "true", "yes", "on"].includes(
        argv[i + 1].toLowerCase(),
      );
      i += 1;
      continue;
    }
    if (token === "--print-private-events" && argv[i + 1]) {
      out.printPrivateEvents = ["1", "true", "yes", "on"].includes(
        argv[i + 1].toLowerCase(),
      );
      i += 1;
      continue;
    }
    if (token === "--record-root-dir" && argv[i + 1]) {
      out.recordRootDir = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function pickBoard(board: LlmBoard) {
  return board === "twelve_player_standard"
    ? twelvePlayerStandardConfig
    : sixPlayerMvpConfig;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env: ${name}`);
  }
  return value;
}

function toChatLines(events: Array<{ type: string; payload: Record<string, any> }>): string[] {
  const renderRegistry = getDefaultScriptEventRenderRegistry();
  const lines: string[] = [];
  for (const event of events) {
    const line = renderRegistry.toChatLine(event as GameEvent);
    if (line) {
      lines.push(line);
    }
  }
  return lines;
}

function toJudgeLine(event: { type: string; payload: Record<string, any> }): string | null {
  return getDefaultScriptEventRenderRegistry().toJudgeLine(event as GameEvent);
}

function toReplayRenderText(event: { type: string; payload: Record<string, any> }): string | undefined {
  return getDefaultScriptEventRenderRegistry().toReplayRenderText(event as GameEvent);
}

function toReplayStage(event: { type: string; payload: Record<string, any> }): string {
  return getDefaultScriptEventRenderRegistry().toReplayStage(event as GameEvent);
}

class DeadlineAwareActionProvider implements ActionProvider {
  constructor(
    private readonly delegate: ActionProvider,
    private readonly deadlineAtMs: number,
  ) {}

  /**
   * 为请求附加全局截止时间后转发给真实 provider。
   */
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    return this.delegate.getAction({
      ...request,
      deadlineAtMs: this.deadlineAtMs,
    });
  }
}

/**
 * 运行一局真实 LLM 对局并返回最终快照。
 */
export async function runLlmGame(options: RunLlmGameOptions): Promise<{
  snapshot: RuntimeSnapshot;
  eventCount: number;
}> {
  const colorEnabled = isAnsiEnabled(options.color);
  const log = (text: string, tone: "muted" | "info" | "ok" | "warn" | "error" | "accent" | "god" = "info") =>
    console.log(colorize(text, tone, colorEnabled));

  const openaiBaseUrl = requiredEnv("OPENAI_BASE_URL");
  const openaiApiKey = requiredEnv("OPENAI_API_KEY");
  const openaiModel = requiredEnv("OPENAI_MODEL");
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? "0.2");
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS ?? "512");
  const forceJsonResponse = ["1", "true", "yes", "on"].includes(
    String(process.env.OPENAI_FORCE_JSON ?? "true").toLowerCase(),
  );

  const boardConfig = pickBoard(options.board);
  const context = bootstrapGame(boardConfig);
  const replaySessionId = buildSessionId();
  const replayRecordRoot = options.recordRootDir ?? resolveDefaultRecordRoot();
  let replayManager: SessionRecordManager | null = null;
  try {
    replayManager = await SessionRecordManager.create(
      {
        sessionId: replaySessionId,
        board: options.board,
        startedAtIso: new Date().toISOString(),
      },
      replayRecordRoot,
    );
    SessionRecordHub.setActive(replayManager);
  } catch (error) {
    log(`[session_recording] init_failed err=${String(error)}`, "warn");
    SessionRecordHub.setActive(null);
  }

  const client = new OpenAIClient({
    baseURL: openaiBaseUrl,
    apiKey: openaiApiKey,
    model: openaiModel,
    temperature,
    maxTokens,
    forceJsonResponse,
  });
  const provider = LlmActionProvider.fromOpenAIClient(context.world, client, {
    trace: options.trace,
    fallbackProvider: new BaselineBotActionProvider(context.world),
    maxPromptEvents: 20,
    llmTimeoutMs: options.llmTimeoutMs,
    colorizeLogs: colorEnabled,
    printLlmIo: options.printLlmIo,
    printThinking: options.printThinking,
  });

  log(
    `[run_llm_game] start board=${options.board} maxDays=${options.maxDays} model=${openaiModel} maxRuntimeMs=${options.maxRuntimeMs} llmTimeoutMs=${options.llmTimeoutMs}`,
    "info",
  );
  if (replayManager) {
    log(
      `[run_llm_game] replay_session_id=${replaySessionId} record_dir=${replayManager.sessionDir}`,
      "muted",
    );
  }
  const startedAt = Date.now();
  const deadlineAtMs = startedAt + options.maxRuntimeMs;
  const budgetedProvider = new DeadlineAwareActionProvider(provider, deadlineAtMs);
  let streamedEventIndex = 0;
  const replayPlayerFeedCursor = new Map<number, number>();
  const flushStreamEvents = (): void => {
    const events = context.phaseManager.getEvents();
    if (streamedEventIndex >= events.length) {
      return;
    }
    let replayDay = 1;
    let replayPhase = String(context.phaseManager.getSnapshot().phase);
    const voteBatch: Array<{ actorId: number; targetId: number | null; abstain: boolean; weight: number }> = [];
    const flushVoteBatchLive = () => {
      if (voteBatch.length === 0 || !options.streamEvents) {
        voteBatch.length = 0;
        return;
      }
      const parts = voteBatch.map((item) => {
        if (item.abstain) {
          return item.weight !== 1
            ? `${item.actorId}号->弃票(w=${item.weight})`
            : `${item.actorId}号->弃票`;
        }
        return item.weight !== 1
          ? `${item.actorId}号->${item.targetId}号(w=${item.weight})`
          : `${item.actorId}号->${item.targetId}号`;
      });
      log(`[live][上帝] 放逐票型：${parts.join("，")}`, "god");
      voteBatch.length = 0;
    };
    for (let i = streamedEventIndex; i < events.length; i++) {
      const event = events[i];
      if (event.type === "phase_changed") {
        replayDay = Number(event.payload.day ?? replayDay);
        replayPhase = String(event.payload.phase ?? replayPhase);
      }
      replayManager?.recordPublicEvent({
        type: event.type,
        timestampMs: event.timestamp,
        day: replayDay,
        phase: replayPhase,
        payload: event.payload,
        renderText: toReplayRenderText(event as any),
      });
      if (!options.streamEvents) {
        // 即使不打印 live，也要写入“玩家可见广播”到 session 复盘。
      }
      if (replayManager) {
        for (const playerId of context.world.entityIds()) {
          const feed = buildAgentBroadcastFeed(
            context.world,
            events,
            playerId,
            10000,
          );
          const before = replayPlayerFeedCursor.get(playerId) ?? 0;
          const delta = feed.slice(before);
          const roleComp = context.world.getComponent<RoleComponent>(
            playerId,
            COMPONENT.Role,
          );
          for (let d = 0; d < delta.length; d++) {
            replayManager.recordPlayerBroadcast({
              playerId,
              role: roleComp?.role ?? "unknown",
              camp: roleComp?.camp ?? "unknown",
              day: replayDay,
              phase: replayPhase,
              stage: toReplayStage(event as any),
              requestId: `${replayDay}-${replayPhase}-${playerId}-broadcast-${i}-${d}`,
              text: delta[d],
            });
          }
          replayPlayerFeedCursor.set(playerId, feed.length);
        }
      }
      if (event.type === "vote_cast") {
        voteBatch.push({
          actorId: Number(event.payload.actorId),
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          abstain: event.payload.abstain === true,
          weight: Number(event.payload.weight ?? 1),
        });
        if (!options.streamEvents) {
          continue;
        }
        // live 模式下延迟到 batch flush 再打印，避免逐票刷屏。
        continue;
      }
      flushVoteBatchLive();
      if (!options.streamEvents) {
        continue;
      }
      const liveRenders = getDefaultScriptEventRenderRegistry().toLiveRender(
        event as GameEvent,
        options.printPrivateEvents,
      );
      for (const render of liveRenders) {
        if (render.kind === "chat") {
          log(render.text, "accent");
        } else if (render.kind === "private") {
          log(render.text, "warn");
        } else if (render.kind === "action") {
          log(render.text, "info");
        } else if (render.kind === "god") {
          log(render.text, "god");
        } else if (render.kind === "end") {
          log(render.text, "ok");
        } else {
          log(render.text, "ok");
        }
      }
    }
    flushVoteBatchLive();
    streamedEventIndex = events.length;
  };
  const heartbeat = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const remain = Math.max(0, deadlineAtMs - Date.now());
    const snap = context.phaseManager.getSnapshot();
    log(
      `[run_llm_game] heartbeat day=${snap.day} phase=${snap.phase} gameOver=${snap.gameOver} elapsed_ms=${elapsed} remain_ms=${remain}`,
      "muted",
    );
  }, 5000);
  const streamTimer = setInterval(() => {
    flushStreamEvents();
  }, 1000);
  let timedOut = false;
  try {
    while (!context.phaseManager.getSnapshot().gameOver) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= options.maxRuntimeMs) {
        timedOut = true;
        log(
          `[run_llm_game] runtime_timeout elapsed_ms=${elapsed}, stop current run and output partial state`,
          "warn",
        );
        break;
      }
      await context.phaseManager.runSingleCycle(budgetedProvider, options.maxDays);
      const cycleSnapshot = context.phaseManager.getSnapshot();
      log(
        `[run_llm_game] cycle day=${cycleSnapshot.day} phase=${cycleSnapshot.phase} gameOver=${cycleSnapshot.gameOver} elapsed_ms=${Date.now() - startedAt}`,
        "info",
      );
    }
  } finally {
    // 退出前强制刷一次剩余事件，避免 game_over 前最后一批投票/放逐日志丢失。
    flushStreamEvents();
    clearInterval(heartbeat);
    clearInterval(streamTimer);
  }
  const snapshot = context.phaseManager.getSnapshot();
  const events = context.phaseManager.getEvents();
  log(
    `[run_llm_game] done board=${options.board} gameOver=${snapshot.gameOver} day=${snapshot.day} winner=${snapshot.result?.winner ?? "none"} timedOut=${timedOut}`,
    "ok",
  );
  log(`[run_llm_game] events=${events.length}`, "info");
  if (options.printAllEvents) {
    console.log(JSON.stringify(events, null, 2));
  }
  // 当 streamEvents 开启时，聊天已实时输出；避免在结尾重复打印整段聊天记录。
  if (options.printChat && !options.streamEvents) {
    const chatLines = toChatLines(events as any);
    for (const line of chatLines) {
      console.log(line);
    }
  }

  try {
    const players = context.world.entityIds().map((id) => {
      const roleComp = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      const aliveComp = context.world.getComponent<AliveComponent>(id, COMPONENT.Alive);
      return {
        player_id: id,
        role: roleComp?.role ?? "unknown",
        camp: roleComp?.camp ?? "unknown",
        alive: aliveComp?.alive === true,
      };
    });
    if (replayManager) {
      await replayManager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: snapshot.result?.winner ?? null,
        finishReason:
          snapshot.result?.reason ?? (timedOut ? "runtime_timeout" : "completed"),
        players,
      });
    }
  } catch (error) {
    log(`[session_recording] finalize_failed err=${String(error)}`, "warn");
  } finally {
    SessionRecordHub.setActive(null);
  }

  return {
    snapshot,
    eventCount: events.length,
  };
}

async function main(): Promise<void> {
  const envBoard =
    process.env.V3_LLM_BOARD === "twelve_player_standard"
      ? "twelve_player_standard"
      : process.env.V3_LLM_BOARD === "six_player_mvp"
        ? "six_player_mvp"
        : appConfig.defaultBoard;
  const envMaxDays = Number(process.env.V3_LLM_MAX_DAYS ?? "10");
  const envMaxRuntimeMs = Number(process.env.V3_LLM_MAX_RUNTIME_MS ?? "30000");
  const envLlmTimeoutMs = Number(process.env.V3_LLM_TIMEOUT_MS ?? "30000");
  const envTrace = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_LLM_TRACE ?? "false").toLowerCase(),
  );
  const envPrintAllEvents = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_PRINT_ALL_EVENTS ?? "false").toLowerCase(),
  );
  const envPrintChat = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_PRINT_CHAT ?? "false").toLowerCase(),
  );
  const envStreamEvents = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_STREAM_EVENTS ?? "true").toLowerCase(),
  );
  const envColor = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_COLOR ?? "true").toLowerCase(),
  );
  const envPrintLlmIo = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_PRINT_LLM_IO ?? "false").toLowerCase(),
  );
  const envPrintThinking = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_PRINT_THINKING ?? "false").toLowerCase(),
  );
  const envPrintPrivateEvents = ["1", "true", "yes", "on"].includes(
    String(process.env.V3_PRINT_PRIVATE_EVENTS ?? "true").toLowerCase(),
  );
  const envRecordRootDir =
    process.env.GAME_RECORDS_DIR ??
    process.env.V3_RECORD_ROOT_DIR ??
    process.env.V3_RECORD_DIR;
  const argOptions = parseArgs(process.argv.slice(2));

  await runLlmGame({
    board: argOptions.board ?? envBoard,
    maxDays: argOptions.maxDays ?? envMaxDays,
    trace: argOptions.trace ?? envTrace,
    maxRuntimeMs: argOptions.maxRuntimeMs ?? envMaxRuntimeMs,
    llmTimeoutMs: argOptions.llmTimeoutMs ?? envLlmTimeoutMs,
    printAllEvents: argOptions.printAllEvents ?? envPrintAllEvents,
    printChat: argOptions.printChat ?? envPrintChat,
    streamEvents: argOptions.streamEvents ?? envStreamEvents,
    color: argOptions.color ?? envColor,
    printLlmIo: argOptions.printLlmIo ?? envPrintLlmIo,
    printThinking: argOptions.printThinking ?? envPrintThinking,
    printPrivateEvents:
      argOptions.printPrivateEvents ?? envPrintPrivateEvents,
    recordRootDir: argOptions.recordRootDir ?? envRecordRootDir,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("run_llm_game failed", error);
    throw error;
  });
}
