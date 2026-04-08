import { bootstrapGame } from "./app/bootstrap";
import { sixPlayerMvpConfig } from "./scenarios/six_player_mvp";
import { BaselineBotActionProvider } from "./v3/action_providers";

async function main(): Promise<void> {
  const context = bootstrapGame(sixPlayerMvpConfig);
  const actionProvider = new BaselineBotActionProvider(context.world);

  const snapshot = await context.phaseManager.runUntilGameOver(actionProvider, 8);
  const events = context.phaseManager.getEvents();

  console.log("V3 snapshot:", snapshot);
  console.log("V3 events:", events.length);
  console.log(JSON.stringify(events.slice(-8), null, 2));
}

main().catch((error) => {
  console.error("run-test-v3 failed", error);
  throw error;
});
