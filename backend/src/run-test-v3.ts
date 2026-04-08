import { runMockGame } from "./scripts/run_mock_game";

/**
 * 兼容入口（保留）：
 * 旧命令仍可调用 mock 回归脚本，新的真实 LLM 入口请使用 `src/scripts/run_llm_game.ts`。
 */
runMockGame().catch((error) => {
  console.error("run-test-v3 failed", error);
  throw error;
});
