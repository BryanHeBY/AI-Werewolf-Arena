/**
 * 负责统一 Agent 输出端口的单元测试。输入为 LLM、ACP、Pi 真实转换入口和局部捕获消费者。
 * 预期由独立字面原文、玩家身份、私有标记和色调给出，验证显示关闭后仍可录制以及显示失败后的去重。
 * 不启动模型、进程或完整游戏，原回合权限不在本测试中重建。
 */
import { expect, test } from "bun:test";
import {
  agentOutputToDeltaMessages,
  type AgentOutputEvent,
} from "@ai-werewolf-arena/replay-contract";
import { createAcpOutputObserver } from "../../../src/adapters/acp/acp-output";
import { createPiOutputObserver } from "../../../src/adapters/pi/pi-output";
import { createAgentConsoleSink } from "../../../src/adapters/console/agent-console-presenter";
import { LlmObserver } from "../../../src/agents/player/player-observer";
import { Phase, type ActionRequest } from "../../../src/domain";

test("相同消费者接收 LLM、ACP、Pi 输出，关闭显示仍保留所有私有事实", () => {
  const events: AgentOutputEvent[] = [],
    lines: string[] = [];
  const consoleSink = createAgentConsoleSink({
    printThinking: false,
    printLlmIo: false,
    trace: false,
    log: (line) => lines.push(line),
  });
  const sink = (event: AgentOutputEvent) => {
    events.push(event);
    consoleSink(event);
  };
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
  new LlmObserver({
    printThinking: false,
    printLlmIo: false,
    trace: false,
    outputSink: sink,
  }).thinking([{ assistantText: "SDK output", toolCalls: [] }], request);
  const acp = createAcpOutputObserver({ transport: "acp", playerId: 2 }, sink);
  for (const text of ["原", "始", "思考"])
    acp.update({ sessionUpdate: "agent_thought_chunk", content: { text } });
  acp.flush();
  const pi = createPiOutputObserver({ transport: "pi", playerId: 3 }, sink);
  pi.update({ type: "thinking", text: "原始思考", partial: true, blockId: "1:0" });
  pi.update({ type: "thinking", text: "", partial: false, blockId: "1:0" });
  expect(events.map((event) => event.context.playerId)).toEqual([1, 2, 3]);
  expect(events.every((event) => event.visibility === "private")).toBe(true);
  expect(lines).toEqual([]);
  expect(
    agentOutputToDeltaMessages(events.map((event) => event.output)).map(
      (message) => message.content,
    ),
  ).toEqual(["SDK output", "原始思考", "原始思考"]);
  const tones: string[] = [];
  const display = createAgentConsoleSink({
    printThinking: true,
    printLlmIo: false,
    trace: false,
    log: (_line, tone) => tones.push(tone!),
  });
  events.forEach(display);
  expect(tones).toEqual(["muted", "muted", "muted"]);
});

test("玩家间缓冲独立，显示异常不会重复已经发送的文本块", () => {
  let calls = 0;
  const pi = createPiOutputObserver({ transport: "pi", playerId: 1 }, () => {
    calls++;
    throw new Error("display_failed");
  });
  pi.update({ type: "thinking", text: "private", partial: true, blockId: "x" });
  expect(() => pi.update({ type: "thinking", text: "", partial: false, blockId: "x" })).toThrow(
    "display_failed",
  );
  pi.flush();
  expect(calls).toBe(1);
});

test("默认终端只打印一次工具结果，完整开始／结束仍进入结构化输出与录制", () => {
  const events: AgentOutputEvent[] = [],
    lines: string[] = [];
  const display = createAgentConsoleSink({
    printThinking: true,
    printLlmIo: false,
    trace: false,
    log: (line) => lines.push(line),
  });
  const pi = createPiOutputObserver({ transport: "pi", playerId: 1 }, (event) => {
    events.push(event);
    display(event);
  });
  pi.update({ type: "tool_start", id: "one", name: "submit_action", args: { turn_id: "t1" } });
  pi.update({
    type: "tool_end",
    id: "one",
    name: "submit_action",
    result: { ok: true, applied: false },
    isError: false,
  });
  expect(lines).toEqual(["[pi][1][tool] completed submit_action · 工具调用完成"]);
  expect(events.map((event) => event.output.type)).toEqual(["tool", "tool"]);
  expect(
    agentOutputToDeltaMessages(events.map((event) => event.output)).map((message) => message.kind),
  ).toEqual(["tool_call", "tool_result"]);
});

