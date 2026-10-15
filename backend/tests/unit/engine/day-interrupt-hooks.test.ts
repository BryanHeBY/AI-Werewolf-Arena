/**
 * 单元测试以内存请求及显式启用标志为输入，用字面分派顺序和接受的自爆窗口核对各声明边界的日间中断 hook。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  ActionProvider,
  ActionRequest,
  ActionWindow,
  Phase,
  ToolCall,
} from "../../../src/domain/model";
import { DayPipeline } from "../../../src/engine/phases/day-pipeline";
import { VotingPipeline } from "../../../src/engine/phases/voting-pipeline";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { createDefaultRoleRegistry } from "../../../src/rulesets/mechanism-api";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";

function makeProviderForWindow(hitWindow: ActionWindow): ActionProvider {
  return {
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      if (request.allowedTools.includes("choose_direction")) {
        return { name: "choose_direction", args: { direction: "clockwise" } };
      }
      if (request.allowedTools.includes("speak")) {
        return { name: "speak", args: { text: `发言_${request.actorId}` } };
      }
      if (request.allowedTools.includes("self_destruct") && request.actionWindow === hitWindow) {
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
    const pipeline = new DayPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });
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

    const result = await pipeline.execute(config, provider, { day: 1 });
    const uniqueWindows = windows.filter((window, index) => {
      return index === 0 || window !== windows[index - 1];
    });
    expect(result.interrupted).toBe(false);
    expect(uniqueWindows[0]).toBe(ActionWindow.OnPreElection);
    expect(uniqueWindows[1]).toBe(ActionWindow.OnDaybreak);
    expect(uniqueWindows).toContain(ActionWindow.OnPerSpeechGap);
  });

  test("on_daybreak accepts self-destruct only when explicitly enabled", async () => {
    const context = bootstrapGame({
      ...twelvePlayerStandardConfig,
      hooks: {
        ...twelvePlayerStandardConfig.hooks,
        onDaybreak: true,
      },
    });
    const events: any[] = [];
    const pipeline = new DayPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });

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
      { day: 1 },
    );

    expect(result.interrupted).toBe(true);
    expect(result.summary.speeches).toEqual([]);
    expect(result.summary.selfDestructBy).not.toBeNull();
    expect(events.filter((event) => event.type === "wolf_self_destruct")).toHaveLength(0);
  });

  test("on_pre_election accepts self-destruct only when explicitly enabled", async () => {
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
    const pipeline = new DayPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });

    const result = await pipeline.execute(
      config,
      makeProviderForWindow(ActionWindow.OnPreElection),
      { day: 1 },
    );

    expect(result.interrupted).toBe(true);
    expect(result.summary.speeches).toEqual([]);
    expect(result.summary.selfDestructBy).not.toBeNull();
    expect(events.filter((event) => event.type === "wolf_self_destruct")).toHaveLength(0);
  });

  test("on_per_speech_gap accepts self-destruct only when explicitly enabled", async () => {
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
    const pipeline = new DayPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });

    const result = await pipeline.execute(
      config,
      makeProviderForWindow(ActionWindow.OnPerSpeechGap),
      { day: 1 },
    );

    expect(result.interrupted).toBe(true);
    expect(result.summary.speeches.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.selfDestructBy).not.toBeNull();
    expect(events.filter((event) => event.type === "wolf_self_destruct")).toHaveLength(0);
  });

  test("on_pre_vote can interrupt voting pipeline and jump night", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const votingPipeline = new VotingPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      eventRegistry: new EventRegistry(),
      events,
    });

    const result = await votingPipeline.execute(
      {
        ...twelvePlayerStandardConfig,
        hooks: {
          ...twelvePlayerStandardConfig.hooks,
          onPreVote: true,
        },
      },
      makeProviderForWindow(ActionWindow.OnPreVote),
      { day: 1 },
    );

    expect(result.interrupted).toBe(true);
    expect(result.summary.target).toBeNull();
    expect(result.removed).toHaveLength(1);
    expect(events.some((event) => event.type === "wolf_self_destruct")).toBe(false);
  });

  test("an explicitly empty self-destruct window performs voting without requesting self-destruct", async () => {
    const config = { ...twelvePlayerStandardConfig, selfDestruct: { enabledWindows: [] } };
    const { world } = bootstrapGame(config);
    const events: any[] = [];
    const requests: ActionRequest[] = [];
    const pipeline = new VotingPipeline({
      world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      eventRegistry: new EventRegistry(),
      events,
    });
    const result = await pipeline.execute(
      config,
      {
        async getAction(request) {
          requests.push(request);
          if (request.allowedTools.includes("self_destruct"))
            return {
              name: "self_destruct",
              args: { confirm: true, reason: "Disabled-window fixture" },
            };
          return { name: "vote", args: { target_id: null, abstain: true } };
        },
      },
      { day: 1 },
    );
    expect(result.interrupted).toBe(false);
    expect(requests.length).toBe(12);
    expect(requests.every((request) => request.allowedTools[0] === "vote")).toBe(true);
    expect(events.some((event) => event.type === "wolf_self_destruct")).toBe(false);
    expect(world.getAliveEntityIds().length).toBe(12);
  });
});
