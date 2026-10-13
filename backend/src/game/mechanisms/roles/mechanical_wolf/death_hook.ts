/**
 * Owns Mechanical Wolf's captured learned-gun contribution to ordered death shots.
 * Inputs are original state/learning/gun references and death contexts; outputs
 * preserve identity rechecks, cause eligibility and existing shot events.
 * Stored resources are read-only here; the shared death-shot owner consumes the
 * original gun, and this hook never clones state, refunds stock or grants a new lease.
 * After an actual death wave, the resolver rechecks currentness before and after
 * selecting a shot; stale or terminal windows never reopen a consumed learned gun.
 */

import type {
  MechanicalReadState as MechanicalState,
  MechanicalReadLearning as MechanicalLearning,
  MechanicalReadSkill as MechanicalSkill,
} from "@ai-werewolf-arena/game-contract";
import { Camp, Role, permitsDeathShot } from "../../../../core/domain/model";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { DeathHook } from "../../hooks/hook_registry";
import { resolveDeathShots } from "../death_shot";
import { getMechanicalState } from "./state";

export const mechanicalDeathHook: DeathHook = (world, ids, sources, choose, events, context) => {
  const owners = new Map<
    RoleComponent,
    {
      state: MechanicalState;
      learning: MechanicalLearning;
      gun: Extract<MechanicalSkill, { kind: "hunter" }>;
    }
  >();
  return resolveDeathShots(
    world,
    ids,
    sources,
    choose,
    events,
    {
      role: Role.MechanicalWolf,
      state: (role) => {
        const state = getMechanicalState(role),
          learning = state?.learned,
          skill = learning?.skill;
        if (
          role.camp !== Camp.Wolf ||
          !state ||
          !learning ||
          skill?.kind !== "hunter" ||
          !skill.armed
        )
          return undefined;
        const prior = owners.get(role);
        if (prior && (state !== prior.state || learning !== prior.learning || skill !== prior.gun))
          return undefined;
        if (!prior) owners.set(role, { state, learning, gun: skill });
        return skill;
      },
      permits: permitsDeathShot,
      shotEvent: (actorId, targetId) => ({
        timestamp: Date.now(),
        type: "mechanical_shot",
        payload: { actorId, targetId },
      }),
    },
    context,
  );
};
