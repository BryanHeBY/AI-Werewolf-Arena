import { runLlmGame } from "./run_llm_game";
import { loadRuntimeConfig } from "./config/runtime_config";

/**
 * 双板顺序验证入口：
 * 先跑 6 人局，再跑 12 人局，便于快速对比接入 LLM 后的行为表现。
 */
function parseArgs(argv: string[]): { configsDir?: string; gameConfigName?: string } {
  const out: { configsDir?: string; gameConfigName?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--configs-dir" && argv[i + 1]) {
      out.configsDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--game-config-name" && argv[i + 1]) {
      out.gameConfigName = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.configsDir) {
    process.env.GAME_CONFIGS_DIR = args.configsDir;
  }
  if (args.gameConfigName) {
    process.env.GAME_CONFIG_NAME = args.gameConfigName;
  }
  const runtime = await loadRuntimeConfig();
  const game = runtime.game;
  const baseOptions = {
    maxDays: game.maxDays ?? 10,
    trace: game.trace ?? false,
    maxRuntimeMs: game.maxRuntimeMs ?? 30000,
    llmTimeoutMs: game.llmTimeoutMs ?? 1200,
    printAllEvents: game.printAllEvents ?? false,
    printChat: game.printChat ?? false,
    streamEvents: game.streamEvents ?? false,
    color: game.color ?? true,
    printLlmIo: game.printLlmIo ?? false,
    printThinking: game.printThinking ?? false,
    printPrivateEvents: game.printPrivateEvents ?? true,
    recordRootDir: game.recordRootDir,
  };
  console.log("[run_llm_dual] step 1/2 six_player_mvp");
  await runLlmGame({
    board: "six_player_mvp",
    ...baseOptions,
  });

  console.log("[run_llm_dual] step 2/2 twelve_player_standard");
  await runLlmGame({
    board: "twelve_player_standard",
    ...baseOptions,
  });
}

main().catch((error) => {
  console.error("run_llm_dual failed", error);
  throw error;
});
