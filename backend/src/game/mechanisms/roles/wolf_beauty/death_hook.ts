import { Role, DeathCause } from "../../../../core/domain/model";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { DeathHook } from "../../hooks/hook_registry";
import { activeCharm, permitsCharm } from "./relation";

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
    if (context?.isCurrent && !context.isCurrent()) break;
    if (
      world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.role !== Role.WolfBeauty ||
      !permitsCharm(sources[actorId] ?? [])
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
