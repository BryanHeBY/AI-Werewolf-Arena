import { bootstrapGame } from "../app/bootstrap";
import { sixPlayerMvpConfig } from "./scenarios/six_player_mvp";
import { BaselineBotActionProvider } from "../ai/agents/providers/action_providers";

/**
 * 本地 mock 快速回归入口：
 * 固定 6 人局 + Baseline 行为，适合作为 smoke 验证。
 */
export async function runMockGame(): Promise<void> {
  const context = bootstrapGame(sixPlayerMvpConfig);
  const actionProvider = new BaselineBotActionProvider(context.world);

  const snapshot = await context.phaseManager.runUntilGameOver(actionProvider, 8);
  const events = context.phaseManager.getEvents();

  console.log("Game snapshot:", snapshot);
  console.log("Game events:", events.length);
  console.log(JSON.stringify(events.slice(-8), null, 2));
}

async function main(): Promise<void> {
  await runMockGame();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("run_mock_game failed", error);
    throw error;
  });
}
