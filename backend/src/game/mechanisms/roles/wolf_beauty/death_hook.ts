/**
 * Provides Wolf Beauty linked-death proposals after the original source dies. Inputs are the
 * dead body and death-hook context; outputs are permitted charm claims or extra death proposals.
 * Only a current relation may write a link into the returned proposal list; revoked relations
 * fail without committing charm stock, unrelated damage or the remaining death wave.
 */
import { getWolfBeautyState } from "../private_state";
import { Role, DeathCause } from "../../../../core/domain/model";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { DeathHook } from "../../hooks/hook_registry";
import { activeCharm, permitsCharm } from "./relation";
import { animalBeautyLinkBlocked } from "../animal_dream/authority";

export const wolfBeautyDeathHook: DeathHook = async (
  world,
  ids,
  sources,
  _choose,
  events,
  context,
) => {
  const result: Awaited<ReturnType<DeathHook>> = { extraDeaths: [], extraDeathSources: {} };
  for (const actorId of ids) {
    if (animalBeautyLinkBlocked(world, context?.day ?? 0)) continue;
    if (context?.isCurrent && !context.isCurrent()) break;
    if (
      world.getComponent(actorId, COMPONENT.Role)?.role !== Role.WolfBeauty ||
      !permitsCharm(
        sources[actorId] ?? [],
        getWolfBeautyState(world.getComponent(actorId, COMPONENT.Role)!)?.deathLinkPolicy,
        context?.nativeHunterShotTargets?.has(actorId) ?? false,
      )
    )
      continue;
    const binding = activeCharm(world, actorId);
    if (
      !binding ||
      binding.actorLife.alive ||
      (!binding.targetLife.alive && !context?.eligibleDead?.has(binding.targetId))
    )
      continue;
    (result.charmLinks ??= []).push({ binding, nightEffect: context?.nightEffect ?? false });
  }
  return result;
};
