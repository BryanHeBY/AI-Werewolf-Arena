/**
 * Responsibility: describe serialized action requests and their common context.
 * Input: public machine IDs, player-visible events and neutral message references;
 * output: original required day/stage/feed/constraint fields and optional feature
 * additions. These DTOs never create request leases, expose component identities
 * or grant permission from deadlines and IDs. Execution providers remain outside
 * the pure contract; engine authorization binds the actual original envelope.
 * Domain owners alone grant, cancel, close and revoke request capabilities;
 * these data declarations never write or revive a terminated runtime lease.
 */
import type { MessageRef } from "./message-refs";
import type { EntityId, Phase, ActionWindow, KnightDuelWindow } from "./identity";
import type { ActionStage, ToolName, TurnConstraints } from "./actions";
import type { PlayerVisibleEvent } from "./events";
import type { DeathCause } from "./death-facts";

/** Mechanism-owned additions; the request factory supplies common context fields. */
export interface ActionRequestExtras {
  fox_candidates?: readonly EntityId[];
  fragrant_pair_candidates?: readonly EntityId[];
  pair_check_candidates?: readonly EntityId[];
  servant_candidates?: readonly EntityId[];
  secret_body_candidates?: readonly EntityId[];
  shelter_candidates?: readonly EntityId[];
  swallow_candidates?: readonly EntityId[];
  mist_candidates?: readonly EntityId[];
  wolf_kill_candidates?: readonly EntityId[];
  snake_target?: EntityId | null;
  snake_candidates?: readonly EntityId[];
  raven_candidates?: readonly EntityId[];
  modifier_poison_blocked?: boolean;
  modifier_modes?: readonly ("enhance" | "weaken")[];
  modifier_candidates?: readonly EntityId[];
  modifier_bonus_kind?: "check" | "guard" | "poison" | "kill";
  modifier_bonus_candidates?: readonly EntityId[];
  wolf_targets?: readonly EntityId[];
  consort_candidates?: readonly EntityId[];
  sorcerer_candidates?: readonly EntityId[];
  trickster_candidates?: readonly EntityId[];
  trickster_may_pass?: boolean;
  /** Private unused living choices for the original magician only. */
  swap_candidates?: readonly EntityId[];
  proposedWitnessId?: EntityId;
  /** Explicit strict turns distinguish a clean optional wait from a failed submission/transport. */
  action_failure_policy?: "error";
  /** Some mandatory choices must fail explicitly instead of accepting a fabricated fallback. */
  allow_fallback?: boolean;
  ability_id?: string;
  duel_window?: KnightDuelWindow;
  wall_id?: string;
  item_instance_id?: string;
  debate_id?: string;
  debate_target_id?: EntityId;
  debate_actor_id?: EntityId;
  wolf_target?: EntityId | null;
  trigger?: string;
  death_phase?: Phase;
  /** Native Wolf King policy origin; legacy death_phase remains the original wave annotation. */
  death_origin_phase?: Phase;
  death_sources?: DeathCause[];
  death_action_id?: number;
  /** Private legal targets for this death-action request; not a public death announcement. */
  shoot_candidates?: readonly EntityId[];
  sheriff_candidates?: EntityId[];
  badge_candidates?: readonly EntityId[];
  exile_candidates?: EntityId[];
  round?: number;
  max_rounds?: number;
  retry_attempt?: number;
  retry_max?: number;
  retry_reason?: string;
  retry_notice?: string;
  retry_notice_message?: MessageRef;
}

/** Canonical engine facts are always present on a request passed to an agent. */
export interface ActionRequestContext extends ActionRequestExtras {
  day: number;
  stage: ActionStage;
  visible_events: PlayerVisibleEvent[];
  turn_constraints: TurnConstraints;
}

export interface ActionRequest {
  phase: Phase;
  actionWindow?: ActionWindow;
  actorId: EntityId;
  allowedTools: ToolName[];
  context: ActionRequestContext;
  deadlineAtMs?: number;
}
