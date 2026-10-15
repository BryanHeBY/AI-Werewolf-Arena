/**
 * 引擎场景测试：验证完整对局、白天／投票 pipeline 和猎人请求上下文。输入为原受控 provider、World 和重试／票权／顺序矩阵；快照、权重、重试及请求上下文为精确预期，生产推导目标是既有债务，不冒称独立 oracle。
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { RoleComponent } from "../../../src/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  Phase,
  ToolCall,
  Role,
} from "../../../src/domain/model";
import { VotingPipeline } from "../../../src/engine/phases/voting-pipeline";
import { DayPipeline } from "../../../src/engine/phases/day-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { EventRegistry } from "../../../src/engine/events/event-registry";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";
import { createDefaultRoleRegistry } from "../../../src/rulesets/mechanism-api";

class WolfOnlyNightProvider implements ActionProvider {
  constructor(private readonly world: ReturnType<typeof bootstrapGame>["world"]) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.phase !== Phase.Night) {
      return null;
    }

    if (!request.allowedTools.includes("kill_vote")) {
      return null;
    }

    const role = this.world.getComponent(request.actorId, COMPONENT.Role);
    if (role?.role !== Role.Wolf) {
      return null;
    }

    const target = this.world.getAliveEntityIds().find((id) => {
      const targetRole = this.world.getComponent(id, COMPONENT.Role);
      return (
        id !== request.actorId &&
        (targetRole ? this.world.getComponent(id, COMPONENT.Camp)?.camp : undefined) !== Camp.Wolf
      );
    });

    return target
      ? { name: "kill_vote", args: { target_id: target, abstain: false } }
      : { name: "kill_vote", args: { target_id: null, abstain: true } };
  }
}

describe("PhaseManager", () => {
  test("6-player scenario reaches wolf win with wolf-only night kills", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const snapshot = await context.phaseManager.runUntilGameOver(
      new WolfOnlyNightProvider(context.world),
      10,
    );

    expect(snapshot.gameOver).toBe(true);
    expect(snapshot.result?.winner).toBe(Camp.Wolf);
  });

  test("sheriff can choose counter-clockwise speech order", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new DayPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      events,
    });

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("run_for_sheriff"))
          return { name: "run_for_sheriff", args: { run: request.actorId === 1 } };
        if (request.allowedTools.includes("vote_for_sheriff"))
          return { name: "vote_for_sheriff", args: { target_id: 1, abstain: false } };
        if (request.allowedTools.includes("self_destruct")) {
          return null;
        }
        if (request.allowedTools.includes("choose_direction")) {
          return {
            name: "choose_direction",
            args: { direction: "counter_clockwise" },
          };
        }
        if (request.allowedTools.includes("speak")) {
          return {
            name: "speak",
            args: { text: `seat_${request.actorId}` },
          };
        }
        return null;
      },
    };

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider, {
      day: 1,
    });
    const order = result.summary.speeches.map((speech: any) => speech.actorId);

    expect(result.interrupted).toBe(false);
    expect(order[0]).toBe(12);
    expect(order[order.length - 1]).toBe(1);
  });

  test("without elected sheriff, total vote weight remains 12", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new VotingPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      eventRegistry: new EventRegistry(),
      events,
    });

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("self_destruct")) {
          return null;
        }
        if (request.allowedTools.includes("vote")) {
          return { name: "vote", args: { target_id: 2, abstain: false } };
        }
        return null;
      },
    };

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider, {
      day: 1,
    });

    expect(result.interrupted).toBe(false);
    expect(result.summary.tally[2]).toBe(12);
  });

  test("vote abstain should not be counted into tally", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new VotingPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      eventRegistry: new EventRegistry(),
      events,
    });

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("self_destruct")) {
          return null;
        }
        if (request.allowedTools.includes("vote")) {
          if (request.actorId === 1) {
            return { name: "vote", args: { target_id: null, abstain: true } };
          }
          return { name: "vote", args: { target_id: 2, abstain: false } };
        }
        return null;
      },
    };

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider, {
      day: 1,
    });

    expect(result.interrupted).toBe(false);
    expect(result.summary.tally[2]).toBe(11);
    expect(
      events.some(
        (event: any) =>
          event.type === "vote_cast" &&
          event.payload.actorId === 1 &&
          event.payload.abstain === true,
      ),
    ).toBe(true);
  });

  test("vote should retry up to three times before accepting a valid vote", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new VotingPipeline({
      world: context.world,
      roleRegistry: createDefaultRoleRegistry(),
      toolGateway: new ToolGateway(),
      eventRegistry: new EventRegistry(),
      events,
    });
    const attempts = new Map<number, number>();

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("self_destruct")) {
          return null;
        }
        if (request.allowedTools.includes("vote")) {
          const current = (attempts.get(request.actorId) ?? 0) + 1;
          attempts.set(request.actorId, current);
          if (current <= 3) {
            return null;
          }
          return { name: "vote", args: { target_id: 2, abstain: false } };
        }
        return null;
      },
    };

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider, {
      day: 1,
    });

    expect(result.interrupted).toBe(false);
    expect(result.summary.tally[2]).toBe(12);
    for (const voter of context.world.getAliveEntityIds()) {
      expect(attempts.get(voter)).toBe(4);
    }
  });

  test("hunter death shoot request should carry current day and hunter_shot stage", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const hunterId = context.world
      .getAliveEntityIds()
      .find((id) => context.world.getComponent(id, COMPONENT.Role)?.role === Role.Hunter)!;
    const wolfIds = context.world
      .getAliveEntityIds()
      .filter((id) => context.world.getComponent(id, COMPONENT.Role)?.role === Role.Wolf);
    const shootTarget = context.world
      .getAliveEntityIds()
      .find((id) => id !== hunterId && !wolfIds.includes(id))!;

    const captured: { request?: ActionRequest } = {};

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (request.allowedTools.includes("run_for_sheriff")) {
          return { name: "run_for_sheriff", args: { run: false } };
        }
        if (request.allowedTools.includes("vote_for_sheriff")) {
          return { name: "vote_for_sheriff", args: { target_id: null, abstain: true } };
        }
        if (request.allowedTools.includes("choose_direction")) {
          return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        if (request.allowedTools.includes("speak")) {
          return { name: "speak", args: { text: "过" } };
        }
        if (request.allowedTools.includes("use_potion")) {
          return null;
        }
        if (request.allowedTools.includes("shoot")) {
          captured.request = request;
          return { name: "shoot", args: { target_id: shootTarget } };
        }
        if (request.allowedTools.includes("kill_vote")) {
          if (wolfIds.includes(request.actorId)) {
            return { name: "kill_vote", args: { target_id: hunterId, abstain: false } };
          }
          return null;
        }
        if (request.allowedTools.includes("vote")) {
          return { name: "vote", args: { target_id: null, abstain: true } };
        }
        return null;
      },
    };

    await context.phaseManager.runSingleCycle(actionProvider, 3);

    const shootRequest = captured.request;
    if (!shootRequest) {
      throw new Error("expected hunter shoot request to be captured");
    }
    expect(shootRequest.phase).toBe(Phase.Day);
    expect(shootRequest.context.day).toBe(1);
    expect(shootRequest.context.stage).toBe("hunter_shot");
  });
});
