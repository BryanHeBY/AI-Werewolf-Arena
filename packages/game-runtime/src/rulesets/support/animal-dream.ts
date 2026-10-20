/**
 * 负责生产装配前的动物梦境有限板子判定。输入为已规范化的纯板子数据，输出为支持布尔值。
 * 固定十二人牌组及白猫跳过投票、河豚计票政策的四种候选组合；Catalog 仍另行决定运行激活。
 * 按现有字段、牌组、胜利目标与政策检查，不创建角色、支付资源或授予行动权限。
 * 归档验证拥有独立实现，不以本生产判定作为验证 oracle。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";

import {
  ANIMAL_DREAM_POLICY,
  CAT_SKIPPED_VOTE_POLICIES,
  PUFFER_BALLOT_POLICIES,
} from "@ai-werewolf-arena/game-contract";

const deck: Readonly<Record<string, number>> = {
  wolf: 3,
  wolf_beauty: 1,
  villager: 4,
  white_cat: 1,
  fox_cub: 1,
  bear: 1,
  pufferfish: 1,
};
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
// 数据复制之后只比较自有可枚举键的数量、存在性与预期值；不在这里补默认字段。
function exact(v: unknown, expected: Readonly<Record<string, unknown>>): boolean {
  return (
    record(v) &&
    Object.keys(v).length === Object.keys(expected).length &&
    Object.entries(expected).every(([k, item]) => Object.hasOwn(v, k) && v[k] === item)
  );
}
/** 只检查四种有限候选板子；角色 Catalog 仍独立检查运行激活。 */
export function isAnimalDreamPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input);
    if (!record(c)) return false;
    const required = [
      "boardSize",
      "enableSheriff",
      "animalDream",
      "whiteCat",
      "pufferfish",
      "bear",
      "wolfBeauty",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "sheriff",
    ];
    if (
      !required.every((k) => Object.hasOwn(c, k)) ||
      Object.keys(c).some((k) => ![...required, "winConditions", "winCondition"].includes(k)) ||
      c.boardSize !== 12 ||
      c.enableSheriff !== true
    )
      return false;
    if (
      !exact(c.animalDream, {
        policy: ANIMAL_DREAM_POLICY,
        eliminationPriority: "awa_wolf_priority_v1",
      }) ||
      !exact(c.bear, { signalPolicy: "netease_dawn_live_v1" }) ||
      !exact(c.wolfBeauty, { deathLinkPolicy: "awa_exile_poison_v1" })
    )
      return false;
    if (
      !record(c.whiteCat) ||
      !CAT_SKIPPED_VOTE_POLICIES.includes(
        c.whiteCat.skippedVotePolicy as (typeof CAT_SKIPPED_VOTE_POLICIES)[number],
      ) ||
      !exact(c.whiteCat, { skippedVotePolicy: c.whiteCat.skippedVotePolicy })
    )
      return false;
    if (
      !record(c.pufferfish) ||
      !PUFFER_BALLOT_POLICIES.includes(
        c.pufferfish.ballotPolicy as (typeof PUFFER_BALLOT_POLICIES)[number],
      ) ||
      !exact(c.pufferfish, { ballotPolicy: c.pufferfish.ballotPolicy })
    )
      return false;
    if (!Array.isArray(c.roleSetups) || c.roleSetups.length !== Object.keys(deck).length)
      return false;
    // 固定行数、逐角色数量和去重共同限定牌组；输入行可重排，重复角色不能抵消缺牌。
    const seen = new Set<string>();
    for (const row of c.roleSetups) {
      if (
        !record(row) ||
        typeof row.role !== "string" ||
        !Object.hasOwn(deck, row.role) ||
        seen.has(row.role) ||
        !exact(row, { role: row.role, count: deck[row.role] })
      )
        return false;
      seen.add(row.role);
    }
    if (Object.hasOwn(c, "winConditions") && !Array.isArray(c.winConditions)) return false;
    const goals = c.winConditions ?? (c.winCondition ? [c.winCondition] : []);
    if (
      !Array.isArray(goals) ||
      goals.length !== 1 ||
      goals[0] !== "slaughter_side" ||
      (Object.hasOwn(c, "winCondition") && c.winCondition !== goals[0])
    )
      return false;
    if (
      !exact(c.voting, { exilePolicy: "awa_one_pk_v1" }) ||
      !exact(c.disclosure, { deathRevealPolicy: "awa_hidden_v1" }) ||
      !exact(c.lastWords, { policy: "awa_initial_wave_v1" }) ||
      !exact(c.sheriff, {
        electionPolicy: "awa_nomination_offstage_pk_v1",
        badgePolicy: "awa_holder_choice_v1",
        voteWeight: 1.5,
      }) ||
      !exact(c.tieBreaker, {
        sheriffVote: "no_elimination",
        wolfKillVote: "min_id",
        exileVote: "no_elimination",
      }) ||
      !exact(c.hooks, {
        onDaybreak: false,
        onPreElection: true,
        onPreVote: true,
        onPerSpeechGap: false,
      })
    )
      return false;
    if (
      !record(c.selfDestruct) ||
      Object.keys(c.selfDestruct).length !== 1 ||
      !Array.isArray(c.selfDestruct.enabledWindows)
    )
      return false;
    const windows = c.selfDestruct.enabledWindows;
    return (
      windows.length === 2 &&
      new Set(windows).size === 2 &&
      windows.every((w: unknown) => w === "on_pre_election" || w === "on_pre_vote")
    );
  } catch {
    return false;
  }
}
