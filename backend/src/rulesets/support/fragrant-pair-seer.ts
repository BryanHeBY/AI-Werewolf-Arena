/**
 * 负责生产装配前的寻香魅影／觉醒预言家有限板子判定。输入为已规范化的纯板子数据，输出为支持布尔值。
 * 十二人原生配对牌组，猎人参数可省略或取指定资格政策；不扩展为学习／赠予混搭。
 * 按现有字段、牌组、胜利目标与政策检查，不创建角色、支付资源或授予行动权限。
 * 归档验证拥有独立实现，不以本生产判定作为验证 oracle。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-contract";

const deck: Readonly<Record<string, number>> = {
  wolf: 3,
  fragrant_phantom: 1,
  villager: 4,
  awakened_seer: 1,
  witch: 1,
  hunter: 1,
  guard: 1,
};
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
// 数据复制之后只比较自有可枚举键的数量、存在性与预期值；不在这里补默认字段。
function exact(value: unknown, expected: Record<string, unknown>): boolean {
  return (
    record(value) &&
    Object.keys(value).length === Object.keys(expected).length &&
    Object.entries(expected).every(
      ([key, item]) => Object.hasOwn(value, key) && value[key] === item,
    )
  );
}
/** 原生寻香魅影／觉醒预言家十二人组合，不扩展为学习或赠予混搭。 */
export function isFragrantPairSeerPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input);
    if (!record(c)) return false;
    const required = [
      "boardSize",
      "enableSheriff",
      "fragrantPairSeer",
      "guard",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "witch",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "sheriff",
    ];
    const allowed = [...required, "winCondition", "winConditions", "hunter"];
    if (
      !required.every((key) => Object.hasOwn(c, key)) ||
      Object.keys(c).some((key) => !allowed.includes(key)) ||
      c.boardSize !== 12 ||
      c.enableSheriff !== true
    )
      return false;
    if (
      !exact(c.fragrantPairSeer, { policy: FRAGRANT_PAIR_POLICY }) ||
      !exact(c.guard, { repeatPolicy: "netease_consecutive_nights_v1" })
    )
      return false;
    if (
      c.hunter !== undefined &&
      !exact(c.hunter, { deathActionPolicy: "awa_qualified_sources_v1" })
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
      !exact(c.witch, {
        canSelfHeal: "disabled",
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      }) ||
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
      windows.every((window: unknown) => window === "on_pre_election" || window === "on_pre_vote")
    );
  } catch {
    return false;
  }
}
