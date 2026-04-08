import { runLlmGame } from "./run_llm_game";

/**
 * 双板顺序验证入口：
 * 先跑 6 人局，再跑 12 人局，便于快速对比接入 LLM 后的行为表现。
 */
async function main(): Promise<void> {
  console.log("[run_llm_dual] step 1/2 six_player_mvp");
  await runLlmGame({
    board: "six_player_mvp",
    maxDays: Number(process.env.V3_LLM_MAX_DAYS_SIX ?? "8"),
    trace: ["1", "true", "yes", "on"].includes(
      String(process.env.V3_LLM_TRACE ?? "false").toLowerCase(),
    ),
    maxRuntimeMs: Number(process.env.V3_LLM_MAX_RUNTIME_MS_SIX ?? "30000"),
    llmTimeoutMs: Number(process.env.V3_LLM_TIMEOUT_MS ?? "1200"),
    printAllEvents: false,
    printChat: false,
    streamEvents: false,
    color: ["1", "true", "yes", "on"].includes(
      String(process.env.V3_COLOR ?? "true").toLowerCase(),
    ),
    printLlmIo: false,
    printThinking: false,
    printPrivateEvents: true,
  });

  console.log("[run_llm_dual] step 2/2 twelve_player_standard");
  await runLlmGame({
    board: "twelve_player_standard",
    maxDays: Number(process.env.V3_LLM_MAX_DAYS_TWELVE ?? "10"),
    trace: ["1", "true", "yes", "on"].includes(
      String(process.env.V3_LLM_TRACE ?? "false").toLowerCase(),
    ),
    maxRuntimeMs: Number(process.env.V3_LLM_MAX_RUNTIME_MS_TWELVE ?? "30000"),
    llmTimeoutMs: Number(process.env.V3_LLM_TIMEOUT_MS ?? "1200"),
    printAllEvents: false,
    printChat: false,
    streamEvents: false,
    color: ["1", "true", "yes", "on"].includes(
      String(process.env.V3_COLOR ?? "true").toLowerCase(),
    ),
    printLlmIo: false,
    printThinking: false,
    printPrivateEvents: true,
  });
}

main().catch((error) => {
  console.error("run_llm_dual failed", error);
  throw error;
});
