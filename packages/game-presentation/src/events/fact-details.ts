/**
 * 负责把输入的已校验玩家名单和死因整理为两端共用文案，输出自然语言片段。
 * 这里只命名事件携带的原因，按原死亡名单顺序展示；不推断致死关系、不查询角色，也不决定受众。
 */
import { type PlayerText } from "../players";
import type { Locale, MessageKey } from "@ai-werewolf-arena/game-contract";
import { text as defaultText } from "@ai-werewolf-arena/game-text";

const deathMessages: Readonly<Record<string, MessageKey>> = {
  awakened_duel: "death.awakened_duel",
  awakened_beauty_replacement: "death.awakened_beauty_replacement",
  awakened_patrol: "death.awakened_patrol",
  wolf_kill: "death.wolf_kill",
  poison: "death.poison",
  deal: "death.deal",
  exile: "death.exile",
  self_destruct: "death.self_destruct",
  shot: "death.shot",
  charm: "death.charm",
  puffer_retaliation: "death.puffer_retaliation",
  white_cat_expiry: "death.white_cat_expiry",
  servant_expiry: "death.servant_expiry",
  fragrant_link: "death.fragrant_link",
  demon_hunt: "death.demon_hunt",
  demon_hunt_backlash: "death.demon_hunt_backlash",
};

export function factList(
  items: readonly string[],
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  return items.join(locale === "zh-CN" ? "、" : ", ") || text(locale, "common.none");
}

export function factPlayer(
  id: number | null,
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  return id === null ? text(locale, "common.none") : text(locale, "common.player", { id });
}

export function factPlayers(
  ids: readonly number[],
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  return factList(
    ids.map((id) => factPlayer(id, locale, text)),
    locale,
    text,
  );
}

export function deathCauses(
  causes: readonly string[],
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  return factList(
    causes.map((cause) => text(locale, deathMessages[cause] ?? "common.unknown")),
    locale,
    text,
  );
}

export function deathDetails(
  deaths: readonly number[],
  sources: Readonly<Record<string, readonly string[]>>,
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  return factList(
    deaths.map((id) =>
      text(locale, "event.death_detail", {
        player: factPlayer(id, locale, text),
        causes: deathCauses(sources[String(id)] ?? [], locale, text),
      }),
    ),
    locale,
    text,
  );
}

export function nightChoice(
  choice: { day: number; targetId: number | null } | null,
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  return choice === null
    ? text(locale, "common.none")
    : text(locale, "event.night_choice", {
        day: choice.day,
        target: factPlayer(choice.targetId, locale, text),
      });
}
