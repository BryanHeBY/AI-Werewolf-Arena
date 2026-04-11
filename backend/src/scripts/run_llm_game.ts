
/**
 * 真实 LLM 对局运行脚本：用于本地回放与可观测调试。
 */
import { bootstrapGame } from "../app/bootstrap";
import { appConfig } from "../config";
import { loadRuntimeConfig } from "../config/runtime_config";
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
import { buildAgentBroadcastLine, renderMergedVoteBatch } from "../engine/agent_broadcast_feed";
import { getDefaultScriptEventRenderRegistry } from "../mechanisms";
import { resolveBoardConfig } from "../scenarios/board_config_resolver";
import {
  buildSessionId,
  resolveDefaultRecordRoot,
  SessionRecordHub,
  SessionRecordManager,
} from "../session_recording";
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

  const runtime = await loadRuntimeConfig();
  const providerConfig = runtime.provider;
  const agentConfig = runtime.agent;
  const gameConfig = runtime.game ?? {};

  if (!providerConfig?.apiKey || !agentConfig?.default?.model) {
    throw new Error("runtime_config_missing_provider_or_agent_defaults");
  }

  const forceJsonResponse = agentConfig.default.forceJsonResponse ?? true;

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
    log(`[session_recording] init_failed err=${String(error)}`, "warn");
    SessionRecordHub.setActive(null);
  }

  const resolveProfile = (role?: string, actorId?: number) => {
    const merged = { ...agentConfig.default } as any;
    if (role && agentConfig.roles?.[role]) {
      Object.assign(merged, agentConfig.roles[role]);
    }
    if (actorId !== undefined && agentConfig.players?.[String(actorId)]) {
      Object.assign(merged, agentConfig.players[String(actorId)]);
    }
    if (role && gameConfig.roleAgents?.[role]) {
      Object.assign(merged, gameConfig.roleAgents[role]);
    }
    if (actorId !== undefined && gameConfig.playerAgents?.[String(actorId)]) {
      Object.assign(merged, gameConfig.playerAgents[String(actorId)]);
    }
    return merged as typeof agentConfig.default;
  };

  const clientByActor = new Map<number, OpenAIClient>();
  for (const id of context.world.entityIds()) {
    const roleComp = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
    const profile = resolveProfile(roleComp?.role, id);
    clientByActor.set(
      id,
      new OpenAIClient({
        baseURL: providerConfig.baseURL,
        apiKey: providerConfig.apiKey,
        model: profile.model,
        userAgent: providerConfig.userAgent,
        temperature: profile.temperature ?? 0.2,
        maxTokens: profile.maxTokens ?? 512,
        forceJsonResponse: profile.forceJsonResponse ?? forceJsonResponse,
        reasoningEnabled: profile.reasoningEnabled ?? true,
        reasoningEffort: profile.reasoningEffort ?? "medium",
      }),
    );
  }

  const actionProvider = LlmActionProvider.fromOpenAIClient(
    context.world,
    clientByActor.get(context.world.entityIds()[0])!,
    {
      clientResolver: (request, role) =>
        clientByActor.get(request.actorId) ??
        clientByActor.get(context.world.entityIds()[0])!,
      personalityPromptResolver: (request, role) =>
        resolveProfile(role?.role, request.actorId).personalityPrompt,
      trace: options.trace,
      fallbackProvider: new BaselineBotActionProvider(context.world),
      maxPromptEvents: 20,
      llmTimeoutMs: options.llmTimeoutMs,
      colorizeLogs: colorEnabled,
      printLlmIo: options.printLlmIo,
      printThinking: options.printThinking,
      boardConfig,
    },
  );

  log(
    `[run_llm_game] start board=${options.board} maxDays=${options.maxDays} model=${agentConfig.default.model} maxRuntimeMs=${options.maxRuntimeMs} llmTimeoutMs=${options.llmTimeoutMs}`,
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
  let replayDayCursor = 1;
  let replayPhaseCursor = String(context.phaseManager.getSnapshot().phase);
  const flushStreamEvents = (): void => {
    const events = context.phaseManager.getEvents();
    if (streamedEventIndex >= events.length) {
      return;
    }
    const voteBatch: Array<{ actorId: number; targetId: number | null; abstain: boolean; weight: number }> = [];
    const replayVoteBatch: GameEvent[] = [];
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
        replayDayCursor = Number(event.payload.day ?? replayDayCursor);
        replayPhaseCursor = String(event.payload.phase ?? replayPhaseCursor);
      }
      replayManager?.recordPublicEvent({
        type: event.type,
        timestampMs: event.timestamp,
        day: replayDayCursor,
        phase: replayPhaseCursor,
        payload: event.payload,
        renderText: toReplayRenderText(event as any),
      });
      if (!options.streamEvents) {
        // 即使不打印 live，也要写入“玩家可见广播”到 session 复盘。
      }
      if (replayManager) {
        if (event.type === "vote_cast") {
          replayVoteBatch.push(event as GameEvent);
        } else if (replayVoteBatch.length > 0) {
          const merged = renderMergedVoteBatch(replayVoteBatch);
          if (merged) {
            for (const playerId of context.world.entityIds()) {
              const roleComp = context.world.getComponent<RoleComponent>(
                playerId,
                COMPONENT.Role,
              );
              replayManager.recordPlayerBroadcast({
                playerId,
                role: roleComp?.role ?? "unknown",
                camp: roleComp?.camp ?? "unknown",
                day: replayDayCursor,
                phase: "voting",
                stage: "voting",
                requestId: `${replayDayCursor}-voting-${playerId}-broadcast-${i}-batch`,
                text: merged,
              });
            }
          }
          replayVoteBatch.length = 0;
        }
        if (event.type !== "vote_cast") {
          for (const playerId of context.world.entityIds()) {
            const line = buildAgentBroadcastLine(
              context.world,
              event as GameEvent,
              playerId,
            );
            if (!line) {
              continue;
            }
            const roleComp = context.world.getComponent<RoleComponent>(
              playerId,
              COMPONENT.Role,
            );
            replayManager.recordPlayerBroadcast({
              playerId,
              role: roleComp?.role ?? "unknown",
              camp: roleComp?.camp ?? "unknown",
              day: replayDayCursor,
              phase: replayPhaseCursor,
              stage: toReplayStage(event as any),
              requestId: `${replayDayCursor}-${replayPhaseCursor}-${playerId}-broadcast-${i}`,
              text: line,
            });
          }
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
  const argOptions = parseArgs(process.argv.slice(2));
  if (argOptions.configsDir) {
    process.env.GAME_CONFIGS_DIR = argOptions.configsDir;
  }
  if (argOptions.gameConfigName) {
    process.env.GAME_CONFIG_NAME = argOptions.gameConfigName;
  }
  const runtime = await loadRuntimeConfig();
  const game = runtime.game ?? {};
  const envBoard = game.board ?? appConfig.defaultBoard;
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
