import { Camp, Role, permitsDeathShot } from "../../../../core/domain/model";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { DeathHook } from "../../hooks/hook_registry";
import { resolveDeathShots } from "../death_shot";
import { getMechanicalState, type MechanicalState, type MechanicalLearning, type MechanicalSkill } from "./state";

export const mechanicalDeathHook: DeathHook = (world, ids, sources, choose, events, context) => {
  const owners = new Map<RoleComponent, { state: MechanicalState; learning: MechanicalLearning; gun: Extract<MechanicalSkill, { kind: "hunter" }> }>();
  return resolveDeathShots(world, ids, sources, choose, events, {
  role: Role.MechanicalWolf,
  state: role => {
    const state = getMechanicalState(role), learning = state?.learned, skill = learning?.skill;
    if (role.camp !== Camp.Wolf || !state || !learning || skill?.kind !== "hunter" || !skill.armed) return undefined;
    const prior = owners.get(role);
    if (prior && (state !== prior.state || learning !== prior.learning || skill !== prior.gun)) return undefined;
    if (!prior) owners.set(role, { state, learning, gun: skill });
    return skill;
  },
  permits: permitsDeathShot,
  shotEvent: (actorId, targetId) => ({ timestamp: Date.now(), type: "mechanical_shot", payload: { actorId, targetId } }),
  }, context);
};
