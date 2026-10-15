/**
 * Unit tests for acp-session-config; In-memory acp-session-config decision/turn/client control with supplied mocks or DTOs; no physical transport.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
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
