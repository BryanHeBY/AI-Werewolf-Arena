/**
 * 负责维护事实与配置共享的稳定政策标识。输入为既定机器 ID，输出原常量、数组和类型，保留数组顺序及可变性。
 * 标识只表达选择哪份政策；组合支持由规则集校验，资源与效果执行由领域拥有，不因标识存在就授予行动许可。
 */
export const ANIMAL_DREAM_POLICY = "awa_animal_dream_v1" as const;
export const CAT_SKIPPED_VOTE_POLICIES = [
  "awa_wait_for_actual_exile_v1",
  "awa_expire_on_skipped_day_v1",
] as const;
export const PUFFER_BALLOT_POLICIES = ["awa_final_ballot_v1", "awa_first_ballot_v1"] as const;
export const BEAR_SIGNAL_POLICIES = ["awa_night_open_v1", "netease_dawn_live_v1"] as const;
export type CatSkippedVotePolicy = (typeof CAT_SKIPPED_VOTE_POLICIES)[number];
export type PufferBallotPolicy = (typeof PUFFER_BALLOT_POLICIES)[number];
export type BearSignalPolicy = (typeof BEAR_SIGNAL_POLICIES)[number];

export const NIGHTMARE_SHADOW_POLICY = "awa_nightmare_dreamer_v1" as const;

export const EVIL_KNIGHT_POLICY = "awa_evil_knight_v1" as const;

export const PURE_WHITE_POLICY = "awa_pure_white_night_v1" as const;
