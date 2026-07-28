import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/core/domain/components/names";
import { RoleComponent } from "../../src/core/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  Camp,
  Phase,
  PotionType,
  Role,
  ToolCall,
  WinCondition,
} from "../../src/core/domain/model";
import { RoleRegistry } from "../../src/core/domain/registries/role_registry";
import { DamageResolutionSystem } from "../../src/core/domain/systems/damage_resolution_system";
import { buildAgentBroadcastFeed } from "../../src/game/engine/agent_broadcast_feed";
import { NightPipeline } from "../../src/game/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../src/game/gateway/tool_gateway";
import { getSeerState } from "../../src/game/mechanisms/roles/private_state";
import { twelvePlayerStandardConfig } from "../../src/runtime/scenarios/twelve_player_standard";

class TacticalOrderProvider implements ActionProvider {
  public discussionOrder: number[] = [];
  public voteOrder: number[] = [];

  constructor(
    private readonly wolfTargetId: number,
    private readonly poisonTargetId?: number,
  ) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.phase !== Phase.Night) {
      return null;
    }

    if (request.allowedTools.includes("speak_to_wolves")) {
      this.discussionOrder.push(request.actorId);
      return {
        name: "speak_to_wolves",
        args: { text: `夜聊_${request.actorId}`, end_chat: false },
      };
    }

    if (request.allowedTools.includes("guard")) {
      return {
        name: "guard",
        args: { target_id: this.wolfTargetId, abstain: false },
      };
    }

    if (request.allowedTools.includes("kill_vote")) {
      this.voteOrder.push(request.actorId);
      return {
        name: "kill_vote",
        args: { target_id: this.wolfTargetId, abstain: false },
      };
    }

    if (
      request.allowedTools.includes("use_potion") &&
      this.poisonTargetId !== undefined
    ) {
      return {
        name: "use_potion",
        args: {
          target_id: this.poisonTargetId,
          potion_type: PotionType.Poison,
        },
      };
    }

    if (request.allowedTools.includes("check_identity")) {
      return {
        name: "check_identity",
        args: { target_id: this.wolfTargetId },
      };
    }

    return null;
  }
}

class EarlyEndWolfDiscussionProvider implements ActionProvider {
  public discussionOrder: number[] = [];
  public voteOrder: number[] = [];
  public endedActorId: number | null = null;

  constructor(private readonly wolfTargetId: number) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.phase !== Phase.Night) {
      return null;
    }

    if (request.allowedTools.includes("speak_to_wolves")) {
      const round = Number((request.context as Record<string, unknown>).round ?? 1);
      this.discussionOrder.push(request.actorId);
      if (round === 1 && this.endedActorId === null) {
        this.endedActorId = request.actorId;
        return {
          name: "speak_to_wolves",
          args: { text: "测试：已达成一致，提前结束夜聊", end_chat: true },
        };
      }
      return {
        name: "speak_to_wolves",
        args: { text: `夜聊_${request.actorId}_r${round}`, end_chat: false },
      };
    }

    if (request.allowedTools.includes("kill_vote")) {
      this.voteOrder.push(request.actorId);
      return {
        name: "kill_vote",
        args: { target_id: this.wolfTargetId, abstain: false },
      };
    }

    if (request.allowedTools.includes("guard")) {
      return {
        name: "guard",
        args: { target_id: this.wolfTargetId, abstain: false },
      };
    }

    if (request.allowedTools.includes("check_identity")) {
      return {
        name: "check_identity",
        args: { target_id: this.wolfTargetId },
      };
    }

    if (request.allowedTools.includes("use_potion")) {
      return {
        name: "use_potion",
        args: {
          target_id: request.actorId,
          potion_type: PotionType.None,
        },
      };
    }

    return null;
  }
}

