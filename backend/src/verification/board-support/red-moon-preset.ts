/**
 * 负责独立核验归档中的赤月使徒有限板子。输入为归档中已规范化的纯数据，输出为支持布尔值。
 * 十二人固定牌组的末狼自爆政策二选一；不授权任意猎魔人混搭。
 * 本目录保留来自 Git 80ce15f 的独立判定及调用顺序，不导入生产规则集作验证 oracle。
 * 中立契约仅供应数据复制、事实与稳定政策标识；此处不是敌意对象的 Node 安全入口。
 * 通过数据 schema 不等于通过板子支持检查；本模块不授权行动或写入游戏状态。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { DEMON_HUNTER_POLICY } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";

const deck: Readonly<Record<string, number>> = {
  wolf: 3,
  red_moon_apostle: 1,
  villager: 4,
  seer: 1,
  witch: 1,
  demon_hunter: 1,
  idiot: 1,
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
/** 仅接受两种已列十二人原生政策组合，不授权任意猎魔人混搭。 */
export function isRedMoonPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input);
    if (!record(c)) return false;
    const required = [
      "boardSize",
      "enableSheriff",
      "redMoon",
      "demonHunter",
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
      !required.every((key) => Object.hasOwn(c, key)) ||
      Object.keys(c).some((key) => !allowed.includes(key)) ||
      c.boardSize !== 12 ||
      c.enableSheriff !== true
    )
      return false;
    if (
      !record(c.redMoon) ||
      (c.redMoon.lastWolfBlastPolicy !== "ends_game" &&
        c.redMoon.lastWolfBlastPolicy !== "forbidden") ||
      !exact(c.redMoon, {
        policy: "awa_red_moon_demon_v1",
        lastWolfBlastPolicy: c.redMoon.lastWolfBlastPolicy,
      }) ||
      !exact(c.demonHunter, { policy: DEMON_HUNTER_POLICY })
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
      !exact(c.seer, {
        targetPolicy: "awa_alive_v1",
        actionPolicy: "awa_required_when_legal_v1",
      }) ||
      !exact(c.witch, {
        canSelfHeal: "disabled",
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      }) ||
      !exact(c.voting, { exilePolicy: "awa_direct_v1" }) ||
      !exact(c.disclosure, { deathRevealPolicy: "awa_hidden_v1" }) ||
      !exact(c.lastWords, { policy: "awa_initial_wave_v1" }) ||
      !exact(c.sheriff, {
        electionPolicy: "awa_final_candidates_v1",
        badgePolicy: "awa_next_seat_v1",
        voteWeight: 1.5,
      }) ||
      !exact(c.tieBreaker, {
        sheriffVote: "min_seat",
        wolfKillVote: "min_id",
        exileVote: "min_id",
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
