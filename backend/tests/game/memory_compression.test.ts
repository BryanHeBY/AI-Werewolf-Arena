import { bootstrapGame } from "../../src/app/bootstrap";
import { ActiveContextWindow } from "../../src/ai/memory/active_context_window";
import { NotebookStore } from "../../src/ai/memory/notebook_store";
import { PromptAssembler } from "../../src/ai/memory/prompt_assembler";
import { RollingSummaryStore } from "../../src/ai/memory/rolling_summary";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";

describe("memory compression", () => {
  test("buildPromptFor triggers rolling summary when active context exceeds limit", () => {
    const { world, playerIds } = bootstrapGame(sixPlayerMvpConfig);
    const actorId = playerIds[0];
    const notebooks = new NotebookStore();
    const summaries = new RollingSummaryStore();
    const context = new ActiveContextWindow(20000);

    for (let i = 0; i < 30; i++) {
      context.push({
        actorId: playerIds[i % playerIds.length],
        text: `第${i}条发言：这是用于测试压缩策略的长文本_${"x".repeat(40)}`,
      });
    }

    const assembler = new PromptAssembler(world, notebooks, summaries, context, {
      compressionSoftLimitChars: 600,
      compressionTargetChars: 260,
      summaryMaxChars: 220,
    });

    const prompt = assembler.buildPromptFor(actorId);
    const summary = summaries.get(actorId);

    expect(summary.length).toBeGreaterThan(0);
    expect(context.totalChars()).toBeLessThanOrEqual(260);
    expect(prompt).toContain("[滚动摘要]");
    expect(prompt).toContain(summary);
  });
});
