/**
 * 负责配置检查命令的装配与有限摘要输出。输入为配置目录、游戏名和显示参数，输出已解析配置摘要或原配置错误。
 * 依次加载运行配置／板子并解析完整 setup，不创建玩家 Agent、运行对局或写回配置；显式 CLI 语言优先。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import { resolveCliConfigDirectory } from "./config-directory";

import { checkConfig } from "@ai-werewolf-arena/game-runtime/config/check";
export { checkConfig } from "@ai-werewolf-arena/game-runtime/config/check";

export { configDiagnostic } from "@ai-werewolf-arena/game-runtime/app/config/error-codes";

export async function main(
  argv = process.argv.slice(2),
  display: CliDisplayContext = { locale: "zh-CN", explicit: false },
): Promise<void> {
  const args = takeDisplayArguments(argv, display);
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (
      !["--configs-dir", "--game-config-name"].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new Error("config_check_usage");
    values[args[i]] = args[i + 1];
  }
  const result = await checkConfig(
    resolveCliConfigDirectory(values["--configs-dir"]),
    values["--game-config-name"] ?? "default",
    display,
  );
  console.log(
    JSON.stringify({ ...result, message: text(display.locale, "cli.config_checked") }, null, 2),
  );
}

if (require.main === module) void runCli(main);
