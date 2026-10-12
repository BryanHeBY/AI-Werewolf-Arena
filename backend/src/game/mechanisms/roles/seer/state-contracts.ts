/**
 * Defines the Seer owner's mutable inspection-state data contract.
 * Inputs and outputs preserve the existing optional policies, nullable last
 * result and lifetime history fields. Runtime state references stay in the
 * backend ability owner, never in the neutral protocol package; this type
 * does not grant authority, validate targets or apply configuration defaults.
 * The deeply readonly read contract below aliases that same stored state; only
 * feature commit commands retain writes, without freezing or copying actors.
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

/** Same live data reference, with no nested scalar/result/history write permission. */
export type SeerReadState = Readonly<Omit<SeerState, "lastResult" | "history">> & {
  readonly lastResult?: Readonly<NonNullable<SeerState["lastResult"]>> | null;
  readonly history: readonly (Readonly<Omit<SeerState["history"][number], "result">> & {
    readonly result?: Readonly<NonNullable<SeerState["history"][number]["result"]>>;
  })[];
};