class AbstainKillVoteProvider implements ActionProvider {
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.phase !== Phase.Night) {
      return null;
    }
    if (request.allowedTools.includes("speak_to_wolves")) {
      return {
        name: "speak_to_wolves",
        args: { text: `夜聊_${request.actorId}`, end_chat: true },
      };
    }
    if (request.allowedTools.includes("kill_vote")) {
      return {
        name: "kill_vote",
        args: { target_id: null, abstain: true },
      };
    }
    if (request.allowedTools.includes("guard")) {
      return {
        name: "guard",
        args: { target_id: request.actorId, abstain: false },
      };
    }
    if (request.allowedTools.includes("check_identity")) {
      return {
        name: "check_identity",
        args: { target_id: request.actorId === 1 ? 2 : 1 },
      };
    }
    if (request.allowedTools.includes("use_potion")) {
      return {
        name: "use_potion",
        args: { target_id: request.actorId, potion_type: PotionType.None },
      };
    }
    return null;
  }
}

class RetryThenKillVoteProvider implements ActionProvider {
  public killVoteAttempts = new Map<number, number>();

  constructor(private readonly targetId: number) {}

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.phase !== Phase.Night) {
      return null;
    }
    if (request.allowedTools.includes("speak_to_wolves")) {
      return {
        name: "speak_to_wolves",
        args: { text: `夜聊_${request.actorId}`, end_chat: true },
      };
    }
    if (request.allowedTools.includes("kill_vote")) {
      const current = (this.killVoteAttempts.get(request.actorId) ?? 0) + 1;
      this.killVoteAttempts.set(request.actorId, current);
      if (current <= 3) {
        return null;
      }
      return {
        name: "kill_vote",
        args: { target_id: this.targetId, abstain: false },
      };
    }
    if (request.allowedTools.includes("guard")) {
      return {
        name: "guard",
        args: { target_id: request.actorId, abstain: false },
      };
    }
    if (request.allowedTools.includes("check_identity")) {
      return {
        name: "check_identity",
        args: { target_id: this.targetId },
      };
    }
    if (request.allowedTools.includes("use_potion")) {
      return {
        name: "use_potion",
        args: { target_id: request.actorId, potion_type: PotionType.None },
      };
    }
    return null;
  }
}

