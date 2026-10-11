import {
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
} from "@ai-werewolf-arena/game-text";
import { Role, WinCondition } from "../../../core/domain/identity";
import type { BoardConfig } from "../../../core/domain/board";
import { isDemonHunterPreset } from "./demon_hunter/preset";

/** Shared finite-board eligibility for configuration checks and direct bootstrap callers. */
export function boardPresetViolation(config: BoardConfig) {
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
  return null;
}
