/**
 * Owns ordered supported-board rejection and role-deck construction for bootstrap.
 * Inputs are the original BoardConfig, optional exact fixed cards and narrow readonly
 * catalog/event support queries; outputs are the original mutable card sequence or
 * original first rejection. The catalog factory and profile fields are observed at
 * their existing repeated read sites, without copying or freezing either source.
 * This owner never creates World/components, draws RNG, parses external configuration
 * or grants actor authority; bootstrap retains deal shuffle and assembly timing.
 */
import { Camp, Role, WinCondition, type BoardConfig } from "@ai-werewolf-arena/game-contract";
import { boardPresetViolation } from "./board-support";

/** Read-only metadata queries preserve the original catalog and profile identities. */
export interface SupportedRoleDeckCatalog {
  readonly require: (role: Role) => {
    readonly maxCount?: number;
    readonly supportedWinConditions?: readonly WinCondition[];
    readonly supportedBoardRoles?: readonly Role[];
  };
  readonly getCamp: (role: Role) => Camp;
}

export function buildSupportedRoleDeck(
  config: BoardConfig,
  fixedRoles: readonly Role[] | undefined,
  getDefaultRoleCatalog: () => SupportedRoleDeckCatalog,
  supportsWallRoles: (roles: readonly Role[]) => boolean,
): Role[] {
  const presetViolation = boardPresetViolation(config);
  if (presetViolation) throw new Error(presetViolation);
  const deck: Role[] = [];
  for (const setup of config.roleSetups) {
    for (let i = 0; i < setup.count; i++) {
      deck.push(setup.role);
    }
  }

  if (
    config.events &&
    (!supportsWallRoles(deck) || config.events.pack !== "awa_wall_notes_once_v1")
  )
    throw new Error("event_pack_combination_not_supported");
  const counts = new Map<Role, number>();
  for (const role of deck) counts.set(role, (counts.get(role) ?? 0) + 1);
  for (const [role, count] of counts) {
    const maximum = getDefaultRoleCatalog().require(role).maxCount;
    if (maximum !== undefined && count > maximum)
      throw new Error(`role_count_exceeds_limit: ${role}`);
  }
  for (const role of counts.keys()) {
    const profile = getDefaultRoleCatalog().require(role);
    const conditions = config.winConditions?.length
      ? config.winConditions
      : [config.winCondition ?? WinCondition.SlaughterCity];
    if (
      profile.supportedWinConditions &&
      (new Set(conditions).size !== conditions.length ||
        conditions.some((condition) => !profile.supportedWinConditions!.includes(condition)))
    )
      throw new Error(`role_win_condition_not_supported: ${role}`);
    const supported = profile.supportedBoardRoles;
    if (supported && [...counts.keys()].some((candidate) => !supported.includes(candidate)))
      throw new Error(`role_combination_not_supported: ${role}`);
  }

  if (deck.length !== config.boardSize) {
    throw new Error(`Role setup mismatch: boardSize=${config.boardSize}, roles=${deck.length}`);
  }

  if (
    config.thief &&
    (!counts.has(Role.Thief) || config.thief.policy !== "lui_meme_thief_two_extra_villagers_v1")
  )
    throw new Error("thief_policy_invalid");
  if (
    config.lonelyGirl &&
    (!counts.has(Role.LonelyGirl) || config.lonelyGirl.policy !== "awa_netease_lonely_girl_v1")
  )
    throw new Error("lonely_girl_policy_invalid");
  if (
    counts.has(Role.LonelyGirl) &&
    (config.boardSize < 6 ||
      !counts.has(Role.Wolf) ||
      ![...counts.keys()].some(
        (role) => role !== Role.LonelyGirl && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
      ))
  )
    throw new Error("lonely_girl_finite_composition_required");
  if (
    config.wildChild &&
    (!counts.has(Role.WildChild) || config.wildChild.policy !== "awa_lui_meme_wild_child_v1")
  )
    throw new Error("wild_child_policy_invalid");
  if (
    counts.has(Role.WildChild) &&
    ((counts.get(Role.Wolf) ?? 0) < 1 ||
      [...counts]
        .filter(
          ([role]) =>
            role !== Role.WildChild && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
        )
        .reduce((n, [, count]) => n + count, 0) < 1)
  )
    throw new Error("wild_child_finite_composition_required");
  if (
    config.shapeshifter &&
    (!counts.has(Role.Shapeshifter) ||
      config.shapeshifter.policy !== "awa_netease_shapeshifter_two_extra_villagers_v1")
  )
    throw new Error("shapeshifter_policy_invalid");
  if (counts.has(Role.Shapeshifter)) {
    if (
      config.boardSize < 6 ||
      (counts.get(Role.Wolf) ?? 0) < 2 ||
      [...counts]
        .filter(
          ([role]) =>
            role !== Role.Shapeshifter && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
        )
        .reduce((n, [, count]) => n + count, 0) < 1
    )
      throw new Error("shapeshifter_finite_composition_required");
    deck.push(Role.Villager, Role.Villager);
  }
  if (counts.has(Role.Thief)) {
    if (
      (counts.get(Role.Wolf) ?? 0) < 2 ||
      [...counts]
        .filter(
          ([role]) => role !== Role.Thief && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
        )
        .reduce((n, [, count]) => n + count, 0) < 2
    )
      throw new Error("thief_finite_composition_required");
    deck.push(Role.Villager, Role.Villager);
  }
  if (fixedRoles) {
    if (
      fixedRoles.length !== deck.length ||
      [...fixedRoles].sort().join(",") !== [...deck].sort().join(",")
    )
      throw new Error("fixed_role_deck_mismatch");
    return [...fixedRoles];
  }
  return deck;
}
