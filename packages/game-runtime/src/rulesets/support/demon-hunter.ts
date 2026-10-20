/**
 * 负责生产装配前的猎魔人有限板子判定。输入为已规范化的纯板子数据，输出为支持布尔值。
 * 先接受赤月、贵族秘身的已列组合，再检查本模块六人／十二人标准牌组；不是任意猎魔人混搭。
 * 按现有字段、牌组、胜利目标与政策检查，不创建角色、支付资源或授予行动权限。
 * 归档验证拥有独立实现，不以本生产判定作为验证 oracle。
 */
import { isNobleSecretBodyPreset } from "./noble-secret-body";
import { isRedMoonPreset } from "./red-moon";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { DEMON_HUNTER_POLICY } from "@ai-werewolf-arena/game-contract";
function exactDemonData(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
const decks: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  6: { wolf: 2, villager: 1, seer: 1, witch: 1, ["demon_hunter"]: 1 },
  12: { wolf: 3, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1, ["demon_hunter"]: 1 },
};
function equals(value: unknown, expected: Record<string, unknown>): boolean {
  return (
    exactDemonData(value, Object.keys(expected)) &&
    Object.entries(expected).every(([key, v]) => value[key] === v)
  );
}
/** 先按已列组合委托，再检查规范化标准牌组；注册角色不扩大组合支持范围。 */
export function isDemonHunterPreset(input: unknown): boolean {
  // 先按原顺序委托两个完整组合，再进入标准牌组检查；不能把已注册角色视作任意组合许可。
  if (isRedMoonPreset(input) || isNobleSecretBodyPreset(input)) return true;
  try {
    const c = copyEventData(input) as Record<string, any>;
    const required = [
      "boardSize",
      "enableSheriff",
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
    ];
    const allowed = [...required, "winCondition", "winConditions", "hunter", "guard", "sheriff"];
    if (
      !c ||
      Array.isArray(c) ||
      !required.every((key) => Object.hasOwn(c, key)) ||
      Object.keys(c).some((key) => !allowed.includes(key)) ||
      ![6, 12].includes(c.boardSize)
    )
      return false;
    const deck = decks[c.boardSize]!;
    if (!Array.isArray(c.roleSetups) || c.roleSetups.length !== Object.keys(deck).length)
      return false;
    const counts: Record<string, number> = {};
    for (const entry of c.roleSetups) {
      if (
        !exactDemonData(entry, ["role", "count"]) ||
        typeof entry.role !== "string" ||
        !Object.hasOwn(deck, entry.role) ||
        Object.hasOwn(counts, entry.role) ||
        entry.count !== deck[entry.role]
      )
        return false;
      counts[entry.role] = entry.count as number;
    }
    if (Object.hasOwn(c, "winConditions") && !Array.isArray(c.winConditions)) return false;
    const goals = c.winConditions ?? (c.winCondition ? [c.winCondition] : []);
    if (
      !Array.isArray(goals) ||
      goals.length !== 1 ||
      !["slaughter_city", "slaughter_side"].includes(goals[0]) ||
      (Object.hasOwn(c, "winCondition") && c.winCondition !== goals[0])
    )
      return false;
    if (
      !equals(c.demonHunter, { policy: DEMON_HUNTER_POLICY }) ||
      c.enableSheriff !== (c.boardSize === 12) ||
      !equals(c.seer, {
        targetPolicy: "awa_alive_v1",
        actionPolicy: "awa_required_when_legal_v1",
      }) ||
      !equals(c.witch, {
        canSelfHeal: "disabled",
        knifeVisibility: "awa_with_heal_v1",
        potionPolicy: "awa_one_native_v1",
      }) ||
      !equals(c.voting, { exilePolicy: "awa_direct_v1" }) ||
      !equals(c.disclosure, { deathRevealPolicy: "awa_hidden_v1" }) ||
      !equals(c.lastWords, { policy: "awa_initial_wave_v1" }) ||
      !equals(c.hooks, {
        onDaybreak: false,
        onPreElection: true,
        onPreVote: true,
        onPerSpeechGap: false,
      }) ||
      !exactDemonData(c.selfDestruct, ["enabledWindows"]) ||
      !Array.isArray(c.selfDestruct.enabledWindows) ||
      c.selfDestruct.enabledWindows.length !== 2 ||
      new Set(c.selfDestruct.enabledWindows).size !== 2 ||
      !c.selfDestruct.enabledWindows.every((w: string) =>
        ["on_pre_election", "on_pre_vote"].includes(w),
      )
    )
      return false;
    if (c.boardSize === 12)
      return (
        equals(c.sheriff, {
          electionPolicy: "awa_final_candidates_v1",
          badgePolicy: "awa_next_seat_v1",
          voteWeight: 1.5,
        }) &&
        equals(c.tieBreaker, {
          sheriffVote: "min_seat",
          wolfKillVote: "min_id",
          exileVote: "min_id",
        }) &&
        equals(c.guard, { repeatPolicy: "netease_consecutive_nights_v1" }) &&
        equals(c.hunter, { deathActionPolicy: "awa_knife_or_exile_v1" })
      );
    return (
      !Object.hasOwn(c, "guard") &&
      !Object.hasOwn(c, "hunter") &&
      !Object.hasOwn(c, "sheriff") &&
      equals(c.tieBreaker, { wolfKillVote: "min_id", exileVote: "min_id" })
    );
  } catch {
    return false;
  }
}
