/**
 * 负责单局 CLI 参数、配置读取和已解析 setup 的运行接线。输入为 argv、展示上下文及配置目录，输出原 runner 执行结果。
 * 读取与板子合并仍归配置所有者，生命周期及异常收尾归 runner；本入口不实现角色规则或模型回退。
 */
import { isLocale, type Locale } from "@ai-werewolf-arena/game-contract";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import { loadRuntimeConfig } from "../config/load-config";
import { loadBoardDefinition } from "../config/load-board-definition";
import { resolveGameBoard, resolveGameSetup } from "../config/resolve-game-setup";
import { runGame } from "../game-runner";
import type { RunGameOptions } from "../config/resolve-game-setup";
import type { GameBoard } from "../config/contracts";
import { resolveCliConfigDirectory } from "./config-directory";
function parseBoolean(value: string): boolean {
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  throw new Error("runtime_cli_boolean_invalid");
}

export function parseRunGameArgs(
  argv: string[],
  environment: NodeJS.ProcessEnv = process.env,
): { configDir: string; gameName: string; overrides: Partial<RunGameOptions>; locale?: Locale } {
  const overrides: Partial<RunGameOptions> = {};
  let locale: Locale | undefined;
  let configDir = resolveCliConfigDirectory(undefined, environment);
  let gameName = environment.GAME_CONFIG_NAME ?? "default";
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error("runtime_cli_value_missing");
    if (token === "--configs-dir") configDir = value;
    else if (token === "--game-config-name") gameName = value;
    else if (token === "--game" || token === "--board") overrides.board = value as GameBoard;
    else if (token === "--locale") {
      if (!isLocale(value)) throw new Error("runtime_cli_locale_invalid");
      locale = value;
    } else if (token === "--max-days") overrides.maxDays = Number(value);
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
    else throw new Error("runtime_cli_option_unknown");
    i += 1;
  }
  return { configDir, gameName, overrides, locale };
}

export async function main(
  argv = process.argv.slice(2),
  display: CliDisplayContext = { locale: "zh-CN", explicit: false },
): Promise<void> {
  const args = parseRunGameArgs(takeDisplayArguments(argv, display));
  if (!display.explicit && args.locale) display.locale = args.locale;
  const runtime = await loadRuntimeConfig({ configDir: args.configDir, gameName: args.gameName });
  const board = resolveGameBoard(runtime, args.overrides);
  const boardOverride = await loadBoardDefinition(args.configDir, board);
  const setup = resolveGameSetup(
    {
      ...runtime,
      game: {
        ...runtime.game,
        ...(args.locale ? { locale: args.locale } : {}),
        ...(display.explicit ? { displayLocale: display.locale } : {}),
      },
    },
    args.overrides,
    boardOverride,
  );
  display.locale = setup.context.displayLocale;
  await runGame(setup);
}

if (require.main === module) void runCli(main);
