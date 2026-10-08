import type { MessageRef } from "@ai-werewolf-arena/game-text";
import { ActionWindow, type EntityId, type Phase, type PotionType } from "./identity";
import type { PlayerVisibleEvent } from "./events";
import type { DeathCause } from "./deaths";

export interface ToolArgMap {
  report_bug: {
    category: "flow" | "rule" | "state" | "logging" | "other";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  };
  speak_to_wolves: { text: string; end_chat: boolean };
  kill_vote: { target_id: EntityId | null; abstain: boolean };
  guard: { target_id: EntityId | null; abstain: boolean };
  check_identity: { target_id: EntityId };
  use_potion: { target_id: EntityId; potion_type: PotionType };
  self_destruct: { reason: string; confirm: boolean };
  speak: { text: string };
  vote: { target_id: EntityId | null; abstain: boolean };
  shoot: { target_id: EntityId | null };
  choose_direction: { direction: "clockwise" | "counter_clockwise" };
  run_for_sheriff: { run: boolean };
  vote_for_sheriff: { target_id: EntityId | null; abstain: boolean };
}

export type ToolName = keyof ToolArgMap;
export const TOOL_NAMES = ["report_bug", "speak_to_wolves", "kill_vote", "guard", "check_identity", "use_potion", "self_destruct", "speak", "vote", "shoot", "choose_direction", "run_for_sheriff", "vote_for_sheriff"] as const satisfies readonly ToolName[];
export type ToolCall = { [K in ToolName]: { name: K; args: ToolArgMap[K] } }[ToolName];
export type TypedToolCall<T extends ToolName> = Extract<ToolCall, { name: T }>;

export interface ToolValidationResult<T extends ToolCall = ToolCall> {
  ok: boolean;
  sanitizedCall?: T;
  /** Stable machine code, independent of locale. */
  error?: string;
  message?: string;
}

export interface TurnConstraints {
  min_valid_actions?: number;
  max_valid_actions?: number;
  required_any_tools?: ToolName[];
  /** Legacy/custom caller text is retained verbatim. */
  summary?: string;
  summary_message?: MessageRef;
}

export const ACTION_STAGES = [...Object.values(ActionWindow), "wolf_discussion", "wolf_vote", "guard", "seer", "witch", "day_speech", "voting", "hunter_shot", "death_shot", "last_words", "sheriff_nomination", "sheriff_campaign_speech", "sheriff_withdraw", "sheriff_vote", "sheriff_choose_direction"] as const;
export type ActionStage = typeof ACTION_STAGES[number];
export const DEATH_SHOT_STAGES: readonly ActionStage[] = ["hunter_shot", "death_shot"];

/** Mechanism-owned additions; the request factory supplies common context fields. */
export interface ActionRequestExtras {
  ability_id?: string;
  wolf_target?: EntityId | null;
  trigger?: string;
  death_phase?: Phase;
  death_sources?: DeathCause[];
  death_action_id?: number;
  sheriff_candidates?: EntityId[];
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

export interface ActionProvider {
  getAction(request: ActionRequest): Promise<ToolCall | null>;
}
