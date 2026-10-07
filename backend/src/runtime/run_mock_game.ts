import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { runCli, takeDisplayArguments, type CliDisplayContext } from "./cli/display";
import { bootstrapGame } from "../app/bootstrap";
import { sixPlayerMvpConfig } from "./scenarios/six_player_mvp";
import { BaselineBotActionProvider } from "../ai/agents/providers/action_providers";

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
