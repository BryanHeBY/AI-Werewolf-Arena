/**
 * Unit tests for acp-turn-registry; In-memory acp-turn-registry decision/turn/client control with supplied mocks or DTOs; no physical transport.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { speakRequest } from "../../support/builders/agents/acp-requests";

describe("AcpTurnRegistry", () => {
  test("rejects stale sessions and tools outside the current turn", async () => {
    const registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig).world);
    expect(registry.getSchema().tools.submit_action).toContain("turn_id");
    const pending = registry.openTurn(speakRequest(), "session-a");
    expect(pending.turnId).toBe("t1");

    expect(
      registry.submitAction("wrong-session", {
        turn_id: pending.turnId,
        action: "speak",
        arguments: { text: "x" },
      }),
    ).toEqual({
      ok: false,
      error: "turn_not_open_or_session_invalid",
      message: "本回合未开放或会话不匹配；请仅使用当前会话最新行动提示中的turn_id。",
    });
    expect(
      registry.submitAction("session-a", {
        turn_id: pending.turnId,
        action: "vote",
        arguments: { target_id: 2, abstain: false },
      }),
    ).toEqual({
      ok: false,
      error: "tool_not_allowed_in_this_turn",
      message: "该行动不在本回合允许列表中；请使用最新行动提示列出的行动。",
    });
    expect(
      registry.submitAction("session-a", {
        turn_id: pending.turnId,
        action: "speak",
        arguments: { text: "我通过 MCP 工具发言。" },
      }),
    ).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
    await expect(pending.action).resolves.toEqual({
      name: "speak",
      args: { text: "我通过 MCP 工具发言。" },
    });
    expect(
      registry.submitAction("session-a", {
        turn_id: pending.turnId,
        action: "speak",
        arguments: { text: "第二次不能生效" },
      }),
    ).toEqual({
      ok: false,
      error: "turn_not_open_or_session_invalid",
      message: "本回合未开放或会话不匹配；请仅使用当前会话最新行动提示中的turn_id。",
    });
    registry.close();
  });
});
