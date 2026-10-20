/**
 * 负责本地六人 mock 对局入口。输入为显示语言，输出为最多八天推进后的快照和事件摘要。
 * 对局使用固定板子配置和显式特权基线驱动，不调用模型；发牌仍由原开局流程执行。
 * CLI 只校验显示参数，规则结算归引擎；本入口不生成独立验收预期或写入录制档案。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./cli/display";
import { bootstrapGame } from "@ai-werewolf-arena/game-runtime/app/bootstrap";
import { sixPlayerMvpConfig } from "@ai-werewolf-arena/game-runtime/rulesets/presets/six-player-mvp";
import { BaselineBotActionProvider } from "@ai-werewolf-arena/game-runtime/agents/baseline/privileged";

/**
 * 本地 mock 快速回归入口：
 * 固定 6 人局 + Baseline 行为，适合作为 smoke 验证。
 */
export async function runMockGame(displayLocale: Locale = "zh-CN"): Promise<void> {
  const context = bootstrapGame(sixPlayerMvpConfig);
  const actionProvider = new BaselineBotActionProvider(context.world);

  const snapshot = await context.phaseManager.runUntilGameOver(actionProvider, 8);
  const events = context.phaseManager.getEvents();

  console.log(text(displayLocale, "runtime.snapshot"), snapshot);
  console.log(text(displayLocale, "runtime.mock_events"), events.length);
  console.log(JSON.stringify(events.slice(-8), null, 2));
}

export async function main(argv: string[], display: CliDisplayContext): Promise<void> {
  if (takeDisplayArguments(argv, display).length) throw new Error("runtime_cli_option_unknown");
  await runMockGame(display.locale);
}

if (require.main === module) void runCli(main);
