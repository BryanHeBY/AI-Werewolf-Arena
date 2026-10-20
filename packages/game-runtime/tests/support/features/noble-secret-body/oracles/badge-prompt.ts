/**
 * 持有初始化提示与实际已发消息上的独立双语警徽政策字面断言。输入为实际消息、请求前缀、快照或原本地端点及显式预期，输出为原断言与拒绝诊断；各层测试沿用独立标记和已录前缀，不从生产身份、观察或板子算法生成结果预期。
 */
import { expect } from "bun:test";
import type { ReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import type { NobleWireRun } from "./wire";
/**
 * 针对真实初始化及已发送消息，使用独立的字面政策断言。
 */
export function assertNobleBadgeRules(
  run: NobleWireRun & { views: ReplayPlayerView[] },
  locale: "en" | "zh-CN",
) {
  const correct =
      locale === "en"
        ? "Badge: the deceased holder chooses an eligible living successor or destroys it"
        : "警徽：死亡持有者选择合格活人继任或撕毁",
    wrong =
      locale === "en"
        ? "The former sheriff has no action to choose a recipient."
        : "不提供原警长自行选择移交目标的行动。";
  const check = (prompt: unknown) => {
    expect(typeof prompt).toBe("string");
    expect(prompt as string).toContain(correct);
    expect(prompt as string).not.toContain(wrong);
  };
  for (const view of run.views) check(view.initial_prompt?.prompt_system);
  for (const wire of run.sdkWireMessages) {
    const system = (wire.messages as Array<{ role: string; content: unknown }>).filter(
      (m) => m.role === "system",
    );
    expect(system).toHaveLength(1);
    check(system[0]!.content);
  }
  for (const { trace } of run.acpTraces) check(trace.prompts[0]);
}
