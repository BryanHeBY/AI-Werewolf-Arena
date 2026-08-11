
/**
 * 真实 LLM 对局运行脚本：用于本地回放与可观测调试。
 */
import { bootstrapGame } from "../app/bootstrap";
import * as path from "node:path";
import {
  loadRuntimeConfig,
  GameAgentSelection,
  ResolvedAgentRuntimeProfile,
  resolveAgentProfileByName,
} from "./config/runtime_config";
import {
  ActionProvider,
  ActionRequest,
  GameEvent,
  RuntimeSnapshot,
  ToolCall,
  AliveComponent,
  COMPONENT,
  RoleComponent,
} from "../core";
import { buildAgentVisibleEvent } from "../game/engine/agent_visible_event_feed";
import { getDefaultScriptEventRenderRegistry } from "../game";
import { resolveBoardConfig } from "./scenarios/board_config_resolver";
import {
  buildSessionId,
  resolveDefaultRecordRoot,
  SessionRecordHub,
  SessionRecordManager,
} from "../observability";
import { colorize, isAnsiEnabled } from "../utils/ansi";
import { createPlayerAgentRuntime } from "./player_agent_factory";

/**
 * 支持的对局板子名称。
 */
export type LlmBoard = "six_player_mvp" | "twelve_player_standard";

/**
 * 对局运行参数。
 */
export interface RunLlmGameOptions {
  board: LlmBoard;
  gameConfigName?: string;
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
  configsDir?: string;
}

function selectionName(selection: GameAgentSelection | undefined): string | undefined {
  return typeof selection === "string" ? selection : selection?.agent;
}

function selectionSpawnArgs(selection: GameAgentSelection | undefined): string[] {
  return typeof selection === "object" && selection?.spawnArgs
    ? [...selection.spawnArgs]
    : [];
}

function parseArgs(argv: string[]): Partial<RunLlmGameOptions> {
  const out: Partial<RunLlmGameOptions> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--configs-dir" && argv[i + 1]) {
      out.configsDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--game" && argv[i + 1]) {
      out.board = argv[i + 1] as LlmBoard;
      i += 1;
      continue;
    }
    if (token === "--game-config-name" && argv[i + 1]) {
      out.gameConfigName = argv[i + 1];
      i += 1;
      continue;
    }
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

function pickBoard(
  board: LlmBoard,
  boardName?: string,
  log?: (text: string) => void,
) {
  return resolveBoardConfig(board, { board: boardName }, log);
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

function toReplayStage(event: { type: string; payload: Record<string, any> }): string {
  return getDefaultScriptEventRenderRegistry().toReplayStage(event as GameEvent);
}

type AcpUpdateRecord = Record<string, unknown>;

function asAcpUpdateRecord(value: unknown): AcpUpdateRecord | null {
  return value && typeof value === "object" ? value as AcpUpdateRecord : null;
}

function acpUpdateText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asAcpUpdateRecord(value);
  return typeof record?.text === "string" ? record.text : "";
}

function compactAcpText(value: string, maxLength = 500): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

/**
 * ACP adapter emits token chunks, command snapshots, usage counters and status
 * pulses. The console should expose decisions and tool boundaries, while the
 * complete protocol trace remains in each player's .acp-logs directory.
 */
