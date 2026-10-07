import { loadRuntimeConfig } from "../config/load_config";
import { loadBoardDefinition } from "../config/load_board_definition";
import { resolveGameSetup, resolveGameBoard } from "../config/resolve_game_setup";
import { describeResolvedSetup } from "../config/describe_setup";
import { BoardConfigurationError } from "../config/board_definition";

export async function checkConfig(configDir: string, gameName: string) {
  const runtime = await loadRuntimeConfig({ configDir, gameName });
  const board = await loadBoardDefinition(configDir, resolveGameBoard(runtime));
  return describeResolvedSetup(resolveGameSetup(runtime, {}, board));
}

export function configDiagnostic(error: unknown): { code: string; path?: string } {
  const candidate = error instanceof Error ? error.message.split(":", 1)[0] : "config_check_failed";
  const code = /^(board_config|runtime_config|config_check)_[a-z_]+$/.test(candidate) ? candidate : "config_check_failed";
  // Only typed board field paths are safe: arbitrary error messages may contain secrets.
  const fieldPath = error instanceof BoardConfigurationError ? error.fieldPath : undefined;
  const safePath = fieldPath && fieldPath.length <= 160 && /^(version|id|ruleset|board|rules|mechanisms|roles)(\.[a-z][a-zA-Z0-9_-]{0,31}|\.\d+)*$/.test(fieldPath);
  return { code, ...(safePath ? { path: fieldPath } : {}) };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--configs-dir", "--game-config-name"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error("config_check_usage");
    values[args[i]] = args[i + 1];
  }
  const result = await checkConfig(values["--configs-dir"] ?? "configs", values["--game-config-name"] ?? "default");
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main().catch(error => {
  console.error(JSON.stringify(configDiagnostic(error)));
  process.exitCode = 1;
});
