/**
 * 单元测试验证每次调用独立的显示语言、安全错误标签、观察输出及内置策略语言行为。
 * 输入为原字面请求／发言、本地输出捕获和固定角色的双语开局；手写角色／工具标签与
 * 动作／文本比较是预期，原文保持，不运行 CLI 子进程、录制文件或完整对局。
 */
import { expect, test } from "bun:test";
import { type Locale } from "@ai-werewolf-arena/game-text";
import { cliFailure, takeDisplayArguments } from "../../../src/app/cli/display";
import { LlmOutputRecorder } from "../../../src/agents/llm/llm-output-recorder";
import { PlayerOutputObserver } from "../../../src/agents/player/player-observer";
import { createAcpConsoleLogger } from "../../../src/adapters/console/console-presenter";
import { BaselineBotActionProvider } from "../../../src/agents/baseline/privileged";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { Phase, Role, type ActionRequest } from "../../../src/domain";

const speech = "Original 原话 {role} <b>quoted</b>";

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

test("each CLI invocation owns display selection and safe failure explanation", () => {
  const first = { locale: "zh-CN" as Locale, explicit: false },
    second = { locale: "zh-CN" as Locale, explicit: false };
  expect(takeDisplayArguments(["--display-locale", "en", "--board", "six"], first)).toEqual([
    "--board",
    "six",
  ]);
  expect(first).toEqual({ locale: "en", explicit: true });
  expect(second.locale).toBe("zh-CN");
  expect(() => takeDisplayArguments(["--display-locale", "credential-canary"], second)).toThrow(
    "runtime_cli_locale_invalid",
  );
  for (const locale of ["zh-CN", "en"] as const) {
    for (const code of ["reproduction_schema_not_supported", "reproduction_record_invalid"]) {
      const failure = cliFailure(new Error(code), locale);
      expect(failure.code).toBe(code);
      expect(failure.message).toContain(
        locale === "en" ? "Action reproduction failed" : "动作回放失败",
      );
    }
    const foreign = Object.defineProperty(new Error(), "message", {
      get() {
        throw new Error("credential-canary");
      },
    });
    expect(JSON.stringify(cliFailure(foreign, locale))).not.toContain("credential-canary");
    expect(cliFailure(new Error("reproduction_credential_canary"), locale).code).toBe(
      "command_failed",
    );
  }
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: observation labels preserve message roles, tools and original content`, () => {
    const lines: string[] = [],
      before = console.log;
    console.log = (...values) => {
      lines.push(values.join(" "));
    };
    const observer = new PlayerOutputObserver({
      trace: true,
      locale,
      printLlmIo: true,
      printThinking: true,
      colorizeLogs: false,
    });
    try {
      observer.prompt(
        [
          { role: "system", content: speech },
          { role: "tool", content: speech },
          { role: "developer", content: speech } as never,
        ],
        request,
      );
      observer.trace("request_start player=1 phase=day");
      const sdkOutputs = new LlmOutputRecorder(observer);
      sdkOutputs.rawResponse(speech, request);
      sdkOutputs.thinking(
        [
          {
            assistantText: speech,
            toolCalls: [
              {
                id: "c1",
                name: "submit_action",
                rawArgs: JSON.stringify({ text: speech }),
                toolResult: '{"ok":true}',
              },
            ],
          },
        ],
        request,
      );
      const acp = createAcpConsoleLogger(1, (line) => lines.push(line), locale);
      acp({ sessionUpdate: "agent_thought_chunk", content: { text: speech } });
      acp({ sessionUpdate: "tool_call", toolCallId: "c1", title: "submit_action" });
      acp({ sessionUpdate: "tool_call_update", toolCallId: "c1", status: "completed" });
      acp.flush();
    } finally {
      console.log = before;
    }
    expect(lines.join("\n")).toContain(speech);
    expect(lines.join("\n")).toContain("prompt_tool");
    expect(lines.join("\n")).toContain("prompt_developer · developer");
    expect(lines.join("\n")).toContain("phase=day");
    expect(lines.join("\n")).toContain("submit_action");
    expect(lines.join("\n")).toContain(locale === "en" ? "Tool feedback" : "工具反馈");
    expect(lines.join("\n")).toContain(locale === "en" ? "Tool call completed" : "工具调用完成");
  });

test("baseline builtin speech follows game locale while targets and skill decisions stay equivalent", async () => {
  const options = {
    fixedRoles: [Role.Wolf, Role.Seer, Role.Wolf, Role.Guard, Role.Villager, Role.Villager],
  };
  const zh = new BaselineBotActionProvider(
    bootstrapGame(sixPlayerMvpConfig, { ...options, locale: "zh-CN" }).world,
  );
  const en = new BaselineBotActionProvider(
    bootstrapGame(sixPlayerMvpConfig, { ...options, locale: "en" }).world,
  );
  expect(await zh.getAction(request)).toEqual({
    name: "speak",
    args: { text: "我是1号，先听后位发言再判断。" },
  });
  expect(await en.getAction(request)).toEqual({
    name: "speak",
    args: { text: "I am player 1; I will listen to the remaining speakers before deciding." },
  });
  expect(
    await en.getAction({ ...request, context: { ...request.context, trigger: "last_words" } }),
  ).toEqual({
    name: "speak",
    args: { text: "Last words: I am player 1; use my final information as a reference." },
  });
  const chat = { ...request, phase: Phase.Night, allowedTools: ["speak_to_wolves"] as const };
  expect(await en.getAction({ ...chat, allowedTools: [...chat.allowedTools] })).toEqual({
    name: "speak_to_wolves",
    args: { text: "Prioritize an information role for tonight’s kill.", end_chat: false },
  });
  for (const allowedTools of [
    ["kill_vote"],
    ["choose_direction"],
    ["run_for_sheriff"],
    ["vote"],
  ] as const) {
    const turn = {
      ...request,
      phase: allowedTools[0] === "vote" ? Phase.Voting : Phase.Night,
      allowedTools: [...allowedTools],
    };
    expect(await zh.getAction(turn)).toEqual(await en.getAction(turn));
  }
});
