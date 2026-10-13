/**
 * 负责严格复现 CLI 的路径、显示语言与退出结果；输入为显式归档路径和输出目录。
 * 输出为执行器原结果与本地化提示；文件入口保留 envelope 身份再执行，不丢弃声明或替换来源。
 * 不解析游戏规则、加载模型或绕过 source／lock／RNG 校验，失败仍由原 CLI 出口处理。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import path from "node:path";
import { readReproductionArchive, replayReproduction } from "../simulation/replay_reproduction";
import { resolveDefaultRecordRoot } from "../../recording/session_recorder";

export async function main(
  argv = process.argv.slice(2),
  display: CliDisplayContext = { locale: "zh-CN", explicit: false },
) {
  const args = takeDisplayArguments(argv, display);
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      !["--record", "--record-root"].includes(args[index]) ||
      !args[index + 1] ||
      args[index + 1].startsWith("--")
    )
      throw new Error("reproduction_cli_usage");
    values[args[index]] = args[index + 1];
  }
  if (!values["--record"]) throw new Error("reproduction_cli_usage");
  const archive = await readReproductionArchive(path.resolve(values["--record"]));
  if (!display.explicit) display.locale = archive.record.metadata.locale;
  const result = await replayReproduction(
    archive.input,
    values["--record-root"] ?? resolveDefaultRecordRoot(),
    display.locale,
  );
  console.log(
    JSON.stringify({ ...result, message: text(display.locale, "cli.reproduced") }, null, 2),
  );
}

if (require.main === module) void runCli(main);
