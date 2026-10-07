import { loadBoardDefinition } from "../config/load_board_definition";
import { simulateGames } from "../simulation/simulate_games";
import path from "node:path";
import { resolveDefaultRecordRoot } from "../../recording/session_recorder";

async function main(args = process.argv.slice(2)) {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!["--configs-dir", "--board", "--count", "--seed-prefix", "--record-root"].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("simulation_cli_usage");
    values[args[index]] = args[index + 1];
  }
  const count = Number(values["--count"] ?? 25);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error("simulation_count_invalid");
  const board = await loadBoardDefinition(values["--configs-dir"] ?? "configs", values["--board"] ?? "six_player_mvp");
  const prefix = values["--seed-prefix"] ?? "regression";
  const recordRoot = values["--record-root"] ?? path.join(resolveDefaultRecordRoot(), `simulation-${crypto.randomUUID()}`);
  const report = await simulateGames(board, { seeds: Array.from({ length: count }, (_, index) => `${prefix}:${index}`), recordRoot });
  console.log(JSON.stringify({ ...report, recordRoot }, null, 2));
  if (report.rejects || report.fallbacks || report.naturallyFinished !== count) process.exitCode = 1;
}

if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : "simulation_failed"); process.exitCode = 1; });
