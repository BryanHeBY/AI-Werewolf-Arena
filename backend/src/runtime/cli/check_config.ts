import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import { loadRuntimeConfig } from "../config/load_config";
import { loadBoardDefinition } from "../config/load_board_definition";
import { resolveGameSetup, resolveGameBoard } from "../config/resolve_game_setup";
import { describeResolvedSetup } from "../config/describe_setup";

export async function checkConfig(configDir: string, gameName: string, display?: CliDisplayContext) {
  const runtime = await loadRuntimeConfig({ configDir, gameName });
  const board = await loadBoardDefinition(configDir, resolveGameBoard(runtime));
  const setup = resolveGameSetup(runtime, {}, board);
  if (display && !display.explicit) display.locale = setup.context.displayLocale;
  return describeResolvedSetup(setup, display?.locale);
}

export { configDiagnostic } from "../config/error_codes";

export async function main(argv = process.argv.slice(2), display: CliDisplayContext = { locale: "zh-CN", explicit: false }): Promise<void> {
  const args = takeDisplayArguments(argv, display);
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--configs-dir", "--game-config-name"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error("config_check_usage");
    values[args[i]] = args[i + 1];
  }
  const result = await checkConfig(values["--configs-dir"] ?? "configs", values["--game-config-name"] ?? "default", display);
  console.log(JSON.stringify({ ...result, message: text(display.locale, "cli.config_checked") }, null, 2));
}

if (require.main === module) void runCli(main);
