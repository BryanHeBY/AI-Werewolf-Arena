/**
 * Defines the Seer owner's mutable inspection-state data contract.
 * Inputs and outputs preserve the existing optional policies, nullable last
 * result and lifetime history fields. Runtime state references stay in the
 * backend ability owner, never in the neutral protocol package; this type
 * does not grant authority, validate targets or apply configuration defaults.
 */
import type {
  EntityId,
  InspectionResult,
  SeerTargetPolicy,
  SeerActionPolicy,
} from "@ai-werewolf-arena/game-contract";

/** 预言家私有状态。 */
export interface SeerState {
  targetPolicy?: SeerTargetPolicy;
  actionPolicy?: SeerActionPolicy;
  lastTarget: EntityId | null;
  lastIsWerewolf: boolean | null;
  lastResult?: InspectionResult | null;
  history: Array<{
    targetId: EntityId;
    isWerewolf: boolean;
    result?: InspectionResult;
  }>;
}
