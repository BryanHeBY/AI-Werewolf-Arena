/**
 * Owns Noble's public ordinary knife query and exposes its concrete night handoff ports.
 * Input is a target ID bound to the original World; output retains the original
 * role/policy allowance. When queried, the conditional second Role lookup and
 * field failures keep their order. Binding never reads state or grants World,
 * life, resource-write or body-contract commit access to the consumer.
 */
import { Role, type EntityId } from "../../../../core/domain/identity";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";
import { readNobleState } from "./state";

export interface NobleKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

export function bindNobleKnifeTargetQuery(world: World): NobleKnifeTargetQuery {
  return Object.freeze({
    allows: (targetId: EntityId) =>
      world.getComponent(targetId, COMPONENT.Role)?.role !== Role.NightNoble ||
      readNobleState(
        (
          world.getComponent(targetId, COMPONENT.Role) as
            { readonly privateState: { readonly noble?: unknown } } | undefined
        )?.privateState.noble,
      )?.wolfActionPolicy === "standard",
  });
}

export {
  NobleNightUnit,
  createNobleNightAbortReceiver,
  attachNobleNightReceiver,
  nobleNightReceiver,
} from "./night-lifecycle";
export type {
  NobleNightAbortReceiver,
  NobleNightReceiver,
  NobleNightRuntime,
  NobleOpeningFact,
} from "./night-lifecycle";
export {
  checkpointNobleBodyAuthority,
  assertNobleBodyRosterCurrent,
  isNobleBodyBoard,
  expireServantAtNightEnd,
  resolveSecretBodyDamage,
} from "./authority";
export { appendNobleContractClosure } from "./facts";
