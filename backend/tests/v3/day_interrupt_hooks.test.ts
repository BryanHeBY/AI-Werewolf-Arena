import { bootstrapGame } from "../../src/app/bootstrap";
import { ActionProvider, ActionRequest, ActionWindow, Phase, ToolCall } from "../../src/domain/model";
import { DayPipeline } from "../../src/engine/phase_pipeline/day_pipeline";
import { VotingPipeline } from "../../src/engine/phase_pipeline/voting_pipeline";
import { EventRegistry } from "../../src/engine/event_registry";
import { ToolGateway } from "../../src/gateway/tool_gateway";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

function makeProviderForWindow(
  hitWindow: ActionWindow,
): ActionProvider {
  return {
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      if (request.allowedTools.includes("choose_direction")) {
        return { name: "choose_direction", args: { direction: "clockwise" } };
      }
      if (request.allowedTools.includes("speak")) {
        return { name: "speak", args: { text: `发言_${request.actorId}` } };
      }
      if (
        request.allowedTools.includes("self_destruct") &&
        request.actionWindow === hitWindow
      ) {
        return {
          name: "self_destruct",
          args: { reason: `hit_${hitWindow}`, confirm: true },
        };
      }
      return null;
    },
  };
}

describe("day interrupt hooks", () => {
  test("hook requests are dispatched in deterministic order", async () => {
    const config = {
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onDaybreak: true,
        onPreElection: true,
        onPerSpeechGap: true,
      },
      selfDestruct: {
        enabledWindows: [
          ActionWindow.OnDaybreak,
          ActionWindow.OnPreElection,
          ActionWindow.OnPerSpeechGap,
          ActionWindow.OnPreVote,
        ],
      },
    };
    const context = bootstrapGame(config);
    const events: any[] = [];
    const pipeline = new DayPipeline(context.world, new ToolGateway(), events);
    const windows: ActionWindow[] = [];

    const provider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.actionWindow) {
          windows.push(request.actionWindow);
        }
        if (request.allowedTools.includes("choose_direction")) {
          return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        if (request.allowedTools.includes("speak")) {
          return { name: "speak", args: { text: "正常发言" } };
        }
        return null;
      },
    };

    const result = await pipeline.execute(config, provider);
    const uniqueWindows = windows.filter((window, index) => {
      return index === 0 || window !== windows[index - 1];
    });
    expect(result.interrupted).toBe(false);
    expect(uniqueWindows[0]).toBe(ActionWindow.OnDaybreak);
    expect(uniqueWindows[1]).toBe(ActionWindow.OnPreElection);
    expect(uniqueWindows).toContain(ActionWindow.OnPerSpeechGap);
  });

  test("on_daybreak no longer accepts self-destruct interrupt", async () => {
    const context = bootstrapGame({
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onDaybreak: true,
      },
    });
    const events: any[] = [];
    const pipeline = new DayPipeline(context.world, new ToolGateway(), events);

    const result = await pipeline.execute(
      {
        ...twelvePlayerStandardConfig,
        hooks: {
          ...twelvePlayerStandardConfig.hooks,
          onDaybreak: true,
        },
        selfDestruct: {
          enabledWindows: [ActionWindow.OnDaybreak],
        },
      },
      makeProviderForWindow(ActionWindow.OnDaybreak),
    );

    expect(result.interrupted).toBe(false);
    expect(result.summary.speeches.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "wolf_self_destruct")).toBe(false);
  });

  test("on_pre_election no longer accepts self-destruct interrupt", async () => {
    const config = {
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onDaybreak: false,
        onPreElection: true,
      },
      selfDestruct: {
        enabledWindows: [ActionWindow.OnPreElection],
      },
    };
    const context = bootstrapGame(config);
    const events: any[] = [];
    const pipeline = new DayPipeline(context.world, new ToolGateway(), events);

    const result = await pipeline.execute(
      config,
      makeProviderForWindow(ActionWindow.OnPreElection),
    );

    expect(result.interrupted).toBe(false);
    expect(result.summary.speeches.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "wolf_self_destruct")).toBe(false);
  });

  test("on_per_speech_gap no longer accepts self-destruct interrupt", async () => {
    const config = {
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onDaybreak: false,
        onPreElection: false,
        onPerSpeechGap: true,
      },
      selfDestruct: {
        enabledWindows: [ActionWindow.OnPerSpeechGap],
      },
    };
    const context = bootstrapGame(config);
    const events: any[] = [];
    const pipeline = new DayPipeline(context.world, new ToolGateway(), events);

    const result = await pipeline.execute(
      config,
      makeProviderForWindow(ActionWindow.OnPerSpeechGap),
    );

    expect(result.interrupted).toBe(false);
    expect(result.summary.speeches.length).toBeGreaterThanOrEqual(1);
    expect(events.some((event) => event.type === "wolf_self_destruct")).toBe(false);
  });

  test("on_pre_vote can interrupt voting pipeline and jump night", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const votingPipeline = new VotingPipeline(
      context.world,
      new ToolGateway(),
      new EventRegistry(),
      events,
    );

    const result = await votingPipeline.execute(
      {
        ...twelvePlayerStandardConfig,
        hooks: {
          ...twelvePlayerStandardConfig.hooks,
          onPreVote: true,
        },
      },
      makeProviderForWindow(ActionWindow.OnPreVote),
    );

    expect(result.interrupted).toBe(true);
    expect(result.summary.target).toBeNull();
    expect(events.some((event) => event.payload.window === ActionWindow.OnPreVote)).toBe(
      true,
    );
  });
});