describe("night wolf tactical loop", () => {
  test("wolf discussion order repeats for three rounds and majority decides kill target", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const pipeline = new NightPipeline(
      context.world,
      new RoleRegistry(),
      new ToolGateway(),
      new DamageResolutionSystem(),
      events,
    );

    const wolfTargetId = context.world
      .getAliveEntityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.camp === Camp.Good;
      })!;

    const provider = new TacticalOrderProvider(wolfTargetId);
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.42);
    const result = await pipeline.execute(twelvePlayerStandardConfig, provider);
    randomSpy.mockRestore();

    expect(provider.voteOrder.length).toBeGreaterThan(0);
    expect(provider.discussionOrder.length).toBe(provider.voteOrder.length * 3);
    expect(
      provider.discussionOrder.slice(0, provider.voteOrder.length),
    ).toEqual(provider.voteOrder);
    expect(
      provider.discussionOrder.slice(
        provider.voteOrder.length,
        provider.voteOrder.length * 2,
      ),
    ).toEqual(provider.voteOrder);
    expect(
      provider.discussionOrder.slice(provider.voteOrder.length * 2),
    ).toEqual(provider.voteOrder);
    expect(result.summary.wolfTarget).toBe(wolfTargetId);
  });

  test("wolf can end discussion early and is skipped in later rounds", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const pipeline = new NightPipeline(
      context.world,
      new RoleRegistry(),
      new ToolGateway(),
      new DamageResolutionSystem(),
      events,
    );

    const wolfTargetId = context.world
      .getAliveEntityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.camp === Camp.Good;
      })!;

    const provider = new EarlyEndWolfDiscussionProvider(wolfTargetId);
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.11);
    await pipeline.execute(twelvePlayerStandardConfig, provider);
    randomSpy.mockRestore();

    expect(provider.endedActorId).not.toBeNull();
    const endedActorId = provider.endedActorId!;
    const endedActorDiscussionCount = provider.discussionOrder.filter(
      (id) => id === endedActorId,
    ).length;
    expect(endedActorDiscussionCount).toBe(1);

    for (const voter of provider.voteOrder) {
      if (voter === endedActorId) {
        continue;
      }
      const count = provider.discussionOrder.filter((id) => id === voter).length;
      expect(count).toBe(3);
    }

    const endedEvent = events.find((event) => event.type === "wolf_discussion_ended");
    expect(endedEvent).toBeTruthy();
    expect(endedEvent.payload.actorId).toBe(endedActorId);

    const wolfViewer = provider.voteOrder[0];
    const feed = buildAgentBroadcastFeed(context.world, events, wolfViewer);
    expect(
      feed.some((line: string) => line.includes("[夜聊][结束][狼队]")),
    ).toBe(true);
  });

  test("guard mark cancels wolf kill while poison still kills", async () => {
    const customConfig: BoardConfig = {
      boardSize: 6,
      enableSheriff: false,
      winConditions: [WinCondition.SlaughterCity, WinCondition.WolfReachHalf],
      hooks: {
        onDaybreak: false,
        onPreElection: false,
        onPreVote: false,
        onPerSpeechGap: false,
      },
      roleSetups: [
        { role: Role.Wolf, count: 2 },
        { role: Role.Guard, count: 1 },
        { role: Role.Witch, count: 1 },
        { role: Role.Seer, count: 1 },
        { role: Role.Villager, count: 1 },
      ],
    };

    const context = bootstrapGame(customConfig);
    const events: any[] = [];
    const pipeline = new NightPipeline(
      context.world,
      new RoleRegistry(),
      new ToolGateway(),
      new DamageResolutionSystem(),
      events,
    );

    const aliveGood = context.world
      .getAliveEntityIds()
      .filter((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.camp === Camp.Good;
      });

    const wolfTargetId = aliveGood[0];
    const poisonTargetId = aliveGood[1];
    const provider = new TacticalOrderProvider(wolfTargetId, poisonTargetId);

    const result = await pipeline.execute(customConfig, provider);
    expect(result.summary.wolfTarget).toBe(wolfTargetId);
    expect(result.summary.deaths).not.toContain(wolfTargetId);
    expect(result.summary.deaths).toContain(poisonTargetId);
  });

  test("seer check result is persisted into seer private state", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const pipeline = new NightPipeline(
      context.world,
      new RoleRegistry(),
      new ToolGateway(),
      new DamageResolutionSystem(),
      events,
    );

    const wolfTargetId = context.world
      .getAliveEntityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === Role.Wolf;
      })!;

    const provider = new TacticalOrderProvider(wolfTargetId);
    await pipeline.execute(twelvePlayerStandardConfig, provider);

    const seerId = context.world
      .getAliveEntityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.role === Role.Seer;
      })!;
    const seerRole = context.world.getComponent<RoleComponent>(seerId, COMPONENT.Role)!;
    const seerState = getSeerState(seerRole);

    expect(seerState?.lastTarget).toBe(wolfTargetId);
    expect(seerState?.lastIsWerewolf).toBe(true);
    expect(seerState?.history.length).toBeGreaterThanOrEqual(1);
  });

  test("wolf abstain kill vote should produce no wolf target and no wolf night death", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const pipeline = new NightPipeline(
      context.world,
      new RoleRegistry(),
      new ToolGateway(),
      new DamageResolutionSystem(),
      events,
    );

    const provider = new AbstainKillVoteProvider();
    const result = await pipeline.execute(twelvePlayerStandardConfig, provider);

    expect(result.summary.wolfTarget).toBeNull();
    expect(result.summary.deaths.length).toBe(0);
    const abstains = events.filter(
      (event) =>
        event.type === "wolf_kill_vote_cast" && event.payload.abstain === true,
    );
    expect(abstains.length).toBeGreaterThan(0);
  });

  test("wolf kill vote should retry up to three times before accepting valid action", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const events: any[] = [];
    const pipeline = new NightPipeline(
      context.world,
      new RoleRegistry(),
      new ToolGateway(),
      new DamageResolutionSystem(),
      events,
    );
    const targetId = context.world
      .getAliveEntityIds()
      .find((id) => {
        const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
        return role?.camp === Camp.Good;
      })!;
    const provider = new RetryThenKillVoteProvider(targetId);

    const result = await pipeline.execute(twelvePlayerStandardConfig, provider);

    expect(result.summary.wolfTarget).toBe(targetId);
    const wolfIds = context.world
      .getAliveEntityIds()
      .filter(
        (id) =>
          context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Wolf,
      );
    for (const wolfId of wolfIds) {
      expect(provider.killVoteAttempts.get(wolfId)).toBe(4);
    }
  });
});
