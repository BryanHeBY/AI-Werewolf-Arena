/** Hunter keeps its existing public events and cause policy. */
import { Role, permitsHunterShot } from "../../../../core/domain/model";
import type { DeathHook } from "../../hooks/hook_registry";
import { getHunterState } from "../private_state";
import { resolveDeathShots } from "../death_shot";

export const hunterDeathHook: DeathHook = (world, ids, sources, choose, events, context) =>
  resolveDeathShots(
    world,
    ids,
    sources,
    choose,
    events,
    {
      role: Role.Hunter,
      state: getHunterState,
      permits: (sources) => permitsHunterShot(sources),
      policy: (state) => state.deathActionPolicy ?? "awa_qualified_sources_v1",
      poisonEvent: (hunterId) => ({
        timestamp: Date.now(),
        type: "hunter_silent_due_to_poison",
        payload: { hunterId },
      }),
      shotEvent: (hunterId, targetId) => ({
        timestamp: Date.now(),
        type: "hunter_shot",
        payload: { hunterId, targetId },
      }),
    },
    context,
  );
