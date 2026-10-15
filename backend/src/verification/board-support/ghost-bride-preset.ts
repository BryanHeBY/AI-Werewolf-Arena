/**
 * 负责独立核验归档中的鬼魂新娘有限板子。输入为归档中已规范化的纯数据，输出为支持布尔值。
 * 十二人固定牌组、三方胜利目标及既定警长／自爆配置；内部绕过公开 schema 的调用也须满足本判定。
 * 本目录保留来自 Git 80ce15f 的独立判定及调用顺序，不导入生产规则集作验证 oracle。
 * 中立契约仅供应数据复制、事实与稳定政策标识；此处不是敌意对象的 Node 安全入口。
 * 通过数据 schema 不等于通过板子支持检查；本模块不授权行动或写入游戏状态。
 */
import {
  GHOST_BRIDE_GOAL,
  GHOST_BRIDE_POLICY,
  GHOST_BRIDE_ROLE,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
// 仅为复制后数据的局部类型视图；类型断言本身不校验字段，下面仍逐项核牌组与政策。
interface PresetCandidate {
  boardSize: number;
  enableSheriff: boolean;
  ghostBride: { policy: string };
  roleSetups: Array<{ role: string; count: number }>;
  winConditions?: string[];
  winCondition?: string;
  seer: { targetPolicy: string; actionPolicy: string };
  guard: { repeatPolicy: string };
  witch: { canSelfHeal: string; knifeVisibility: string; potionPolicy: string };
  hunter: { deathActionPolicy: string };
  sheriff: { electionPolicy: string; badgePolicy: string; voteWeight: number };
  tieBreaker: { sheriffVote: string; wolfKillVote: string; exileVote: string };
  voting: { exilePolicy: string };
  disclosure: { deathRevealPolicy: string };
  lastWords: { policy: string };
  hooks: {
    onPreElection: boolean;
    onPreVote: boolean;
    onDaybreak: boolean;
    onPerSpeechGap: boolean;
  };
  selfDestruct: { enabledWindows: string[] };
}
const deck: Readonly<Record<string, number>> = Object.freeze({
  wolf: 3,
  villager: 4,
  seer: 1,
  witch: 1,
  hunter: 1,
  guard: 1,
  [GHOST_BRIDE_ROLE]: 1,
});
function exact(value: unknown, keys: readonly string[]): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((k) => Object.hasOwn(value, k))
  );
}
/** 校验规范化有限预设；内部绕过公开 schema 的调用也沿此完整判定。 */
export function isGhostBridePreset(config: unknown): boolean {
  let c: PresetCandidate;
  try {
    c = copyEventData(config) as PresetCandidate;
  } catch {
    return false;
  }
  const required = [
      "boardSize",
      "enableSheriff",
      "ghostBride",
      "roleSetups",
      "hooks",
      "selfDestruct",
      "seer",
      "guard",
      "witch",
      "hunter",
      "sheriff",
      "tieBreaker",
      "voting",
      "disclosure",
      "lastWords",
    ],
    allowed = [...required, "winConditions", "winCondition"];
  if (
    !c ||
    typeof c !== "object" ||
    Array.isArray(c) ||
    !required.every((k) => Object.hasOwn(c, k)) ||
    Object.keys(c).some((k) => !allowed.includes(k)) ||
    !Array.isArray(c.roleSetups) ||
    c.roleSetups.length !== 7
  )
    return false;
  // 行数、唯一角色和各角色数量共同限定牌组；不依赖输入行顺序，也不按总人数放行替代牌。
  const counts: Record<string, number> = {};
  for (const entry of c.roleSetups) {
    if (
      !exact(entry, ["role", "count"]) ||
      typeof entry.role !== "string" ||
      !Object.hasOwn(deck, entry.role) ||
      !Number.isSafeInteger(entry.count) ||
      entry.count < 1 ||
      Object.hasOwn(counts, entry.role)
    )
      return false;
    counts[entry.role] = entry.count;
  }
  if (Object.hasOwn(c, "winConditions") && !Array.isArray(c.winConditions)) return false;
  // 多目标字段优先；若同时提供旧单目标字段，两者必须指向同一三方目标。窗口按集合检查而非顺序。
  const goals = c.winConditions ?? (c.winCondition ? [c.winCondition] : []),
    windows = c.selfDestruct?.enabledWindows;
  if (
    c.boardSize !== 12 ||
    Object.keys(counts).length !== Object.keys(deck).length ||
    !Object.entries(deck).every(([role, count]) => counts[role] === count) ||
    !exact(c.ghostBride, ["policy"]) ||
    c.ghostBride.policy !== GHOST_BRIDE_POLICY ||
    !Array.isArray(goals) ||
    goals.length !== 1 ||
    (goals[0] as unknown) !== GHOST_BRIDE_GOAL ||
    (Object.hasOwn(c, "winCondition") && (c.winCondition as unknown) !== GHOST_BRIDE_GOAL) ||
    c.enableSheriff !== true ||
    !exact(c.seer, ["targetPolicy", "actionPolicy"]) ||
    c.seer?.targetPolicy !== "awa_alive_v1" ||
    c.seer.actionPolicy !== "awa_required_when_legal_v1" ||
    !exact(c.guard, ["repeatPolicy"]) ||
    c.guard?.repeatPolicy !== "netease_consecutive_nights_v1" ||
    !exact(c.witch, ["canSelfHeal", "knifeVisibility", "potionPolicy"]) ||
    c.witch?.canSelfHeal !== "disabled" ||
    c.witch.knifeVisibility !== "awa_with_heal_v1" ||
    c.witch.potionPolicy !== "awa_one_native_v1" ||
    !exact(c.hunter, ["deathActionPolicy"]) ||
    c.hunter?.deathActionPolicy !== "awa_knife_or_exile_v1" ||
    !exact(c.sheriff, ["electionPolicy", "badgePolicy", "voteWeight"]) ||
    c.sheriff?.electionPolicy !== "awa_final_candidates_v1" ||
    c.sheriff.badgePolicy !== "awa_next_seat_v1" ||
    c.sheriff.voteWeight !== 1.5 ||
    !exact(c.tieBreaker, ["sheriffVote", "wolfKillVote", "exileVote"]) ||
    c.tieBreaker?.sheriffVote !== "min_seat" ||
    c.tieBreaker.wolfKillVote !== "min_id" ||
    c.tieBreaker.exileVote !== "min_id" ||
    !exact(c.voting, ["exilePolicy"]) ||
    c.voting?.exilePolicy !== "awa_direct_v1" ||
    !exact(c.disclosure, ["deathRevealPolicy"]) ||
    c.disclosure?.deathRevealPolicy !== "awa_hidden_v1" ||
    !exact(c.lastWords, ["policy"]) ||
    c.lastWords?.policy !== "awa_initial_wave_v1" ||
    !exact(c.hooks, ["onPreElection", "onPreVote", "onDaybreak", "onPerSpeechGap"]) ||
    c.hooks.onPreElection !== true ||
    c.hooks.onPreVote !== true ||
    c.hooks.onDaybreak !== false ||
    c.hooks.onPerSpeechGap !== false ||
    !exact(c.selfDestruct, ["enabledWindows"]) ||
    !Array.isArray(windows) ||
    windows.length !== 2 ||
    new Set(windows).size !== 2 ||
    !windows.includes("on_pre_election") ||
    !windows.includes("on_pre_vote")
  )
    return false;
  return true;
}
