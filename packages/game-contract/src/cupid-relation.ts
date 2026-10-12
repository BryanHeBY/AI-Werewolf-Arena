/**
 * Responsibility: define immutable God-only Cupid relation metadata for event archives.
 * Input: original actor/pair IDs, policy and enum-typed factions; output: unchanged
 * serializable relation shape. The domain owns original life references and paid
 * relation transitions; this DTO grants no authority and carries no callbacks.
 */
import type { CupidPolicy } from "./boards";
import type { Camp, EntityId } from "./identity";
/** God-only immutable metadata; runtime life references stay outside serialization. */
export interface LoversComponent {
  readonly actorId: EntityId;
  readonly day: 1;
  readonly policy: CupidPolicy;
  readonly pairIds: readonly [EntityId, EntityId];
  readonly pairCamps: readonly [Camp.Good | Camp.Wolf, Camp.Good | Camp.Wolf];
  readonly groupId: "cupid_lovers";
  readonly mixed: boolean;
}
