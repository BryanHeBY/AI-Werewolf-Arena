/**
 * 负责向运行装配及场景调用方提供既有板子预设。
 * 接收两项已列政策参数，每次构造新的贵族秘身十二人配置；默认值只选其中一个组合。
 * 输入为本模块固定声明和显式政策参数，输出为原 BoardConfig 数据；不在此解析、验证或冻结配置。
 * 预设不代表任意角色组合受支持，也不创建 World、支付资源或授予行动权限；规范化与有限支持由调用方继续执行。
 */
import {
  ActionWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  type BoardConfig,
} from "../../core/domain/model";
export function nobleSecretBodyTwelveConfig(
  wolfActionPolicy: "standard" | "no_blast_no_self_knife" = "standard",
  protectionRepeatPolicy:
    "awa_nonconsecutive_nights_v1" | "awa_repeat_v1" = "awa_nonconsecutive_nights_v1",
): BoardConfig {
  return {
    boardSize: 12,
    enableSheriff: true,
    nobleSecretBody: { policy: "awa_noble_secret_body_v1" },
    nightNoble: { wolfActionPolicy },
    awakenedIdiot: { protectionRepeatPolicy },
    demonHunter: { policy: "awa_netease_demon_hunter_v1" },
    winConditions: [WinCondition.SlaughterSide],
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    witch: {
      canSelfHeal: WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    sheriff: {
      electionPolicy: "awa_nomination_offstage_pk_v1",
      badgePolicy: "awa_holder_choice_v1",
      voteWeight: 1.5,
    },
    tieBreaker: {
      sheriffVote: "no_elimination",
      wolfKillVote: "min_id",
      exileVote: "no_elimination",
    },
    voting: { exilePolicy: "awa_one_pk_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
    roleSetups: [
      { role: Role.NightNoble, count: 1 },
      { role: Role.Seer, count: 1 },
      { role: Role.Witch, count: 1 },
      { role: Role.DemonHunter, count: 1 },
      { role: Role.AwakenedIdiot, count: 1 },
      { role: Role.Villager, count: 4 },
      { role: Role.Wolf, count: 3 },
    ],
  };
}
