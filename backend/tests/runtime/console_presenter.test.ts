import { describe, expect, test } from "bun:test";
import { createAcpConsoleLogger } from "../../src/runtime/console_presenter";

function chunk(kind: "thought" | "message", text: string, messageId?: string) {
  return { sessionUpdate: `agent_${kind}_chunk`, content: { type: "text", text }, messageId };
}

describe("ACP console text", () => {
  test("token deltas and complete chunks produce the same lines", () => {
    const text = "我是11号，先等待行动提示。\n不要泄露身份。";
    const render = (chunks: string[]) => {
      const lines: string[] = [];
      const logger = createAcpConsoleLogger(11, line => lines.push(line));
      for (const text of chunks) logger(chunk("thought", text));
      logger(chunk("message", "已就绪，等待行动提示。"));
      logger.flush();
      logger.flush();
      return lines;
    };
    const expected = [
      "[acp][11][thought] 我是11号，先等待行动提示。",
      "[acp][11][thought] 不要泄露身份。",
      "[acp][11][message] 已就绪，等待行动提示。",
    ];
    expect(render([text])).toEqual(expected);
    expect(render(Array.from(text))).toEqual(expected);
  });

  test("flushes text before tools and when the message id changes", () => {
    const lines: string[] = [];
    const logger = createAcpConsoleLogger(8, line => lines.push(line));
    logger(chunk("thought", "准备调用工具"));
    logger(chunk("message", "第一条", "m1"));
    logger(chunk("message", "第二条", "m2"));
    logger({ sessionUpdate: "tool_call", toolCallId: "call1", rawInput: { server: "werewolf-game", tool: "submit_action" } });
    logger({ sessionUpdate: "tool_call_update", toolCallId: "call1", status: "completed" });
    expect(lines).toEqual([
      "[acp][8][thought] 准备调用工具",
      "[acp][8][message] 第一条",
      "[acp][8][message] 第二条",
      "[acp][8][tool] start werewolf-game.submit_action",
      "[acp][8][tool] completed werewolf-game.submit_action",
    ]);
  });

  test("bounds long text without truncating it or breaking Unicode", () => {
    const lines: string[] = [];
    const logger = createAcpConsoleLogger(1, line => lines.push(line));
    const text = `${"字".repeat(499)}😀${"长".repeat(1100)}尾`;
    logger(chunk("thought", text));
    expect(lines.length).toBeGreaterThan(0);
    logger.flush();
    const parts = lines.map(line => line.replace("[acp][1][thought] ", ""));
    expect(parts.join("")).toBe(text);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(500);
      expect(part.isWellFormed()).toBe(true);
    }
  });

  test("prints tool state changes once and suppresses content refinements", () => {
    const lines: string[] = [];
    const logger = createAcpConsoleLogger(10, line => lines.push(line));
    const update = (fields: Record<string, unknown>) => logger({
      sessionUpdate: "tool_call_update", toolCallId: "call1", ...fields,
    });
    logger({ sessionUpdate: "tool_call", toolCallId: "call1", title: "mcp__werewolf-game__submit_action", status: "pending" });
    update({ rawInput: { action: "speak" } });
    update({ content: [{ type: "text", text: "input changed" }] });
    update({ status: "pending" });
    update({ status: "in_progress" });
    update({ status: "in_progress" });
    update({ rawOutput: { accepted: true } });
    update({ status: "completed" });
    update({ status: "completed" });
    expect(lines).toEqual([
      "[acp][10][tool] start mcp__werewolf-game__submit_action",
      "[acp][10][tool] in_progress mcp__werewolf-game__submit_action",
      "[acp][10][tool] completed mcp__werewolf-game__submit_action",
    ]);
  });

  test("reports safe error metadata and distinguishes separate calls to the same tool", () => {
    const lines: string[] = [];
    const logger = createAcpConsoleLogger(10, line => lines.push(line));
    logger({ sessionUpdate: "tool_call", toolCallId: "call1", title: "submit_action" });
    logger({ sessionUpdate: "tool_call_update", toolCallId: "call1", error: { text: "permission denied" } });
    logger({ sessionUpdate: "tool_call_update", toolCallId: "call1", error: { text: "permission denied" } });
    logger({ sessionUpdate: "tool_call_update", toolCallId: "call1", status: "failed" });
    logger({ sessionUpdate: "tool_call", toolCallId: "call2", title: "submit_action" });
    logger({ sessionUpdate: "tool_call_update", toolCallId: "call2", status: "completed" });
    logger.flush();
    // Session reuse must not suppress a new prompt that reuses a tool call id.
    logger({ sessionUpdate: "tool_call", toolCallId: "call1", title: "submit_action" });
    logger({ sessionUpdate: "tool_call_update", toolCallId: "call1", status: "completed" });
    expect(lines).toEqual([
      "[acp][10][tool] start submit_action",
      '[acp][10][tool] error submit_action error={"code":"transport_error","message":"请求或运行操作失败。"}',
      "[acp][10][tool] failed submit_action",
      "[acp][10][tool] start submit_action",
      "[acp][10][tool] completed submit_action",
      "[acp][10][tool] start submit_action",
      "[acp][10][tool] completed submit_action",
    ]);
  });

  test("keeps players and prompt tails separate", () => {
    const lines: string[] = [];
    const first = createAcpConsoleLogger(1, line => lines.push(line));
    const second = createAcpConsoleLogger(2, line => lines.push(line));
    first(chunk("thought", "玩家一"));
    second(chunk("thought", "玩家二"));
    second.flush();
    first.flush();
    first(chunk("message", "下一回合"));
    first.flush();
    expect(lines).toEqual([
      "[acp][2][thought] 玩家二",
      "[acp][1][thought] 玩家一",
      "[acp][1][message] 下一回合",
    ]);
  });
});
