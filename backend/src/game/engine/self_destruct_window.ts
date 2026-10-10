import { canRoleSelfDestruct } from "../mechanisms/roles/self_destruct_capability";
import { getDefaultRoleCatalog } from "../mechanisms/roles/catalog";
import {
  weddingMember,
  weddingSetup,
  ghostBrideReady,
} from "../mechanisms/roles/ghost_bride/authority";
import { AliveComponent, aliveLifeVersion } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import { RoleComponent } from "../../core/domain/components/role";
import {
  ActionProvider,
  ActionWindow,
  BoardConfig,
  Phase,
  type SelfDestructSelection,
} from "../../core/domain/model";
import { RoleRegistry } from "../../core/domain/registries/role_registry";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { GameActionRequestFactory } from "./action_request_factory";
import { getWhiteWolfKingState } from "../mechanisms/roles/private_state";

/** Collect choices concurrently, then commit only the lowest-ID still-valid choice. */
export class SelfDestructWindow {
  constructor(
    private readonly world: World,
    private readonly roleRegistry: RoleRegistry,
    private readonly toolGateway: ToolGateway,
  ) {}

  async execute(
    requests: GameActionRequestFactory,
    provider: ActionProvider,
    window: ActionWindow,
    phase: Phase,
    isCurrent: () => boolean = () => true,
    commit?: (choice: SelfDestructSelection) => Promise<void | boolean>,
  ): Promise<SelfDestructSelection | null> {
    if (!isCurrent()) return null;
    const targets = new Map(
      this.world.getAliveEntityIds().map((id) => {
        const alive = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
        return [id, { alive, version: aliveLifeVersion(alive) }] as const;
      }),
    );
    const picks = await Promise.all(
      this.world.getAliveEntityIds().map(async (actorId) => {
        const role = this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
        if (!role) return null;
        if (
          weddingSetup(this.world) &&
          (!ghostBrideReady(this.world) || weddingMember(this.world, role))
        )
          return null;
        const tools = this.roleRegistry.getAllowedTools(role.role);
        const tool = tools.includes("self_destruct_with_target")
          ? "self_destruct_with_target"
          : tools.includes("self_destruct")
            ? "self_destruct"
            : null;
        if (!tool) return null;
        if (tool === "self_destruct" && !canRoleSelfDestruct(role, getDefaultRoleCatalog()))
          return null;
        const resource =
          tool === "self_destruct_with_target" ? getWhiteWolfKingState(role) : undefined;
        if (tool === "self_destruct_with_target" && resource?.canDetonate !== true) return null;
        const life = targets.get(actorId)!;
        const request = requests.create({
          phase,
          actionWindow: window,
          actorId,
          allowedTools: [tool],
          stage: window,
          requiresAction: false,
          summary: {
            key:
              phase === Phase.Voting
                ? "request.summary.self_destruct_pre_vote"
                : "request.summary.self_destruct",
          },
          context: {},
        });
        const action = await provider.getAction(request);
        if (
          action?.name !== tool ||
          (action.name !== "self_destruct" && action.name !== "self_destruct_with_target")
        )
          return null;
        const choice: SelfDestructSelection =
          action.name === "self_destruct"
            ? { kind: "ordinary", actorId, targetId: null }
            : { kind: "white_wolf_king", actorId, targetId: action.args.target_id };
        return { choice, action, role, resource, life };
      }),
    );
    if (!isCurrent()) return null;
    const stillCurrent = (pick: NonNullable<(typeof picks)[number]>) => {
      const { actorId, targetId } = pick.choice;
      if (
        !isCurrent() ||
        (weddingSetup(this.world) &&
          (!ghostBrideReady(this.world) || weddingMember(this.world, pick.role))) ||
        this.world.getComponent(actorId, COMPONENT.Role) !== pick.role ||
        this.world.getComponent(actorId, COMPONENT.Alive) !== pick.life.alive ||
        !pick.life.alive.alive ||
        pick.life.version === undefined ||
        aliveLifeVersion(pick.life.alive) !== pick.life.version
      )
        return false;
      if (
        pick.choice.kind === "white_wolf_king" &&
        (getWhiteWolfKingState(pick.role) !== pick.resource || pick.resource?.canDetonate !== true)
      )
        return false;
      if (targetId !== null) {
        const target = targets.get(targetId);
        if (
          !target ||
          this.world.getComponent(targetId, COMPONENT.Alive) !== target.alive ||
          !target.alive.alive ||
          target.version === undefined ||
          aliveLifeVersion(target.alive) !== target.version
        )
          return false;
      }
      return true;
    };
    const valid = picks.filter(
      (pick): pick is NonNullable<typeof pick> =>
        pick !== null &&
        stillCurrent(pick) &&
        this.toolGateway.validateAndSanitize(this.world, pick.choice.actorId, pick.action, {
          phase,
          actionWindow: window,
          allowSelfDestruct: true,
        }).ok &&
        stillCurrent(pick),
    );
    for (const pick of valid.sort((a, b) => a.choice.actorId - b.choice.actorId)) {
      if (!isCurrent()) return null;
      if (!stillCurrent(pick)) continue;
      if ((await commit?.(pick.choice)) === false) continue;
      return pick.choice;
    }
    return null;
  }
}

export function isSelfDestructWindowEnabled(config: BoardConfig, window: ActionWindow): boolean {
  return config.selfDestruct?.enabledWindows === undefined
    ? window === ActionWindow.OnPreVote
    : config.selfDestruct.enabledWindows.includes(window);
}
