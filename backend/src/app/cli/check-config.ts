/**
 * 负责配置检查命令的装配与有限摘要输出。输入为配置目录、游戏名和显示参数，输出已解析配置摘要或原配置错误。
 * 依次加载运行配置／板子并解析完整 setup，不创建玩家 Agent、运行对局或写回配置；显式 CLI 语言优先。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./display";
import { loadRuntimeConfig } from "../config/load-config";
import { loadBoardDefinition } from "../config/load-board-definition";
import { resolveGameSetup, resolveGameBoard } from "../config/resolve-game-setup";
import { describeResolvedSetup } from "../config/describe-setup";
import { resolveCliConfigDirectory } from "./config-directory";

export async function checkConfig(
  configDir: string,
  gameName: string,
  display?: CliDisplayContext,
) {
  const runtime = await loadRuntimeConfig({ configDir, gameName });
  // Pi 静态验证放在 app 边界：纯 V2 parser 不依赖传输 SDK，检查命令也不创建 runtime／会话。
  if (Object.values(runtime.providers.items).some((provider) => provider.type === "pi")) {
    const { validatePiHostConfig, validatePiSettings } =
      await import("../../adapters/pi/native-config");
    for (const provider of Object.values(runtime.providers.items))
      if (provider.type === "pi")
        validatePiHostConfig({ models: provider.models, auth: provider.auth });
    for (const agent of Object.values(runtime.agents.items))
      if (agent.kind === "pi") validatePiSettings({ ...agent.piSettings });
  }
  const board = await loadBoardDefinition(configDir, resolveGameBoard(runtime));
  const setup = resolveGameSetup(runtime, {}, board);
  // 未显式指定语言才跟随已解析 setup；摘要函数只消费结果，不重复加载配置。
  if (display && !display.explicit) display.locale = setup.context.displayLocale;
  return describeResolvedSetup(setup, display?.locale);
}

export { configDiagnostic } from "../config/error-codes";

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
