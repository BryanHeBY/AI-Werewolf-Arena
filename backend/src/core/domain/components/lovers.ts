import type { CupidPolicy } from "../board";
import type { Camp, EntityId } from "../identity";
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
