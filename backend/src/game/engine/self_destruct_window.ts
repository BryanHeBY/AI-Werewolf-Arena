import { AliveComponent, aliveLifeVersion } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import { RoleComponent } from "../../core/domain/components/role";
import { ActionProvider, ActionWindow, BoardConfig, EntityId, Phase } from "../../core/domain/model";
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
  ) {}

  async execute(
    requests: GameActionRequestFactory,
    actionProvider: ActionProvider,
    window: ActionWindow,
    phase: Phase,
    isCurrent: () => boolean = () => true,
    commit?: (actorId: EntityId) => Promise<void>,
  ): Promise<EntityId | null> {
    if (!isCurrent()) return null;
    const actors = this.world.getAliveEntityIds().filter((id) => {
      const role = this.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (!role) {
        return false;
      }
      return this.roleRegistry.getAllowedTools(role.role).includes("self_destruct");
    });

    const picks = await Promise.all(
      actors.map(async (actorId) => {
        const alive = this.world.getComponent<AliveComponent>(actorId, COMPONENT.Alive)!;
        const role = this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!;
        const lifeVersion = aliveLifeVersion(alive);
        const req = requests.create({
          phase,
          actionWindow: window,
          actorId,
          allowedTools: ["self_destruct"],
          stage: window,
          requiresAction: false,
          summary: phase === Phase.Voting
            ? { key: "request.summary.self_destruct_pre_vote" }
            : { key: "request.summary.self_destruct" },
          context: {
          },
        });

        const action = await actionProvider.getAction(req);
        if (action?.name !== "self_destruct") {
          return null;
        }

        return { actorId, action, alive, role, lifeVersion };
      }),
    );

    if (!isCurrent()) return null;
    const valid: EntityId[] = [];
    for (const pick of picks) {
      if (!pick || !isCurrent() || this.world.getComponent(pick.actorId, COMPONENT.Alive) !== pick.alive ||
          this.world.getComponent(pick.actorId, COMPONENT.Role) !== pick.role || pick.lifeVersion === undefined || aliveLifeVersion(pick.alive) !== pick.lifeVersion) continue;
      if (this.toolGateway.validateAndSanitize(this.world, pick.actorId, pick.action, { phase, actionWindow: window, allowSelfDestruct: true }).ok) valid.push(pick.actorId);
    }
    const picked = valid.sort((a, b) => a - b)[0];
    if (picked === undefined) {
      return null;
    }

    const alive = this.world.getComponent<AliveComponent>(picked, COMPONENT.Alive);
    if (!alive || !alive.alive) {
      return null;
    }

    if (!isCurrent()) return null;
    await commit?.(picked);
    return picked;
  }
}

export function isSelfDestructWindowEnabled(
  config: BoardConfig,
  window: ActionWindow,
): boolean {
  const enabled = config.selfDestruct?.enabledWindows;
  if (enabled === undefined) {
    return window === ActionWindow.OnPreVote;
  }
  return enabled.includes(window);
}
