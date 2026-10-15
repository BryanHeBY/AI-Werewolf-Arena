/**
 * 负责游戏装配前的生产有限板子拒绝分派。输入为规范化的 ReadonlyBoardConfig，
 * 输出为既有顺序中的首个违规码或 null；不创建角色、状态或效果。
 * 猎魔人分支先经过其 Node 自有数据快照入口，再执行有限纯数据判定。
 * 单个裁决不授予运行能力；归档验证不导入本生产分派或其政策。
 */
import {
  isAnimalDreamPreset,
  isFragrantPairSeerPreset,
  isNobleSecretBodyPreset,
  isTricksterPreset,
  isOrderPrincePreset,
  isScholarMentorPreset,
  isMistRavenPreset,
  isRadiantEclipsePreset,
  isTimeConsortPreset,
  isWolfSorcererPreset,
  isMagicianPreset,
  isRedMoonPreset,
  isNightmarePreset,
  isEvilKnightPreset,
  isPureWhitePreset,
  isGhostBridePreset,
} from "./support";
import { isCrowPreset } from "./support/crow";
import { Role, WinCondition } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { isDemonHunterPreset } from "./node-board-support";

/** 配置检查与直接 bootstrap 调用方共用有限支持裁决；首个违规命中即返回，后续分支不再读取。 */
export function boardPresetViolation(config: ReadonlyBoardConfig) {
  if (
    (config.animalDream ||
      config.bear?.signalPolicy === "netease_dawn_live_v1" ||
      config.whiteCat ||
      config.pufferfish ||
      config.roleSetups.some(
        (row) => [Role.WhiteCat, Role.FoxCub, Role.Pufferfish].includes(row.role) && row.count > 0,
      )) &&
    !isAnimalDreamPreset(config)
  )
    return "animal_dream_preset_invalid";
  if (config.bear && !config.roleSetups.some((row) => row.role === Role.Bear && row.count > 0))
    return "bear_role_required";
  if (
    (config.fragrantPairSeer ||
      config.roleSetups.some(
        (row) =>
          (row.role === Role.FragrantPhantom || row.role === Role.AwakenedSeer) && row.count > 0,
      )) &&
    !isFragrantPairSeerPreset(config)
  )
    return "fragrant_pair_seer_preset_invalid";
  if (
    (config.nobleSecretBody ||
      config.nightNoble ||
      config.awakenedIdiot ||
      config.roleSetups.some(
        (row) => [Role.NightNoble, Role.AwakenedIdiot].includes(row.role) && row.count > 0,
      )) &&
    !isNobleSecretBodyPreset(config)
  )
    return "noble_secret_body_preset_invalid";
  if (
    (config.radiantEclipse ||
      config.roleSetups.some(
        (row) => (row.role === Role.RadiantCount || row.role === Role.EclipseMaid) && row.count > 0,
      )) &&
    !isRadiantEclipsePreset(config)
  )
    return "radiant_eclipse_preset_invalid";
  if (
    (config.mistRaven ||
      config.roleSetups.some(
        (row) => (row.role === Role.Alchemist || row.role === Role.RavenClawWolf) && row.count > 0,
      )) &&
    !isMistRavenPreset(config)
  )
    return "mist_raven_preset_invalid";
  if (
    (config.trickster ||
      config.roleSetups.some((row) => row.role === Role.Trickster && row.count > 0)) &&
    !isTricksterPreset(config)
  )
    return "trickster_preset_invalid";
  if (
    (config.scholarMentor ||
      config.roleSetups.some(
        (row) => (row.role === Role.DayScholar || row.role === Role.NightMentor) && row.count > 0,
      )) &&
    !isScholarMentorPreset(config)
  )
    return "scholar_mentor_preset_invalid";
  if (
    (config.timeConsort ||
      config.roleSetups.some((row) => row.role === Role.TimeWolfConsort && row.count > 0)) &&
    !isTimeConsortPreset(config)
  )
    return "time_consort_preset_invalid";
  if (
    (config.wolfSorcerer ||
      config.roleSetups.some((row) => row.role === Role.WolfSorcerer && row.count > 0)) &&
    !isWolfSorcererPreset(config)
  )
    return "wolf_sorcerer_preset_invalid";
  if (
    (config.magician ||
      config.roleSetups.some((row) => row.role === Role.Magician && row.count > 0)) &&
    !isMagicianPreset(config)
  )
    return "magician_preset_invalid";
  if (
    (config.redMoon ||
      config.roleSetups.some((row) => row.role === Role.RedMoonApostle && row.count > 0)) &&
    !isRedMoonPreset(config)
  )
    return "red_moon_preset_invalid";
  if (
    (config.nightmareShadow ||
      config.roleSetups.some((row) => row.role === Role.NightmareShadow && row.count > 0)) &&
    !isNightmarePreset(config)
  )
    return "nightmare_preset_invalid";
  if (
    (config.evilKnight ||
      config.roleSetups.some((row) => row.role === Role.EvilKnight && row.count > 0)) &&
    !isEvilKnightPreset(config)
  )
    return "evil_knight_preset_invalid";
  if (
    (config.pureWhite ||
      config.wolfWitch ||
      config.roleSetups.some(
        (row) => (row.role === Role.PureWhiteGirl || row.role === Role.WolfWitch) && row.count > 0,
      )) &&
    !isPureWhitePreset(config)
  )
    return "pure_white_preset_invalid";
  if (
    config.roleSetups.some((row) => row.role === Role.DemonHunter && row.count > 0) ||
    config.demonHunter
  )
    if (!isDemonHunterPreset(config)) return "demon_hunter_preset_invalid";
  const ownsGhost = config.roleSetups.some((row) => row.role === Role.GhostBride && row.count > 0);
  if (
    ownsGhost ||
    config.ghostBride ||
    config.winConditions?.includes(WinCondition.ThreeFactionsElimination) ||
    config.winCondition === WinCondition.ThreeFactionsElimination
  )
    if (!isGhostBridePreset(config)) return "ghost_bride_preset_invalid";
  if (
    (config.orderPrince ||
      config.roleSetups.some((row) => row.role === Role.OrderPrince && row.count > 0)) &&
    !isOrderPrincePreset(config)
  )
    return "order_prince_preset_invalid";
  if (
    (config.crow || config.roleSetups.some((row) => row.role === Role.Crow && row.count > 0)) &&
    !isCrowPreset(config)
  )
    return "crow_preset_invalid";
  return null;
}
