import { AliveComponent } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import { RoleComponent } from "../../core/domain/components/role";
import { ActionProvider, ActionWindow, BoardConfig, EntityId, GameEvent, Phase } from "../../core/domain/model";
import { RoleRegistry } from "../../core/domain/registries/role_registry";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { GameActionRequestFactory } from "./action_request_factory";

/** Shared day/voting window: collect concurrently, then apply only the lowest-ID valid choice. */
export class SelfDestructWindow {
  constructor(
    private readonly world: World,
    private readonly roleRegistry: RoleRegistry,
    private readonly toolGateway: ToolGateway,
    private readonly events: GameEvent[],
  ) {}

  async execute(
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
    window: ActionWindow,
    phase: Phase,
  ): Promise<EntityId | null> {
    const actors = this.world.getAliveEntityIds().filter((id) => {
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (!role) {
        return false;
      }
      return this.roleRegistry.getAllowedTools(role.role).includes("self_destruct");
    });

    const picks = await Promise.all(
      actors.map(async (actorId) => {
        const req = requests.create({
          phase,
          actionWindow: window,
          actorId,
          allowedTools: ["self_destruct"],
          stage: window,
          requiresAction: false,
          summary: phase === Phase.Voting
            ? "放逐前自爆窗口可选择执行自爆，也可结束回合。"
            : "自爆窗口可选择执行自爆，也可直接结束回合。",
          context: {
          },
        });

        const action = await actionProvider.getAction(req);
        if (action?.name !== "self_destruct") {
          return null;
        }

        const result = this.toolGateway.validateAndSanitize(this.world, actorId, action, {
          phase,
          actionWindow: window,
          allowSelfDestruct: true,
        });
        if (!result.ok) {
          return null;
        }
        return actorId;
      }),
    );

    const picked = picks
      .filter((id): id is EntityId => id !== null)
      .sort((a, b) => a - b)[0];
    if (picked === undefined) {
      return null;
    }

    const alive = this.world.getComponent<AliveComponent>(picked, COMPONENT.Alive);
    if (!alive || !alive.alive) {
      return null;
    }

    alive.alive = false;
    this.events.push({
      timestamp: Date.now(),
      type: "wolf_self_destruct",
      payload: {
        wolfId: picked,
        window,
      },
    });
    return picked;
  }
}

export function isSelfDestructWindowEnabled(
  config: BoardConfig,
  window: ActionWindow,
): boolean {
  const enabled = config.selfDestruct?.enabledWindows;
  if (!enabled || enabled.length === 0) {
    return window === ActionWindow.OnPreVote;
  }
  return enabled.includes(window);
}
