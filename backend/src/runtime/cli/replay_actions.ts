import path from "node:path";
import { readReproduction, replayReproduction } from "../simulation/replay_reproduction";
import { resolveDefaultRecordRoot } from "../../recording/session_recorder";

async function main(args = process.argv.slice(2)) {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!["--record", "--record-root"].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("reproduction_cli_usage");
    values[args[index]] = args[index + 1];
  }
  if (!values["--record"]) throw new Error("reproduction_cli_usage");
  const record = await readReproduction(path.resolve(values["--record"]));
  const result = await replayReproduction(record, values["--record-root"] ?? resolveDefaultRecordRoot());
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main().catch(error => {
  // No input fragments, credential-bearing transport errors, or full trace on the terminal.
  const code = error instanceof Error && /^reproduction_[a-z_]+$/.test(error.message) ? error.message : "reproduction_failed";
  console.error(code); process.exitCode = 1;
});
