/**
 * 负责已配置板子规则和政策的两语文案。输入为完整只读板子及请求语言；输出保原规则提示与片段顺序。
 * 文案在实际调用时读取原字段／默认值，不校验有限牌组、不修改参数、推进阶段或保存可变语言。
 * 查验文案只从独立政策公开入口读取，不通过显示路径装配夜阶段、领取库存或取得行动许可。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { settlesNightBeforeDay } from "../../rulesets/night-death-timing";
import { renderDeathActionPolicy } from "../../features/death-actions/death-action-policy";
import { renderInspectionPolicy } from "../../features/role-inspection/policy-ports";
import { WinCondition, WitchSelfHealRule, Role, KnightDuelWindow } from "../../domain/model";
import { roleName, term, text, type Locale } from "@ai-werewolf-arena/game-text";

export interface ConfigRenderRegistry {
  renderBoardConfigPrompt(config: ReadonlyBoardConfig, locale?: Locale): string;
}

export class DefaultConfigRenderRegistry implements ConfigRenderRegistry {
  renderBoardConfigPrompt(config: ReadonlyBoardConfig, locale: Locale = "zh-CN"): string {
    const winConditions = this.resolveWinConditions(config)
      .map((item) => term("rule", item, locale))
      .join("; ");
    const sheriffEnabled = config.enableSheriff === true;
    const windows = config.selfDestruct?.enabledWindows ?? [];
    const healRule = config.witch?.canSelfHeal ?? WitchSelfHealRule.Disabled;
    return [
      ...(config.fragrantPairSeer ? [text(locale, "rules.fragrant_pair_seer")] : []),
      ...(config.nobleSecretBody
        ? [
            text(
              locale,
              config.nightNoble?.wolfActionPolicy === "no_blast_no_self_knife"
                ? "prompt.config.noble_restricted"
                : "prompt.config.noble_standard",
            ),
            text(
              locale,
              config.awakenedIdiot?.protectionRepeatPolicy === "awa_repeat_v1"
                ? "prompt.config.body_repeat"
                : "prompt.config.body_nonconsecutive",
            ),
          ]
        : []),
      ...(config.radiantEclipse ? [text(locale, "rules.radiant_eclipse")] : []),
      text(locale, "prompt.config.title"),
      ...(config.awakenedWitch ? [text(locale, "prompt.config.awakened_witch")] : []),
      ...(config.awakenedWolfBeauty ? [text(locale, "prompt.config.awakened_wolf_beauty")] : []),
      ...(config.awakenedHunter ? [text(locale, "prompt.config.awakened_hunter")] : []),
      ...(config.awakenedGuard ? [text(locale, "prompt.config.awakened_guard")] : []),
      ...(config.awakenedKnight ? [text(locale, "prompt.config.awakened_knight")] : []),
      ...(config.warden ? [text(locale, "prompt.config.warden")] : []),
      ...(config.awakenedWolfKing ? [text(locale, "prompt.config.awakened_wolf_king")] : []),
      ...(config.silenceElder ? [text(locale, "prompt.config.silence_elder")] : []),
      ...(config.crow
        ? [
            text(locale, "prompt.config.crow", {
              ballot: text(
                locale,
                config.crow.ballotPolicy === "all_ballots"
                  ? "crow.ballot.all"
                  : "crow.ballot.first",
              ),
              action: text(
                locale,
                config.crow.actionPolicy === "required_when_legal"
                  ? "crow.action.required"
                  : "crow.action.optional",
              ),
              self: text(
                locale,
                config.crow.selfTarget ? "crow.self.allowed" : "crow.self.forbidden",
              ),
            }),
          ]
        : []),
      ...(config.scholarMentor ? [text(locale, "prompt.config.scholar_mentor")] : []),
      ...(config.magician
        ? [
            text(locale, "prompt.config.magician.first_night", { day: config.magician.firstNight }),
            text(
              locale,
              config.magician.deathShotTargetPolicy === "exchanged"
                ? "prompt.config.magician.shots_exchanged"
                : "prompt.config.magician.shots_original",
            ),
          ]
        : []),
      ...(config.wolfSorcerer
        ? [
            text(locale, "prompt.config.wolf_sorcerer.first_night", {
              day: config.wolfSorcerer.firstNight,
            }),
          ]
        : []),
      ...(config.timeConsort
        ? [
            text(
              locale,
              config.timeConsort.reflectionScope === "first_effect"
                ? "prompt.config.time_wolf_consort.scope_first_effect"
                : "prompt.config.time_wolf_consort.scope_whole_night",
            ),
          ]
        : []),
      ...(config.redMoon
        ? [
            text(
              locale,
              config.redMoon.lastWolfBlastPolicy === "forbidden"
                ? "prompt.config.red_moon_apostle.last_wolf_forbidden"
                : "prompt.config.red_moon_apostle.last_wolf_ends",
            ),
          ]
        : []),
      ...(config.nightmareShadow
        ? [
            text(
              locale,
              config.nightmareShadow.fearActionPolicy === "required_when_legal"
                ? "prompt.config.nightmare.required"
                : "prompt.config.nightmare.optional",
            ),
            text(
              locale,
              config.nightmareShadow.wolfActionPolicy === "standard"
                ? "prompt.config.nightmare.standard"
                : "prompt.config.nightmare.no_blast",
            ),
          ]
        : []),
      ...(config.evilKnight
        ? [
            text(
              locale,
              config.evilKnight.shotPolicy === "hunter_shot_bypasses"
                ? "prompt.config.evil_knight.gun_bypasses"
                : "prompt.config.evil_knight.gun_immune",
            ),
          ]
        : []),
      text(locale, "prompt.config.win", { rules: winConditions }),
      text(locale, "prompt.config.sheriff", {
        rules: sheriffEnabled
          ? text(locale, "prompt.config.sheriff_enabled", {
              weight: config.sheriff?.voteWeight ?? 1.5,
            })
          : text(locale, "common.disabled"),
      }),
      ...(sheriffEnabled
        ? [
            text(
              locale,
              config.mistRaven
                ? "prompt.config.mist_raven_timing"
                : settlesNightBeforeDay(config)
                  ? "prompt.config.night_before_sheriff"
                  : "prompt.config.sheriff_timing",
            ),
            text(
              locale,
              config.sheriff?.badgePolicy === "awa_holder_choice_v1"
                ? "prompt.config.badge_choice"
                : "prompt.config.badge_next",
            ),
          ]
        : []),
      text(locale, "prompt.config.blast", {
        rules: windows.length
          ? text(locale, "prompt.config.blast_enabled", {
              windows: windows.map((item) => term("stage", item, locale)).join(", "),
            })
          : text(locale, "common.disabled"),
      }),
      ...(config.witch
        ? [
            text(locale, "prompt.config.self_heal", {
              rules: text(
                locale,
                healRule === WitchSelfHealRule.Always
                  ? "prompt.config.self_heal_always"
                  : healRule === WitchSelfHealRule.FirstNightOnly
                    ? "prompt.config.self_heal_first"
                    : "prompt.config.self_heal_disabled",
              ),
            }),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.Guard && entry.count > 0)
        ? [
            text(
              locale,
              config.guard?.repeatPolicy === "netease_consecutive_nights_v1"
                ? "role.guard.repeat_actual_nights"
                : "role.guard.repeat_last_action",
            ),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.HiddenWolf && entry.count > 0)
        ? [
            text(
              locale,
              config.hiddenWolf?.campInspection === "netease_2020_good_v1"
                ? "role.hidden_wolf.camp_good_v1"
                : "role.hidden_wolf.camp_inheritance_v1",
            ),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.Dreamer && entry.count > 0)
        ? [
            text(
              locale,
              config.dreamer?.protectionPolicy === "netease_2026_night_immunity_v1"
                ? "role.dreamer.protection_netease"
                : "role.dreamer.protection_awa",
            ),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.WolfBeauty && entry.count > 0)
        ? [
            text(
              locale,
              config.wolfBeauty?.deathLinkPolicy === "heroes_s7_2017_exile_hunter_v1"
                ? "role.wolf_beauty.link_s7"
                : "role.wolf_beauty.link_awa",
            ),
          ]
        : []),
      ...(config.animalDream
        ? [
            text(locale, "rules.animal_dream", {
              catPolicy: text(
                locale,
                config.whiteCat!.skippedVotePolicy === "awa_wait_for_actual_exile_v1"
                  ? "animal.policy.cat_wait"
                  : "animal.policy.cat_skip",
              ),
              ballotPolicy: text(
                locale,
                config.pufferfish!.ballotPolicy === "awa_first_ballot_v1"
                  ? "animal.policy.puffer_first"
                  : "animal.policy.puffer_final",
              ),
            }),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.Seer && entry.count > 0)
        ? [
            text(
              locale,
              config.seer?.targetPolicy === "awa_fresh_others_v1"
                ? "role.seer.targets_fresh"
                : "role.seer.targets_alive",
            ),
            text(
              locale,
              config.seer?.actionPolicy !== "awa_optional_v1"
                ? "role.seer.action_required"
                : "role.seer.action_optional",
            ),
          ]
        : []),
      ...(config.roleSetups.some((entry) => entry.role === Role.Witch && entry.count > 0)
        ? [
            text(
              locale,
              config.witch?.knifeVisibility === "awa_always_v1"
                ? "role.witch.knife_always"
                : "role.witch.knife_with_heal",
            ),
            text(
              locale,
              config.witch?.potionPolicy === "awa_both_native_experimental_v1"
                ? "role.witch.potions_both"
                : "role.witch.potions_one",
            ),
          ]
        : []),
      ...(sheriffEnabled
        ? [
            text(
              locale,
              config.sheriff?.electionPolicy === "awa_nomination_offstage_pk_v1"
                ? "prompt.config.sheriff_pk"
                : "prompt.config.sheriff_direct",
            ),
          ]
        : []),
      text(
        locale,
        config.voting?.exilePolicy === "awa_one_pk_v1"
          ? "prompt.config.exile_pk"
          : "prompt.config.exile_direct",
      ),
      ...config.roleSetups
        .filter(
          (entry) =>
            entry.count > 0 && (entry.role === Role.Hunter || entry.role === Role.WolfKing),
        )
        .map(
          (entry) =>
            roleName(entry.role, locale) +
            ": " +
            renderDeathActionPolicy(
              entry.role === Role.Hunter
                ? config.hunter?.deathActionPolicy
                : config.wolfKing?.deathActionPolicy,
              locale,
            ),
        ),
      ...config.roleSetups
        .filter(
          (entry) =>
            entry.count > 0 && [Role.Gargoyle, Role.Psychic, Role.MirrorGirl].includes(entry.role),
        )
        .map(
          (entry) =>
            roleName(entry.role, locale) +
            ": " +
            renderInspectionPolicy(
              {
                policy:
                  entry.role === Role.Gargoyle
                    ? "gargoyle"
                    : entry.role === Role.Psychic
                      ? "psychic"
                      : "mirror",
                inspectionPolicy:
                  entry.role === Role.Gargoyle
                    ? config.gargoyle?.inspectionPolicy
                    : entry.role === Role.Psychic
                      ? config.psychic?.inspectionPolicy
                      : config.mirrorGirl?.inspectionPolicy,
              },
              locale,
            ),
        ),
      text(
        locale,
        config.disclosure?.deathRevealPolicy === "netease_2017_open_v1"
          ? "prompt.config.disclosure_open"
          : "prompt.config.disclosure",
      ),
      text(
        locale,
        config.lastWords?.policy === "netease_2017_day_and_first_night_v1"
          ? "prompt.config.last_words_2017"
          : "prompt.config.last_words",
      ),
      ...(config.roleSetups.some((entry) => entry.role === Role.Knight && entry.count > 0)
        ? [
            text(locale, "prompt.config.knight_windows", {
              windows:
                (config.knight?.enabledWindows ?? [KnightDuelWindow.AfterSpeeches])
                  .map((window) => term("stage", window, locale))
                  .join(", ") || text(locale, "common.disabled"),
            }),
          ]
        : []),
      text(locale, "prompt.config.ties", {
        exile: term("tie", config.tieBreaker?.exileVote ?? "min_id", locale),
        wolf: term("tie", config.tieBreaker?.wolfKillVote ?? "min_id", locale),
        sheriff: config.tieBreaker?.sheriffVote
          ? text(locale, "prompt.config.sheriff_tie", {
              tie: term("tie", config.tieBreaker.sheriffVote, locale),
            })
          : "",
      }),
    ].join("\n");
  }

  private resolveWinConditions(config: ReadonlyBoardConfig): readonly WinCondition[] {
    if (config.winConditions?.length) return config.winConditions;
    return config.winCondition ? [config.winCondition] : [WinCondition.SlaughterCity];
  }
}

let defaultRegistry: ConfigRenderRegistry | null = null;
export function getDefaultConfigRenderRegistry(): ConfigRenderRegistry {
  return (defaultRegistry ??= new DefaultConfigRenderRegistry());
}
