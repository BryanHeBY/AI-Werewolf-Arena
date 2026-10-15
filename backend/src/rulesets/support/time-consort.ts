/**
 * 负责生产装配前的蚀时狼妃有限板子判定。输入为已规范化的纯板子数据，输出为支持布尔值。
 * 十二人固定定序王子组合，反射范围只接受整夜或首次效果两项；不是任意反射角色混搭。
 * 按现有字段、牌组、胜利目标与政策检查，不创建角色、支付资源或授予行动权限。
 * 归档验证拥有独立实现，不以本生产判定作为验证 oracle。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
const deck: Readonly<Record<string, number>> = {
  wolf: 3,
  time_wolf_consort: 1,
  villager: 4,
  seer: 1,
  witch: 1,
  guard: 1,
  order_prince: 1,
};
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
// 数据复制之后只比较自有可枚举键的数量、存在性与预期值；不在这里补默认字段。
function exact(v: unknown, expected: Record<string, unknown>): boolean {
  return (
    record(v) &&
    Object.keys(v).length === Object.keys(expected).length &&
    Object.entries(expected).every(([k, x]) => Object.hasOwn(v, k) && v[k] === x)
  );
}
/** 蚀时狼妃与定序王子的有限原生十二人板子。 */
export function isTimeConsortPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input);
    if (!record(c)) return false;
    const required = [
      "boardSize",
      "enableSheriff",
      "timeConsort",
      "guard",
      "orderPrince",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "seer",
      "witch",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
      "sheriff",
    ];
    const allowed = [...required, "winCondition", "winConditions"];
    if (
      !required.every((k) => Object.hasOwn(c, k)) ||
      Object.keys(c).some((k) => !allowed.includes(k)) ||
      c.boardSize !== 12 ||
      c.enableSheriff !== true
    )
      return false;
    const t = c.timeConsort;
    if (
      !record(t) ||
      (t.reflectionScope !== "whole_night" && t.reflectionScope !== "first_effect") ||
      !exact(t, { policy: "awa_time_consort_reflection_v1", reflectionScope: t.reflectionScope })
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
      !exact(c.orderPrince, { policy: "awa_order_prince_first_ballot_v1" }) ||
      !exact(c.guard, { repeatPolicy: "awa_last_action_v1" }) ||
      !exact(c.seer, {
        targetPolicy: "awa_alive_v1",
        actionPolicy: "awa_required_when_legal_v1",
      }) ||
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
    const w = c.selfDestruct.enabledWindows;
    return (
      w.length === 2 &&
      new Set(w).size === 2 &&
      w.every((x) => x === "on_pre_election" || x === "on_pre_vote")
    );
  } catch {
    return false;
  }
}
