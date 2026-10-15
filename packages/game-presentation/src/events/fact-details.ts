/**
 * 将已校验事实中的玩家名单和死因整理为两端共用文案。
 * 这里只命名事件携带的原因，按原死亡名单顺序展示；不推断致死关系、不查询角色，也不决定受众。
 */
import type { Locale, MessageKey } from "@ai-werewolf-arena/game-contract";
import { text } from "@ai-werewolf-arena/game-text";

const deathMessages: Readonly<Record<string, MessageKey>> = {
  wolf_kill: "death.wolf_kill",
  poison: "death.poison",
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

export function factList(items: readonly string[], locale: Locale): string {
  return items.join(locale === "zh-CN" ? "、" : ", ") || text(locale, "common.none");
}

export function factPlayer(id: number | null, locale: Locale): string {
  return id === null ? text(locale, "common.none") : text(locale, "common.player", { id });
}

export function factPlayers(ids: readonly number[], locale: Locale): string {
  return factList(
    ids.map((id) => factPlayer(id, locale)),
    locale,
  );
}

export function deathCauses(causes: readonly string[], locale: Locale): string {
  return factList(
    causes.map((cause) => text(locale, deathMessages[cause] ?? "common.unknown")),
    locale,
  );
}

export function deathDetails(
  deaths: readonly number[],
  sources: Readonly<Record<string, readonly string[]>>,
  locale: Locale,
): string {
  return factList(
    deaths.map((id) =>
      text(locale, "event.death_detail", {
        player: factPlayer(id, locale),
        causes: deathCauses(sources[String(id)] ?? [], locale),
      }),
    ),
    locale,
  );
}

export function nightChoice(
  choice: { day: number; targetId: number | null } | null,
  locale: Locale,
): string {
  return choice === null
    ? text(locale, "common.none")
    : text(locale, "event.night_choice", {
        day: choice.day,
        target: factPlayer(choice.targetId, locale),
      });
}
