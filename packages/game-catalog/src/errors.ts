/** Stable rule failures; human messages belong to game-text. */
export enum RuleError {
  AbstainTargetNull = "abstain_target_null",
  ActorDead = "actor_dead",
  ActorMissing = "actor_missing",
  ActorRoleMissing = "actor_role_missing",
  DeathActionUnavailable = "death_action_unavailable",
  AbilityPhase = "ability_phase",
  BlastConfirm = "blast_confirm",
  BlastDisabled = "blast_disabled",
  BlastPhase = "blast_phase",
  BlastWindow = "blast_window",
  CheckTarget = "check_target",
  CustomRuleError = "custom_rule_error",
  GuardOnly = "guard_only",
  GuardRepeat = "guard_repeat",
  GuardTarget = "guard_target",
  HealUnavailable = "heal_unavailable",
  HealTarget = "heal_target",
  KillTarget = "kill_target",
  PoisonTarget = "poison_target",
  PoisonUnavailable = "poison_unavailable",
  ReportCategory = "invalid_report_bug_category",
  ReportMessageEmpty = "invalid_report_bug_message_empty",
  ReportMessageLong = "invalid_report_bug_message_too_long",
  ReportSeverity = "invalid_report_bug_severity",
  SeerOnly = "seer_only",
  SelfHeal = "self_heal",
  SheriffDirectionOnly = "sheriff_direction_only",
  SheriffDirectionPhase = "sheriff_direction_phase",
  SheriffNominationPhase = "sheriff_nomination_phase",
  SheriffRunBoolean = "sheriff_run_boolean",
  SheriffVotePhase = "sheriff_vote_phase",
  SheriffVoteTarget = "sheriff_vote_target",
  ShootTarget = "shoot_target",
  ShootUnavailable = "shoot_unavailable",
  ToolMismatch = "tool_mismatch",
  TwoPotions = "two_potions",
  UnknownTool = "unknown_tool",
  VoteRight = "vote_right",
  VoteTarget = "vote_target",
  WitchOnly = "witch_only",
  WolfBlastOnly = "wolf_blast_only",
  WolfOnly = "wolf_only",
  WolfChatPermission = "wolf_chat_permission",
  WolfChatPhase = "wolf_chat_phase",
  WolfKillPermission = "wolf_kill_permission",
  WolfKillPhase = "wolf_kill_phase",
}

Object.freeze(RuleError);

export interface RuleViolation {
  code: RuleError;
  /** Explicit injected rules may preserve their own original message. */
  message?: string;
}
