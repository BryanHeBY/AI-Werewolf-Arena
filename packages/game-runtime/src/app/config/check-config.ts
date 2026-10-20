/**
 * 负责配置检查用例的读取、原生能力校验与摘要形成。输入为明确目录和游戏名，输出已解析 setup 摘要。
 * CLI 和工作台共同调用此用例；它不输出终端、不修改文件，也不创建玩家或启动对局。
 */
import { loadRuntimeConfig } from "./load-config";
import { validateRuntimeNativeConfig } from "./validate-runtime-config";
import { loadBoardDefinition } from "./load-board-definition";
import { resolveGameSetup, resolveGameBoard } from "./resolve-game-setup";
import { describeResolvedSetup } from "./describe-setup";
import type { Locale } from "@ai-werewolf-arena/game-text";
export async function checkConfig(
  configDir: string,
  gameName: string,
  display?: { locale: Locale; explicit: boolean },
) {
  const runtime = await loadRuntimeConfig({ configDir, gameName });
  // 检查命令与工作台候选文档复用同一能力校验；纯 parser 不依赖传输 SDK。
  await validateRuntimeNativeConfig(runtime);
  const board = await loadBoardDefinition(configDir, resolveGameBoard(runtime));
  const setup = resolveGameSetup(runtime, {}, board);
  // 未显式指定语言才跟随已解析 setup；摘要函数只消费结果，不重复加载配置。
  if (display && !display.explicit) display.locale = setup.context.displayLocale;
  return describeResolvedSetup(setup, display?.locale);
}

export { configDiagnostic } from "./error-codes";
