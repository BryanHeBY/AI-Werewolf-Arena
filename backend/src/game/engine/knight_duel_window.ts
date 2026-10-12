/**
 * Executes the configured Knight duel opportunity with captured actor and target bodies. Inputs
 * are the day context, provider and gateway; outputs are a validated duel selection and its
 * existing commit effects. It does not let a replaced or dead actor reuse the captured window.
 */
import { COMPONENT } from "../../core/domain/components/names";
import { AliveComponent, aliveLifeVersion } from "../../core/domain/components/alive";
import type { RoleComponent } from "../../core/domain/components/role";
import {
  Role,
  Phase,
  KnightDuelWindow as DuelWindow,
  type ActionProvider,
  type BoardConfig,
  type KnightDuelSelection,
  type KnightDuelCommit,
} from "../../core/domain/model";
import type { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { GameActionRequestFactory } from "./action_request_factory";
import { getKnightState } from "../mechanisms/roles/private_state";

interface DuelParticipantSnapshot {
  life: AliveComponent;
  version: ReturnType<typeof aliveLifeVersion>;
  role: RoleComponent;
  roleId: Role;
  camp: RoleComponent["camp"];
}

/** A discrete living-player action; all final mutations belong to the supplied manager callback. */
export class KnightDuelWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
  ) {}
  async execute(
    config: BoardConfig,
    requests: GameActionRequestFactory,
    provider: ActionProvider,
    window: DuelWindow,
    isCurrent: () => boolean,
    commit?: (choice: KnightDuelSelection) => Promise<KnightDuelCommit>,
  ): Promise<{ selection: KnightDuelSelection | null; endsDay: boolean }> {
    const empty = { selection: null, endsDay: false };
    if (
      !isCurrent() ||
      !(config.knight?.enabledWindows ?? [DuelWindow.AfterSpeeches]).includes(window)
    )
      return empty;
    if (
      !this.world.getAliveEntityIds().some((id) => {
        const role = this.world.getComponent(id, COMPONENT.Role);
        return role?.role === Role.Knight && getKnightState(role)?.canDuel === true;
      })
    )
      return empty;
    const snapshots = new Map<number, DuelParticipantSnapshot>(
      this.world.getAliveEntityIds().map((id) => {
        const life = this.world.getComponent(id, COMPONENT.Alive)!,
          role = this.world.getComponent(id, COMPONENT.Role)!;
        return [
          id,
          { life, version: aliveLifeVersion(life), role, roleId: role?.role, camp: role?.camp },
        ] as const;
      }),
    );
    const picks = await Promise.all(
      [...snapshots].map(async ([actorId, actor]) => {
        const state = actor.role?.role === Role.Knight ? getKnightState(actor.role) : undefined;
        if (state?.canDuel !== true) return null;
        const action = await provider.getAction(
          requests.create({
            phase: Phase.Day,
            actorId,
            allowedTools: ["duel"],
            stage: window,
            requiresAction: false,
            summary: { key: "request.summary.knight_duel" },
            context: { duel_window: window },
          }),
        );
        if (action?.name !== "duel") return null;
        return { actorId, actor, state, action, target: snapshots.get(action.args.target_id) };
      }),
    );
    const sameLife = (id: number, snapshot: DuelParticipantSnapshot) =>
      this.world.getComponent(id, COMPONENT.Alive) === snapshot.life &&
      snapshot.life.alive &&
      snapshot.version !== undefined &&
      aliveLifeVersion(snapshot.life) === snapshot.version &&
      this.world.getComponent(id, COMPONENT.Role) === snapshot.role &&
      snapshot.role?.role === snapshot.roleId &&
      snapshot.role?.camp === snapshot.camp;
    for (const pick of picks
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.actorId - b.actorId)) {
      const valid = () =>
        isCurrent() &&
        sameLife(pick.actorId, pick.actor) &&
        getKnightState(pick.actor.role) === pick.state &&
        pick.state.canDuel &&
        pick.target !== undefined &&
        sameLife(pick.action.args.target_id, pick.target);
      if (
        !valid() ||
        !this.gateway.validateAndSanitize(this.world, pick.actorId, pick.action, {
          phase: Phase.Day,
          duelWindow: window,
          allowKnightDuel: true,
        }).ok ||
        !valid()
      )
        continue;
      if (!commit) throw new Error("knight_duel_commit_missing");
      const selection = { actorId: pick.actorId, targetId: pick.action.args.target_id },
        outcome = await commit(selection);
      if (outcome === "rejected") continue;
      return { selection, endsDay: outcome === "night" || outcome === "terminal" };
    }
    return empty;
  }
}
