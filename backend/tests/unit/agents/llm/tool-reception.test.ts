/**
 * Unit tests verify LLM native callback reception and the generic submit_action tool contract using supplied inert clients.
 * Input: Original fresh worlds, literal action requests and callback/capture/fallback clients under the same describe prefix.
 * Output and oracle: Exact native arguments, selected actions and tool schema/name assertions preserve protocol semantics; no HTTP listener or record writer runs.
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { RoleComponent } from "../../../../src/core/domain/components/role";
import { Phase } from "../../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  ToolLoopClient,
  GenericSubmitActionClient,
  CaptureToolsClient,
  FallbackProvider,
} from "../../../support/drivers/agents/llm-clients";

describe("LlmActionProvider protocol", () => {
  test("accepts a native tool callback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("speak", { text: "我是1号" }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "我是1号" },
    });
  });

  test("accepts a native vote callback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("vote", { target_id: 2, abstain: false }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Voting,
      actorId: 1,
      allowedTools: ["vote"],
      context: { day: 1, stage: "voting", visible_events: [], turn_constraints: {} },
    });

    expect(action).toEqual({
      name: "vote",
      args: { target_id: 2, abstain: false },
    });
  });

  test("accepts a native role-action callback", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const seerId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "seer",
      )!;
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("check_identity", { target_id: 2 }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Night,
      actorId: seerId,
      allowedTools: ["check_identity"],
      context: { day: 1, stage: "seer", visible_events: [], turn_constraints: {} },
    });

    expect(action).toEqual({
      name: "check_identity",
      args: { target_id: 2 },
    });
  });

  test("accepts a native speak callback without text recovery", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("speak", { text: "我应该谨慎发言，先保留态度，观察局势。" }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    });

    expect(action?.name).toBe("speak");
    expect((action as any)?.args?.text?.length).toBeGreaterThan(0);
  });

  test("passes the callback arguments through the native protocol", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new ToolLoopClient("speak", { text: "我应该谨慎发言。" }),
      {
        fallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 6,
      allowedTools: ["speak"],
      context: { day: 1, stage: "day_speech", visible_events: [], turn_constraints: {} },
    });

    expect(action?.name).toBe("speak");
    expect((action as any)?.args?.text).toBe("我应该谨慎发言。");
  });

  test("uses sdk tool loop as primary path", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const toolClient = new ToolLoopClient("speak", { text: "sdk_action" });
    const provider = new LlmActionProvider(context.world, toolClient as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    const action = await provider.getAction({
      phase: Phase.Day,
      actorId: 1,
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
      },
    });

    expect(action).toEqual({
      name: "speak",
      args: { text: "sdk_action" },
    });
  });

  test("accepts game actions through the shared submit_action contract", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(context.world, new GenericSubmitActionClient() as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await expect(
      provider.getAction({
        phase: Phase.Day,
        actorId: 1,
        allowedTools: ["speak"],
        context: {
          day: 1,
          stage: "day_speech",
          visible_events: [],
          turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        },
      }),
    ).resolves.toEqual({
      name: "speak",
      args: { text: "通过统一协议发言" },
    });
  });

  test("exposes the generic game tool contract", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const client = new CaptureToolsClient();
    const provider = new LlmActionProvider(context.world, client as any, {
      fallbackProvider: new FallbackProvider(null),
    });

    await provider.getAction({
      phase: Phase.Voting,
      actorId: 1,
      allowedTools: ["vote"],
      context: { day: 1, stage: "voting", visible_events: [], turn_constraints: {} },
    });

    expect(client.lastToolNames).toEqual(["get_game_schema", "submit_action", "report_bug"]);
    const submitTool = client.lastTools.find((tool) => tool.name === "submit_action");
    expect(submitTool?.description).toContain("accepted=true、applied=false");
    expect(submitTool?.parameters?.required).toEqual(["turn_id", "action", "arguments"]);
    expect(submitTool?.parameters?.properties?.turn_id?.type).toBe("string");
    expect(submitTool?.parameters?.properties?.action?.type).toBe("string");

    const reportBugTool = client.lastTools.find((tool) => tool.name === "report_bug");
    expect(reportBugTool?.description).toContain("明确的规则、流程、状态、日志或可见性矛盾");
    expect(reportBugTool?.parameters?.required).toEqual([
      "turn_id",
      "category",
      "severity",
      "message",
    ]);
  });
});
