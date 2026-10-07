import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import path from "node:path";
import { readReproduction, replayReproduction } from "../simulation/replay_reproduction";
import { resolveDefaultRecordRoot } from "../../recording/session_recorder";

export async function main(argv = process.argv.slice(2), display: CliDisplayContext = { locale: "zh-CN", explicit: false }) {
  const args = takeDisplayArguments(argv, display);
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!["--record", "--record-root"].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("reproduction_cli_usage");
    values[args[index]] = args[index + 1];
  }
  if (!values["--record"]) throw new Error("reproduction_cli_usage");
  const record = await readReproduction(path.resolve(values["--record"]));
  if (!display.explicit) display.locale = record.metadata.locale;
  const result = await replayReproduction(record, values["--record-root"] ?? resolveDefaultRecordRoot(), display.locale);
  console.log(JSON.stringify({ ...result, message: text(display.locale, "cli.reproduced") }, null, 2));
}

if (require.main === module) void runCli(main);
