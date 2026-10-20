/**
 * 不发真实模型请求的 LLM 测试驱动将调用方行动脚本交给原 client 回调；输入为字面输出、工具参数及调用方消息断言，输出保留原回调轨迹、捕获消息和重试／错误状态。固定协议断言仍为字面值，调用方拥有玩法预期及录制；导入时不发 SDK 请求，不运行网络、模型或游戏。
 */
import { expect } from "bun:test";
import {
  PotionType,
  type ActionProvider,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain";

export const REQUIRED_ACTION_CONSTRAINTS = {
  min_valid_actions: 1,
  max_valid_actions: 1,
};

export class AssertClient {
  constructor(
    private readonly output: string,
    private readonly assertFn: (messages: Array<{ role: string; content: string }>) => void,
  ) {}

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    this.assertFn(messages);
    return this.output;
  }

  async runToolLoop<T>(
    messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    this.assertFn(messages);
    const invocation = JSON.parse(this.output) as { name: string; args: Record<string, unknown> };
    const handled = await callbacks.onToolCall({
      id: "assert_tool",
      name: invocation.name,
      args: invocation.args,
      rawArgs: this.output,
    });
    return { finalAction: (handled.finalAction ?? null) as T | null, assistantText: "assert_tool" };
  }
}

export class ToolLoopClient {
  public lastMessages: Array<{ role: string; content: string }> = [];

  constructor(
    private readonly toolName: string,
    private readonly args: Record<string, unknown>,
  ) {}

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    this.lastMessages = messages;
    const handled = await callbacks.onToolCall({
      id: "tool_1",
      name: this.toolName,
      args: this.args,
      rawArgs: JSON.stringify(this.args),
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "sdk_tool_loop_assistant",
    };
  }
}

export class NoActionToolLoopClient {
  public lastMessages: Array<{ role: string; content: string }> = [];

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    _callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    this.lastMessages = messages;
    return { finalAction: null, assistantText: "tool_loop_finished_without_action" };
  }
}

export class GenericSubmitActionClient {
  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    messages: Array<{ role: string; content: string }>,
    tools: Array<{ name: string }>,
    callbacks: any,
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    expect(tools.map((tool) => tool.name)).toEqual([
      "get_game_schema",
      "submit_action",
      "report_bug",
    ]);
    const turnId = messages.at(-1)?.content.match(/turn_id 必须为 (t\d+)/)?.[1];
    expect(turnId).toBeTruthy();
    const handled = await callbacks.onToolCall({
      id: "generic-submit",
      name: "submit_action",
      args: {
        turn_id: turnId,
        action: "speak",
        arguments: { text: "通过统一协议发言" },
      },
      rawArgs: "{}",
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "",
    };
  }
}

export class InvalidPotionThenNoneToolLoopClient {
  public lastMessages: Array<{ role: string; content: string }> = [];
  public invalidPotionResult: Record<string, unknown> | string | undefined;

  constructor(private readonly targetId: number = 2) {}

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    this.lastMessages = messages;
    const invalid = await callbacks.onToolCall({
      id: "tool_heal_1",
      name: "use_potion",
      args: { target_id: this.targetId, potion_type: PotionType.Heal },
      rawArgs: JSON.stringify({ target_id: this.targetId, potion_type: PotionType.Heal }),
    });
    this.invalidPotionResult = invalid.toolResult;
    const valid = await callbacks.onToolCall({
      id: "tool_none_1",
      name: "use_potion",
      args: { target_id: this.targetId, potion_type: PotionType.None },
      rawArgs: JSON.stringify({ target_id: this.targetId, potion_type: PotionType.None }),
    });
    return {
      finalAction: (valid.finalAction ?? null) as T | null,
      assistantText: "invalid_potion_then_none",
    };
  }
}

export class CaptureToolsClient {
  public lastToolNames: string[] = [];
  public lastTools: Array<{ name: string; description?: string; parameters?: any }> = [];
  public lastOptions: { toolChoice?: "auto" | "required" } | undefined;

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    _messages: Array<{ role: string; content: string }>,
    tools: Array<{ name: string; description?: string; parameters?: any }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
    options?: { toolChoice?: "auto" | "required" },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    this.lastTools = tools;
    this.lastToolNames = tools.map((tool) => tool.name);
    this.lastOptions = options;
    const handled = await callbacks.onToolCall({
      id: "tool_1",
      name: "speak",
      args: { text: "capture_tools" },
      rawArgs: '{"text":"capture_tools"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "capture_tools_assistant",
    };
  }
}

export class FailOnceThenSpeakToolLoopClient {
  private failed = false;

  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    _messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    if (!this.failed) {
      this.failed = true;
      throw new Error("simulated_runtime_error_once");
    }
    const handled = await callbacks.onToolCall({
      id: "tool_retry_1",
      name: "speak",
      args: { text: "retry_success" },
      rawArgs: '{"text":"retry_success"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "retry_assistant",
    };
  }
}

export class ReportThenSpeakToolLoopClient {
  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    _messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    await callbacks.onToolCall({
      id: "tool_bug_1",
      name: "report_bug",
      args: {
        category: "flow",
        severity: "high",
        message: "测试：白痴翻牌日志未显示",
      },
      rawArgs: '{"category":"flow","severity":"high","message":"测试：白痴翻牌日志未显示"}',
    });
    const handled = await callbacks.onToolCall({
      id: "tool_speak_1",
      name: "speak",
      args: { text: "继续发言" },
      rawArgs: '{"text":"继续发言"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "report_then_speak",
    };
  }
}

export class DuplicateReportThenSpeakToolLoopClient {
  async chat(): Promise<string> {
    return "";
  }

  async runToolLoop<T>(
    _messages: Array<{ role: string; content: string }>,
    _tools: Array<{ name: string }>,
    callbacks: {
      onToolCall: (invocation: {
        id: string;
        name: string;
        args: Record<string, unknown>;
        rawArgs: string;
      }) => Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
  ): Promise<{ finalAction: T | null; assistantText: string }> {
    await callbacks.onToolCall({
      id: "tool_bug_1",
      name: "report_bug",
      args: {
        category: "flow",
        severity: "high",
        message: "测试：白天流程异常",
      },
      rawArgs: '{"category":"flow","severity":"high","message":"测试：白天流程异常"}',
    });
    await callbacks.onToolCall({
      id: "tool_bug_2",
      name: "report_bug",
      args: {
        category: "flow",
        severity: "high",
        message: "测试：白天流程异常",
      },
      rawArgs: '{"category":"flow","severity":"high","message":"测试：白天流程异常"}',
    });
    const handled = await callbacks.onToolCall({
      id: "tool_speak_1",
      name: "speak",
      args: { text: "继续发言" },
      rawArgs: '{"text":"继续发言"}',
    });
    return {
      finalAction: (handled.finalAction ?? null) as T | null,
      assistantText: "duplicate_report_then_speak",
    };
  }
}

export class FallbackProvider implements ActionProvider {
  constructor(private readonly action: ToolCall | null) {}

  async getAction(_request: ActionRequest): Promise<ToolCall | null> {
    return this.action;
  }
}
