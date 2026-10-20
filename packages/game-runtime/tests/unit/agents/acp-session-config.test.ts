/**
 * acp-session-config 单元测试使用内存夹具、原回调控制、显式坏变体及提供的 mock／DTO，核对决策、回合和 client 控制，不启动实体传输。原字面预期、身份快照及拒绝断言为依据，迁移不重新生成；保留支持文件、夹具字节、政策和状态行为，不运行模型。
 */
import { describe, expect, test } from "bun:test";
import * as acp from "@agentclientprotocol/sdk";
import { applyAcpSessionConfigOptions } from "../../../src/adapters/acp/acp-session-config";

function option(currentValue: boolean) {
  return {
    id: "fast-mode",
    name: "Fast mode",
    description: "faster",
    category: "model_config",
    type: "boolean" as const,
    currentValue,
  };
}

describe("applyAcpSessionConfigOptions", () => {
  test("applies an advertised boolean option through standard ACP", async () => {
    const requests: unknown[] = [];
    const client = {
      async request(_method: string, params: unknown) {
        requests.push(params);
        return { configOptions: [option(true)] };
      },
    } as acp.ClientContext;
    const session = {
      sessionId: "session-fast",
      newSessionResponse: { sessionId: "session-fast", configOptions: [option(false)] },
    } satisfies Pick<acp.ActiveSession, "sessionId" | "newSessionResponse">;

    await applyAcpSessionConfigOptions(client, session, { "fast-mode": true });

    expect(requests).toEqual([
      {
        sessionId: "session-fast",
        configId: "fast-mode",
        type: "boolean",
        value: true,
      },
    ]);
  });

  test("fails instead of silently ignoring an unsupported option", async () => {
    const session = {
      sessionId: "session-no-fast",
      newSessionResponse: { sessionId: "session-no-fast", configOptions: [] },
    } satisfies Pick<acp.ActiveSession, "sessionId" | "newSessionResponse">;

    await expect(
      applyAcpSessionConfigOptions({} as acp.ClientContext, session, { "fast-mode": true }),
    ).rejects.toThrow("acp_session_config_option_not_advertised:fast-mode");
  });
});
