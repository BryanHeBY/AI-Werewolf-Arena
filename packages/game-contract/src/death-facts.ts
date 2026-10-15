/**
 * 负责稳定死因机器标识与可序列化来源列表；输入为死亡提案或已记录的来源数据，
 * 输出保持枚举成员、值与迭代顺序，不在此处标死、过滤来源、决定优先级或处理伤害。
 * 原生命、来源资格、保护效果及死亡枪回调仍归运行所有者；数据记录不授予结算权限。
 */
export enum DeathCause {
  WhiteCatExpiry = "white_cat_expiry",
  PufferRetaliation = "puffer_retaliation",
  FragrantLink = "fragrant_link",
  ServantExpiry = "servant_expiry",
  RadiantBacklash = "radiant_backlash",
  RavenClawKnife = "raven_claw_knife",
  WolfKill = "wolf_kill",
  Poison = "poison",
  EvilKnightReflection = "evil_knight_reflection",
  PureWhiteInspection = "pure_white_inspection",
  WolfWitchInspection = "wolf_witch_inspection",
  DemonHunt = "demon_hunt",
  DemonHuntBacklash = "demon_hunt_backlash",
  Shot = "shot",
  Exile = "exile",
  RedMoonExpiry = "red_moon_expiry",
  SelfDestruct = "self_destruct",
  WhiteWolfBlast = "white_wolf_blast",
  Lovers = "lovers",
  Dream = "dream",
  FoxInspection = "fox_inspection",
  Charm = "charm",
  Duel = "duel",
  DuelFailure = "duel_failure",
  Ability = "ability",
  MechanicalKnife = "mechanical_knife",
  AwakenedHiddenKnife = "awakened_hidden_knife",
  MechanicalGuardFailure = "mechanical_guard_failure",
  MerchantBacklash = "merchant_backlash",
  BlackMarketBacklash = "black_market_backlash",
  Deal = "deal",
  AwakenedPatrol = "awakened_patrol",
  AwakenedBeautyReplacement = "awakened_beauty_replacement",
  AwakenedDuel = "awakened_duel",
}
/** 按实体编号保存可写来源数组；追加、覆盖、稳定去重与闭包展开由各结算调用方按原顺序执行。 */
export type DeathSources = Record<number, DeathCause[]>;
