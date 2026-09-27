import { runMockGame } from "./runtime/run_mock_game";

runMockGame().catch((error) => {
  console.error("run-game-smoke failed", error);
  throw error;
});
