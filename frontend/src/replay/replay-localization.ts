const ROLE_NAMES: Record<string, string> = {
  wolf: "狼人",
  seer: "预言家",
  witch: "女巫",
  hunter: "猎人",
  idiot: "白痴",
  guard: "守卫",
  villager: "平民",
};

const CAMP_NAMES: Record<string, string> = {
  wolf: "狼人阵营",
  good: "好人阵营",
};

const PHASE_NAMES: Record<string, string> = {
  night: "夜晚",
  day: "白天",
  voting: "放逐投票",
  game_over: "对局结束",
};

const STAGE_NAMES: Record<string, string> = {
  god_private_game_info: "初始角色",
  night: "夜晚",
  wolf_tactical_order: "狼人行动顺序",
  wolf_discussion: "狼人夜聊",
  witch: "女巫行动",
  seer: "预言家查验",
  guard: "守卫行动",
  sheriff: "警长竞选",
  sheriff_nomination_summary: "上警结果",
  sheriff_withdraw_summary: "退水结果",
  sheriff_vote_summary: "警长票型",
  sheriff_direction_chosen: "警长定序",
  sheriff_badge_transferred: "警徽移交",
  sheriff_badge_destroyed: "警徽销毁",
  day_speech: "白天发言",
  night_resolved: "夜晚结算",
  voting: "放逐投票",
  wolf_self_destruct: "狼人自爆",
  last_words_granted: "遗言资格",
  last_words_spoken: "遗言",
  game_over: "对局结束",
};

const RESULT_REASONS: Record<string, string> = {
  all_wolves_eliminated: "所有狼人出局",
  slaughter_side: "屠边条件达成",
  slaughter_city: "屠城条件达成",
  wolf_reach_half: "存活狼人达到半数",
  max_days_reached: "达到最大天数",
};

export function roleName(role: string): string {
  return ROLE_NAMES[role] ?? role;
}

export function campName(camp: string): string {
  return CAMP_NAMES[camp] ?? camp;
}

export function phaseName(phase: string): string {
  return PHASE_NAMES[phase] ?? phase;
}

export function stageName(stage: string): string {
  return STAGE_NAMES[stage] ?? stage;
}

export function resultReasonName(reason: string | null): string {
  if (!reason) return "—";
  return RESULT_REASONS[reason] ?? reason;
}
