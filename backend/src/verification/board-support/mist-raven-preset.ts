/**
 * 负责独立核验归档中的炼金魔女／狼鸦之爪有限板子。输入为归档中已规范化的纯数据，输出为支持布尔值。
 * 十二人固定牌组与四个中断窗口；梦保护、钩子和窗口政策不由角色注册自动补齐。
 * 本目录保留来自 Git 80ce15f 的独立判定及调用顺序，不导入生产规则集作验证 oracle。
 * 中立契约仅供应数据复制、事实与稳定政策标识；此处不是敌意对象的 Node 安全入口。
 * 通过数据 schema 不等于通过板子支持检查；本模块不授权行动或写入游戏状态。
 */
import { copyEventData } from "@ai-werewolf-arena/game-contract";
const deck: Readonly<Record<string, number>> = {
  wolf: 3,
  raven_claw_wolf: 1,
  villager: 4,
  seer: 1,
  alchemist: 1,
  dreamer: 1,
  idiot: 1,
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
/** 炼金魔女与狼鸦之爪的有限原生十二人板子。 */
export function isMistRavenPreset(input: unknown): boolean {
  try {
    const c = copyEventData(input);
    if (!record(c)) return false;
    const required = [
      "boardSize",
      "enableSheriff",
      "mistRaven",
      "dreamer",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "seer",
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
    if (!exact(c.mistRaven, { policy: "awa_mist_raven_v1" })) return false;
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
      !exact(c.dreamer, {
        protectionPolicy: "netease_2026_night_immunity_v1",
      }) ||
      !exact(c.seer, {
        targetPolicy: "awa_alive_v1",
        actionPolicy: "awa_required_when_legal_v1",
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
        onDaybreak: true,
        onPreElection: true,
        onPreVote: true,
        onPerSpeechGap: true,
      })
    )
      return false;
    if (
      !record(c.selfDestruct) ||
      Object.keys(c.selfDestruct).length !== 1 ||
      !Array.isArray(c.selfDestruct.enabledWindows)
    )
      return false;
    // 四个已列窗口须各出现一次；这里只确认配置，不实际打开白天中断窗口。
    const w = c.selfDestruct.enabledWindows;
    return (
      w.length === 4 &&
      new Set(w).size === 4 &&
      w.every((x) =>
        ["on_pre_election", "on_pre_vote", "on_daybreak", "on_per_speech_gap"].includes(
          x as string,
        ),
      )
    );
  } catch {
    return false;
  }
}