test("SDK 录制保留完整原文并与可变显示消费者隔离，取走后不串到下一轮", () => {
  const original = "原文".repeat(6000);
  const observer = new LlmObserver({
    printThinking: false,
    printLlmIo: false,
    trace: false,
    outputSink: (event) => {
      if (event.output.type === "tool" && event.output.args) event.output.args.text = "mutated";
    },
  });
  const request: ActionRequest = {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
  observer.thinking(
    [
      {
        assistantText: original,
        toolCalls: [
          {
            id: "c1",
            name: "submit_action",
            rawArgs: '{"text":"safe"}',
            toolResult: '{"ok":true,"applied":false}',
          },
        ],
      },
    ],
    request,
  );
  const facts = observer.takeOutputs(request);
  expect(facts[0]).toMatchObject({ type: "text", text: original });
  expect(facts[1]).toMatchObject({ type: "tool", args: { text: "safe" } });
  expect(observer.takeOutputs(request)).toEqual([]);
});

test("ACP 结束后补充工具结果会进入档案，终端仍只显示一行", () => {
  const events: AgentOutputEvent[] = [],
    lines: string[] = [];
  const display = createAgentConsoleSink({
    printThinking: true,
    printLlmIo: false,
    trace: false,
    log: (line) => lines.push(line),
  });
  const observer = createAcpOutputObserver({ transport: "acp", playerId: 2 }, (event) => {
    events.push(event);
    display(event);
  });
  observer.update({ sessionUpdate: "tool_call", toolCallId: "c2", title: "submit_action" });
  observer.update({ sessionUpdate: "tool_call_update", toolCallId: "c2", status: "completed" });
  observer.update({
    sessionUpdate: "tool_call_update",
    toolCallId: "c2",
    rawOutput: { ok: true, applied: false },
  });
  const delta = agentOutputToDeltaMessages(events.map((event) => event.output));
  expect(lines).toHaveLength(1);
  expect(delta.at(-1)).toMatchObject({
    call_id: "c2",
    status: "updated",
    result: { ok: true, applied: false },
  });
});

test("三种传输的自爆警示即使关闭详细输出也可见，工具正文迟到只提示一次", () => {
  const warning = {
    ok: true,
    accepted: false,
    applied: false,
    status: "confirmation_required",
    confirmation_id: "private-id",
    action: "self_destruct",
    arguments: { reason: "占位", confirm: true },
    warning: "警告：尚未选定，自爆不是跳过。",
  };
  for (const transport of ["llm", "acp", "pi"] as const) {
    const lines: string[] = [],
      tones: string[] = [];
    const display = createAgentConsoleSink({
      printThinking: false,
      printLlmIo: false,
      trace: false,
      log: (line, tone) => {
        lines.push(line);
        tones.push(tone!);
      },
    });
    const context = { transport, playerId: 8 };
    const result =
      transport === "llm"
        ? JSON.stringify(warning)
        : { content: [{ type: "text", text: JSON.stringify(warning) }] };
    display({
      visibility: "private",
      context,
      output: {
        type: "tool",
        id: "proposal",
        name: "mcp__werewolf-game__submit_action",
        status: "completed",
        result,
      },
    });
    display({
      visibility: "private",
      context,
      output: {
        type: "tool",
        id: "proposal",
        name: "mcp__werewolf-game__submit_action",
        status: "updated",
        result,
      },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("需要二次确认");
    expect(lines[0]).toContain("不是跳过");
    expect(lines[0]).toContain('"confirm":true');
    expect(tones).toEqual(["warn"]);
    display({
      visibility: "private",
      context,
      output: {
        type: "tool",
        id: "confirm",
        name: "submit_action",
        status: "completed",
        result: {
          ok: true,
          accepted: true,
          applied: false,
          status: "confirmed",
          action: "self_destruct",
        },
      },
    });
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("已二次确认（尚未生效）");
    // 引擎在回合收尾补齐相同回执，不能把早已展示的警示再次打印。
    display({
      visibility: "private",
      context,
      output: {
        type: "tool",
        id: "engine-copy",
        name: "submit_action",
        status: "completed",
        result,
      },
    });
    expect(lines).toHaveLength(2);
  }
});

test("普通工具终端只显示名称和状态，三种传输的结构化事实仍保留参数", () => {
  const outputs: AgentOutputEvent[] = [],
    args = {
      turn_id: "t1",
      action: "speak_to_wolves",
      arguments: { text: "真实提交", end_chat: true },
    };
  const pi = createPiOutputObserver({ transport: "pi", playerId: 8 }, (event) =>
    outputs.push(event),
  );
  pi.update({ type: "tool_start", id: "one", name: "submit_action", args });
  pi.update({
    type: "tool_end",
    id: "one",
    name: "submit_action",
    result: { ok: true },
    isError: false,
  });
  const acp = createAcpOutputObserver({ transport: "acp", playerId: 8 }, (event) =>
    outputs.push(event),
  );
  acp.update({
    sessionUpdate: "tool_call",
    toolCallId: "one",
    title: "submit_action",
    rawInput: args,
  });
  acp.update({ sessionUpdate: "tool_call_update", toolCallId: "one", status: "completed" });
  outputs.push({
    visibility: "private",
    context: { transport: "llm", playerId: 8 },
    output: {
      type: "tool",
      id: "one",
      name: "submit_action",
      status: "completed",
      args,
      result: JSON.stringify({
        ok: true,
        accepted: true,
        action: "speak_to_wolves",
        arguments: args.arguments,
      }),
    },
  });
  const lines: string[] = [],
    display = createAgentConsoleSink({
      printThinking: true,
      printLlmIo: false,
      trace: false,
      log: (line) => lines.push(line),
    });
  outputs.forEach(display);
  expect(lines).toHaveLength(3);
  for (const line of lines) {
    expect(line).toContain("completed");
    expect(line).toContain("submit_action");
    expect(line).toContain("工具调用完成");
    expect(line).not.toContain("真实提交");
    expect(line).not.toContain("speak_to_wolves");
    expect(line).not.toContain("end_chat");
    expect(line).not.toContain("args=");
    expect(line).not.toContain("result=");
  }
  const completed = outputs.filter(
    (event) => event.output.type === "tool" && event.output.status === "completed",
  );
  expect(
    completed.every(
      (event) =>
        event.output.type === "tool" && JSON.stringify(event.output.args) === JSON.stringify(args),
    ),
  ).toBe(true);
  const archived = agentOutputToDeltaMessages(outputs.map((event) => event.output));
  expect(archived.filter((message) => message.kind === "tool_result")).toHaveLength(3);
  expect(JSON.stringify(archived)).toContain("真实提交");
});