function createAcpConsoleLogger(
  actorId: number,
  log: (text: string, tone?: "muted" | "info" | "ok" | "warn" | "error" | "accent" | "god") => void,
): (update: unknown) => void {
  let pendingMessage: { id: string; text: string } | null = null;
  const toolLabels = new Map<string, string>();
  const flushMessage = () => {
    if (!pendingMessage) return;
    const text = compactAcpText(pendingMessage.text);
    // Codex emits this stock final answer after a normal turn interrupt. It
    // carries no game information and would otherwise dominate ACP logs.
    if (text && !/^\*?conversation interrupted\*?$/i.test(text)) {
      log(`[acp][${actorId}][message] ${text}`, "muted");
    }
    pendingMessage = null;
  };

  return (update: unknown) => {
    const event = asAcpUpdateRecord(update);
    if (!event || typeof event.sessionUpdate !== "string") return;
    const type = event.sessionUpdate;
    if (type === "agent_message_chunk") {
      const messageId = typeof event.messageId === "string" ? event.messageId : "unknown";
      if (pendingMessage && pendingMessage.id !== messageId) flushMessage();
      if (!pendingMessage) pendingMessage = { id: messageId, text: "" };
      pendingMessage.text += acpUpdateText(event.content);
      return;
    }
    flushMessage();

    if (type === "agent_thought_chunk") {
      const text = compactAcpText(acpUpdateText(event.content), 240);
      if (text) log(`[acp][${actorId}][thought] ${text}`, "muted");
      return;
    }
    if (type === "tool_call") {
      const rawInput = asAcpUpdateRecord(event.rawInput);
      const server = typeof rawInput?.server === "string" ? rawInput.server : undefined;
      const tool = typeof rawInput?.tool === "string" ? rawInput.tool : undefined;
      const title = typeof event.title === "string" ? compactAcpText(event.title, 180) : "tool";
      const label = server && tool ? `${server}.${tool}` : title;
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      if (toolCallId) toolLabels.set(toolCallId, label);
      log(`[acp][${actorId}][tool] start ${label}`, "muted");
      return;
    }
    if (type === "tool_call_update") {
      const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId : undefined;
      const label = toolCallId ? toolLabels.get(toolCallId) ?? "tool" : "tool";
      const status = typeof event.status === "string" ? event.status : "updated";
      const error = compactAcpText(acpUpdateText(event.error), 240);
      log(
        `[acp][${actorId}][tool] ${status} ${label}${error ? ` error=${error}` : ""}`,
        error || status === "failed" ? "warn" : "muted",
      );
      if (toolCallId && (status === "completed" || status === "failed")) toolLabels.delete(toolCallId);
    }
  };
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

  const runtime = await loadRuntimeConfig();
  const providersConfig = runtime.providers;
  const agentsConfig = runtime.agents;
  const gameConfig = runtime.game;

  if (!providersConfig?.items?.[providersConfig.default] || !agentsConfig?.items?.[agentsConfig.default]) {
    throw new Error("runtime_config_missing_provider_or_agent_defaults");
  }

  const defaultAgentProfile = resolveAgentProfileByName(runtime, gameConfig.agent);
  const forceJsonResponse = defaultAgentProfile.forceJsonResponse ?? true;

  const boardConfig = pickBoard(
    options.board,
    options.board,
    (line) => log(line, "muted"),
  );
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
    log(`[observability] init_failed err=${String(error)}`, "warn");
    SessionRecordHub.setActive(null);
  }

  const resolveProfile = (role?: string, actorId?: number): ResolvedAgentRuntimeProfile => {
    const playerSelection =
      actorId !== undefined ? gameConfig.playerAgents?.[String(actorId)] : undefined;
    const roleSelection = role ? gameConfig.roleAgents?.[role] : undefined;
    const selection = playerSelection ?? roleSelection ?? gameConfig.agent;
    const selectedAgentName = selectionName(selection);
    const profile = resolveAgentProfileByName(runtime, selectedAgentName);
    const spawnArgs = selectionSpawnArgs(selection);
    return profile.kind === "acp" && spawnArgs.length
      ? { ...profile, spawnArgs: [...(profile.spawnArgs ?? []), ...spawnArgs] }
      : profile;
  };

  const profilesByActor = new Map<number, ResolvedAgentRuntimeProfile>();
  for (const id of context.world.entityIds()) {
    const roleComp = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
    profilesByActor.set(id, resolveProfile(roleComp?.role, id));
  }
  const playerAgentRuntime = await createPlayerAgentRuntime({
    world: context.world,
    boardConfig,
    profilesByActor,
    acpWorkspaceRoot: path.join(replayRecordRoot, replaySessionId, "acp-workspaces"),
    llmTimeoutMs: options.llmTimeoutMs,
    trace: options.trace,
    colorizeLogs: colorEnabled,
    printLlmIo: options.printLlmIo,
    printThinking: options.printThinking,
    defaultForceJsonResponse: forceJsonResponse,
    createAcpUpdateObserver: options.printThinking
      ? (actorId) => createAcpConsoleLogger(actorId, log)
      : undefined,
  });
  const actionProvider = playerAgentRuntime.provider;

  log(
    `[run_llm_game] start board=${options.board} maxDays=${options.maxDays} agent=${defaultAgentProfile.name} kind=${defaultAgentProfile.kind} model=${defaultAgentProfile.model ?? "n/a"} provider=${defaultAgentProfile.providerName} maxRuntimeMs=${options.maxRuntimeMs} llmTimeoutMs=${options.llmTimeoutMs}`,
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
  const budgetedProvider = new DeadlineAwareActionProvider(actionProvider, deadlineAtMs);
  let streamedEventIndex = 0;
  const playerVisibleEventSeq = new Map<number, number>();
  let replayDayCursor = 1;
  let replayPhaseCursor = String(context.phaseManager.getSnapshot().phase);
  const flushStreamEvents = (): void => {
    const events = context.phaseManager.getEvents();
    if (streamedEventIndex >= events.length) {
      return;
    }
    for (let i = streamedEventIndex; i < events.length; i++) {
      const event = events[i];
      if (event.type === "phase_changed") {
        replayDayCursor = Number(event.payload.day ?? replayDayCursor);
        replayPhaseCursor = String(event.payload.phase ?? replayPhaseCursor);
      }
      replayManager?.recordPublicEvent({
        type: event.type,
        timestampMs: event.timestamp,
        day: replayDayCursor,
        phase: replayPhaseCursor,
        stage: toReplayStage(event as any),
        payload: event.payload,
      });
      if (replayManager) {
        for (const playerId of context.world.entityIds()) {
          const nextVisibleSeq = (playerVisibleEventSeq.get(playerId) ?? 0) + 1;
          const visibleEvent = buildAgentVisibleEvent(
            context.world,
            event as GameEvent,
            playerId,
            nextVisibleSeq,
          );
          if (!visibleEvent) continue;
          playerVisibleEventSeq.set(playerId, nextVisibleSeq);
          const roleComp = context.world.getComponent<RoleComponent>(
            playerId,
            COMPONENT.Role,
          );
          replayManager.recordPlayerEvent({
            playerId,
            role: roleComp?.role ?? "unknown",
            camp: roleComp?.camp ?? "unknown",
            day: replayDayCursor,
            phase: replayPhaseCursor,
            stage: toReplayStage(event as any),
            requestId: `${replayDayCursor}-${replayPhaseCursor}-${playerId}-event-${i + 1}`,
            timestampMs: event.timestamp,
            sourceEventSeq: i + 1,
            event: visibleEvent,
          });
        }
      }
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
    streamedEventIndex = events.length;
  };
  // 心跳仅用于显式 trace 调试，默认 stdio 保持安静；对局 deadline 由
  // DeadlineAwareActionProvider 和主循环独立维护，不依赖该定时器。
  const heartbeat = options.trace
    ? setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remain = Math.max(0, deadlineAtMs - Date.now());
        const snap = context.phaseManager.getSnapshot();
        log(
          `[run_llm_game] heartbeat day=${snap.day} phase=${snap.phase} gameOver=${snap.gameOver} elapsed_ms=${elapsed} remain_ms=${remain}`,
          "muted",
        );
      }, 5000)
    : undefined;
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
    if (heartbeat) clearInterval(heartbeat);
    clearInterval(streamTimer);
    await playerAgentRuntime.close();
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
    log(`[observability] finalize_failed err=${String(error)}`, "warn");
  } finally {
    SessionRecordHub.setActive(null);
  }

  return {
    snapshot,
    eventCount: events.length,
  };
}

async function main(): Promise<void> {
  const argOptions = parseArgs(process.argv.slice(2));
  if (argOptions.configsDir) {
    process.env.GAME_CONFIGS_DIR = argOptions.configsDir;
  }
  if (argOptions.gameConfigName) {
    process.env.GAME_CONFIG_NAME = argOptions.gameConfigName;
  }
  const runtime = await loadRuntimeConfig();
  const game = runtime.game;
  const envBoard = game.board ?? "six_player_mvp";
  const envMaxDays = game.maxDays ?? 10;
  const envMaxRuntimeMs = game.maxRuntimeMs ?? 30000;
  const envLlmTimeoutMs = game.llmTimeoutMs ?? 30000;
  const envTrace = game.trace ?? false;
  const envPrintAllEvents = game.printAllEvents ?? false;
  const envPrintChat = game.printChat ?? false;
  const envStreamEvents = game.streamEvents ?? true;
  const envColor = game.color ?? true;
  const envPrintLlmIo = game.printLlmIo ?? false;
  const envPrintThinking = game.printThinking ?? false;
  const envPrintPrivateEvents = game.printPrivateEvents ?? true;
  const envRecordRootDir = game.recordRootDir;
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
