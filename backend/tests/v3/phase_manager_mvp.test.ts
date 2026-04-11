import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
import { ActionProvider, ActionRequest, Camp, Phase, ToolCall, Role } from "../../src/domain/model";
import { VotingPipeline } from "../../src/engine/phase_pipeline/voting_pipeline";
import { DayPipeline } from "../../src/engine/phase_pipeline/day_pipeline";
import { ToolGateway } from "../../src/gateway/tool_gateway";
import { EventRegistry } from "../../src/engine/event_registry";
import { sixPlayerMvpConfig } from "../../src/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

class WolfOnlyNightProvider implements ActionProvider {
  constructor(private readonly world: ReturnType<typeof bootstrapGame>["world"]) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.phase !== Phase.Night) {
      return null;
    }

    if (!request.allowedTools.includes("kill_vote")) {
      return null;
    }

    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    if (role?.role !== Role.Wolf) {
      return null;
    }

    const target = this.world.getAliveEntityIds().find((id) => {
      const targetRole = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return id !== request.actorId && targetRole?.camp !== Camp.Wolf;
    });

    return target
      ? { name: "kill_vote", args: { target_id: target, abstain: false } }
      : { name: "kill_vote", args: { target_id: null, abstain: true } };
  }
}

describe("V3 PhaseManager MVP", () => {
  test("bootstrap should emit god_private_game_info as initial event", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const events = context.phaseManager.getEvents();
    const init = events.find((event) => event.type === "god_private_game_info");

    expect(init).toBeTruthy();
    const players = Array.isArray(init?.payload.players) ? init?.payload.players : [];
    expect(players.length).toBe(sixPlayerMvpConfig.boardSize);
    expect(
      players.every(
        (item: any) =>
          typeof item.seat === "number" &&
          typeof item.role === "string" &&
          typeof item.camp === "string",
      ),
    ).toBe(true);
  });

  test("6-player scenario reaches wolf win with wolf-only night kills", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const snapshot = await context.phaseManager.runUntilGameOver(
      new WolfOnlyNightProvider(context.world),
      10,
    );

    expect(snapshot.gameOver).toBe(true);
    expect(snapshot.result?.winner).toBe(Camp.Wolf);
  });

  test("voting pre-hook allows wolf self_destruct interrupt", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new VotingPipeline(
      context.world,
      new ToolGateway(),
      new EventRegistry(),
      events,
    );

    const wolfId = context.world
      .getAliveEntityIds()
      .find((id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Wolf)!;

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
        if (
          request.phase === Phase.Voting &&
          request.actorId === wolfId &&
          request.allowedTools.includes("self_destruct")
        ) {
          return {
            name: "self_destruct",
            args: { reason: "test_interrupt", confirm: true },
          };
        }
        return null;
      },
    };

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider);

    expect(result.interrupted).toBe(true);
    expect(result.removed).toContain(wolfId);
  });

  test("sheriff can choose counter-clockwise speech order", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new DayPipeline(context.world, new ToolGateway(), events);

    const actionProvider: ActionProvider = {
      async getAction(request: ActionRequest): Promise<ToolCall | null> {
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

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider);
    const order = result.summary.speeches.map((speech) => speech.actorId);

    expect(result.interrupted).toBe(false);
    expect(order[0]).toBe(12);
    expect(order[order.length - 1]).toBe(1);
  });

  test("without elected sheriff, total vote weight remains 12", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new VotingPipeline(
      context.world,
      new ToolGateway(),
      new EventRegistry(),
      events,
    );

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

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider);

    expect(result.interrupted).toBe(false);
    expect(result.summary.tally[2]).toBe(12);
  });

  test("vote abstain should not be counted into tally", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events = [] as any[];
    const pipeline = new VotingPipeline(
      context.world,
      new ToolGateway(),
      new EventRegistry(),
      events,
    );

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

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider);

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
    const pipeline = new VotingPipeline(
      context.world,
      new ToolGateway(),
      new EventRegistry(),
      events,
    );
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

    const result = await pipeline.execute(twelvePlayerStandardConfig, actionProvider);

    expect(result.interrupted).toBe(false);
    expect(result.summary.tally[2]).toBe(12);
    for (const voter of context.world.getAliveEntityIds()) {
      expect(attempts.get(voter)).toBe(4);
    }
  });
});
