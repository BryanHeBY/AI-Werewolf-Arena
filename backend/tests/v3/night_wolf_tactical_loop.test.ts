import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT } from "../../src/domain/components/names";
import { RoleComponent } from "../../src/domain/components/role";
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
} from "../../src/domain/model";
import { RoleRegistry } from "../../src/domain/registries/role_registry";
import { DamageResolutionSystem } from "../../src/domain/systems/damage_resolution_system";
import { NightPipeline } from "../../src/engine/phase_pipeline/night_pipeline";
import { ToolGateway } from "../../src/gateway/tool_gateway";
import { twelvePlayerStandardConfig } from "../../src/scenarios/twelve_player_standard";

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
        args: { text: `夜聊_${request.actorId}` },
      };
    }

    if (request.allowedTools.includes("guard")) {
      return {
        name: "guard",
        args: { target_id: this.wolfTargetId },
      };
    }

    if (request.allowedTools.includes("kill_vote")) {
      this.voteOrder.push(request.actorId);
      return {
        name: "kill_vote",
        args: { target_id: this.wolfTargetId },
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

describe("night wolf tactical loop", () => {
  test("wolf discussion order equals vote order and majority decides kill target", async () => {
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
    expect(provider.discussionOrder.length).toBe(provider.voteOrder.length * 2);
    expect(
      provider.discussionOrder.slice(0, provider.voteOrder.length),
    ).toEqual(provider.voteOrder);
    expect(
      provider.discussionOrder.slice(provider.voteOrder.length),
    ).toEqual(provider.voteOrder);
    expect(result.summary.wolfTarget).toBe(wolfTargetId);
  });

  test("guard mark cancels wolf kill while poison still kills", async () => {
    const customConfig: BoardConfig = {
      boardSize: 6,
      revealOnDeath: true,
      enableSheriff: false,
      winCondition: WinCondition.SlaughterCity,
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

    expect(seerRole.seerState?.lastTarget).toBe(wolfTargetId);
    expect(seerRole.seerState?.lastIsWerewolf).toBe(true);
    expect(seerRole.seerState?.history.length).toBeGreaterThanOrEqual(1);
  });
});
