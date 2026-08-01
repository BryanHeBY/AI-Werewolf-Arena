import { describe, expect, test } from "bun:test";
import * as acp from "@agentclientprotocol/sdk";
import { applyAcpSessionConfigOptions } from "../../../src/ai/integrations/acp/acp_session_config";

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
    } as acp.ActiveSession;

    await applyAcpSessionConfigOptions(client, session, { "fast-mode": true });

    expect(requests).toEqual([{
      sessionId: "session-fast",
      configId: "fast-mode",
      type: "boolean",
      value: true,
    }]);
  });

  test("fails instead of silently ignoring an unsupported option", async () => {
    const session = {
      sessionId: "session-no-fast",
      newSessionResponse: { sessionId: "session-no-fast", configOptions: [] },
    } as acp.ActiveSession;

    await expect(applyAcpSessionConfigOptions(
      {} as acp.ClientContext,
      session,
      { "fast-mode": true },
    )).rejects.toThrow("acp_session_config_option_not_advertised:fast-mode");
  });
});
