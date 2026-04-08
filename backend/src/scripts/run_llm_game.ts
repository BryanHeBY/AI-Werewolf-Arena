import { bootstrapGame } from "../app/bootstrap";
import { appConfig } from "../config";
import {
  ActionProvider,
  ActionRequest,
  RuntimeSnapshot,
  ToolCall,
} from "../domain/model";
import { OpenAIClient } from "../infra/llm/openai_client";
import { sixPlayerMvpConfig } from "../scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../scenarios/twelve_player_standard";
import { colorize, isAnsiEnabled } from "../utils/ansi";
import { BaselineBotActionProvider } from "../v3/action_providers";
import { LlmActionProvider } from "../v3/llm_action_provider";

export type LlmBoard = "six_player_mvp" | "twelve_player_standard";

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
  const lines: string[] = [];
  for (const event of events) {
    if (event.type === "wolf_discussion") {
      lines.push(`[夜聊][${event.payload.actorId}] ${event.payload.text}`);
    }
    if (event.type === "day_speech") {
      lines.push(`[白天][${event.payload.actorId}] ${event.payload.text}`);
    }
  }
  return lines;
}

function toJudgeLine(event: { type: string; payload: Record<string, any> }): string | null {
  const p = event.payload;
  if (event.type === "phase_changed") {
    if (p.phase === "night") {
      return `天黑请闭眼（第${p.day}天夜晚）`;
    }
    if (p.phase === "day") {
      return `天亮了（第${p.day}天白天）`;
    }
    if (p.phase === "voting") {
      return `现在进入放逐投票阶段`;
    }
    if (p.phase === "game_over") {
      return `对局结束`;
    }
  }

  if (event.type === "night_resolved") {
    const deaths = Array.isArray(p.deaths) ? p.deaths : [];
    if (deaths.length === 0) {
      return `昨夜是平安夜`;
    }
    return `昨夜死亡：${deaths.join("、")}号`;
  }
  if (event.type === "guard_applied") {
    return null;
  }
  if (event.type === "voted_out") {
    return `${p.target}号被放逐出局`;
  }
  if (event.type === "wolf_self_destruct") {
    return `${p.wolfId}号狼人自爆，流程被中断`;
  }
  if (event.type === "game_over") {
    return `胜利阵营：${p.winner}，原因：${p.reason}`;
  }
  return null;
}

class DeadlineAwareActionProvider implements ActionProvider {
  constructor(
    private readonly delegate: ActionProvider,
    private readonly deadlineAtMs: number,
  ) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    return this.delegate.getAction({
      ...request,
      deadlineAtMs: this.deadlineAtMs,
    });
  }
}

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
  const startedAt = Date.now();
  const deadlineAtMs = startedAt + options.maxRuntimeMs;
  const budgetedProvider = new DeadlineAwareActionProvider(provider, deadlineAtMs);
  const heartbeat = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const remain = Math.max(0, deadlineAtMs - Date.now());
    const snap = context.phaseManager.getSnapshot();
    log(
      `[run_llm_game] heartbeat day=${snap.day} phase=${snap.phase} gameOver=${snap.gameOver} elapsed_ms=${elapsed} remain_ms=${remain}`,
      "muted",
    );
  }, 5000);
  let streamedEventIndex = 0;
  const streamTimer = setInterval(() => {
    if (!options.streamEvents) {
      return;
    }
    const events = context.phaseManager.getEvents();
    if (streamedEventIndex >= events.length) {
      return;
    }
    for (let i = streamedEventIndex; i < events.length; i++) {
      const event = events[i];
      if (event.type === "wolf_discussion") {
        log(`[live][夜聊][${event.payload.actorId}] ${event.payload.text}`, "accent");
      } else if (event.type === "day_speech") {
        log(`[live][白天][${event.payload.actorId}] ${event.payload.text}`, "ok");
      } else if (event.type === "guard_applied") {
        log(
          `[live][行动][守卫] ${event.payload.actorId}号守护${event.payload.targetId}号`,
          "info",
        );
      } else if (event.type === "seer_checked" && options.printPrivateEvents) {
        log(
          `[live][私有][查验] ${event.payload.actorId}号查验${event.payload.targetId}号 => ${event.payload.isWerewolf ? "狼人" : "好人"}`,
          "warn",
        );
      } else if (event.type === "wolf_kill_vote_cast") {
        log(
          `[live][行动][狼刀票] ${event.payload.actorId}号投刀${event.payload.targetId}号`,
          "accent",
        );
      } else if (event.type === "witch_potion_used") {
        log(
          `[live][行动][女巫] ${event.payload.actorId}号对${event.payload.targetId}号使用${event.payload.potionType}`,
          "warn",
        );
      } else if (event.type === "vote_cast") {
        log(
          `[live][行动][投票] ${event.payload.actorId}号 -> ${event.payload.targetId}号 (weight=${event.payload.weight})`,
          "warn",
        );
      } else if (event.type === "game_over") {
        log(
          `[live][终局] winner=${event.payload.winner} reason=${event.payload.reason}`,
          "ok",
        );
      }
      const judgeLine = toJudgeLine(event as any);
      if (judgeLine) {
        log(`[live][上帝] ${judgeLine}`, "god");
      }
    }
    streamedEventIndex = events.length;
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
  } else {
    console.log(JSON.stringify(events.slice(-12), null, 2));
  }
  if (options.printChat) {
    const chatLines = toChatLines(events as any);
    console.log(`[run_llm_game] chat_lines=${chatLines.length}`);
    for (const line of chatLines) {
      console.log(line);
    }
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
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("run_llm_game failed", error);
    throw error;
  });
}
