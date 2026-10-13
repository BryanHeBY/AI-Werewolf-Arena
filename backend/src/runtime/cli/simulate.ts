/**
 * 负责模拟 CLI 的次数、种子前缀、板子与展示语言接线。输入为 argv／配置目录，输出原模拟报告、记录根与失败退出码。
 * 每局执行及 RNG 归模拟驱动，本入口不把基线策略当规则 oracle，不更改已运行对局结果。
 */
import { isLocale } from "@ai-werewolf-arena/game-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import { loadBoardDefinition } from "../config/load_board_definition";
import { simulateGames } from "../simulation/simulate_games";
import path from "node:path";
import { resolveDefaultRecordRoot } from "../../recording/session_recorder";
import { resolveCliConfigDirectory } from "./config_directory";

export async function main(
  argv = process.argv.slice(2),
  display: CliDisplayContext = { locale: "zh-CN", explicit: false },
) {
  const args = takeDisplayArguments(argv, display);
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      ![
        "--configs-dir",
        "--board",
        "--count",
        "--seed-prefix",
        "--record-root",
        "--locale",
      ].includes(args[index]) ||
      !args[index + 1] ||
      args[index + 1].startsWith("--")
    )
      throw new Error("simulation_cli_usage");
    values[args[index]] = args[index + 1];
  }
  const locale = values["--locale"] ?? "zh-CN";
  if (!isLocale(locale)) throw new Error("simulation_locale_invalid");
  if (!display.explicit) display.locale = locale;
  const count = Number(values["--count"] ?? 25);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000)
    throw new Error("simulation_count_invalid");
  const board = await loadBoardDefinition(
    resolveCliConfigDirectory(values["--configs-dir"]),
    values["--board"] ?? "six_player_mvp",
  );
  const prefix = values["--seed-prefix"] ?? "regression";
  const recordRoot =
    values["--record-root"] ??
    path.join(resolveDefaultRecordRoot(), `simulation-${crypto.randomUUID()}`);
  const report = await simulateGames(board, {
    locale,
    displayLocale: display.locale,
    seeds: Array.from({ length: count }, (_, index) => `${prefix}:${index}`),
    recordRoot,
  });
  console.log(
    JSON.stringify(
      { ...report, recordRoot, message: text(display.locale, "cli.simulated") },
      null,
      2,
    ),
  );
  if (report.rejects || report.fallbacks || report.naturallyFinished !== count)
    process.exitCode = 1;
}

if (require.main === module) void runCli(main);
