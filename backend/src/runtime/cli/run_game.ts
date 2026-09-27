import { loadRuntimeConfig } from "../config/load_config";
import { resolveGameSetup } from "../config/resolve_game_setup";
import { runGame } from "../game_runner";
import type { RunGameOptions } from "../config/resolve_game_setup";
import type { GameBoard } from "../config/contracts";
function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseArgs(argv: string[]): { configDir: string; gameName: string; overrides: Partial<RunGameOptions> } {
  const overrides: Partial<RunGameOptions> = {};
  let configDir = process.env.GAME_CONFIGS_DIR ?? "configs";
  let gameName = process.env.GAME_CONFIG_NAME ?? "default";
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = argv[i + 1];
    if (!value) continue;
    if (token === "--configs-dir") configDir = value;
    else if (token === "--game-config-name") gameName = value;
    else if (token === "--game" || token === "--board") overrides.board = value as GameBoard;
    else if (token === "--max-days") overrides.maxDays = Number(value);
    else if (token === "--trace") overrides.trace = parseBoolean(value);
    else if (token === "--max-runtime-ms") overrides.maxRuntimeMs = Number(value);
    else if (token === "--llm-timeout-ms") overrides.llmTimeoutMs = Number(value);
    else if (token === "--print-all-events") overrides.printAllEvents = parseBoolean(value);
    else if (token === "--print-chat") overrides.printChat = parseBoolean(value);
    else if (token === "--stream-events") overrides.streamEvents = parseBoolean(value);
    else if (token === "--color") overrides.color = parseBoolean(value);
    else if (token === "--print-llm-io") overrides.printLlmIo = parseBoolean(value);
    else if (token === "--print-thinking") overrides.printThinking = parseBoolean(value);
    else if (token === "--print-private-events") overrides.printPrivateEvents = parseBoolean(value);
    else if (token === "--record-root-dir") overrides.recordRootDir = value;
    else continue;
    i += 1;
  }
  return { configDir, gameName, overrides };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const runtime = await loadRuntimeConfig({ configDir: args.configDir, gameName: args.gameName });
  const setup = resolveGameSetup(runtime, args.overrides, { configDir: args.configDir, log: (line) => console.log(line) });
  await runGame(setup);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("run_game failed", error);
    throw error;
  });
}
