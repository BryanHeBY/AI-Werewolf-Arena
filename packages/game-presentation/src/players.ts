/**
 * 负责公开玩家资料的双语标签和事件模板插值。输入名单必须已经完成受众裁剪；
 * 输出为纯文本标签与局部格式化函数，只替换模板内明确的玩家参数，姓名、发言、思考等用户原文都只插入一次，不再次扫描。
 */
import type { Locale, PublicPlayerIdentity } from "@ai-werewolf-arena/game-contract";
import { dictionaries, text } from "@ai-werewolf-arena/game-text";

export type PlayerText = typeof text;
export type NamedPlayer = Pick<PublicPlayerIdentity, "id" | "name">;

export function playerLabel(player: NamedPlayer, locale: Locale = "zh-CN"): string {
  const number = text(locale, "common.player", { id: player.id });
  return player.name ? `${number}·${player.name}` : number;
}

// 这些名称仅用于事件展示参数；日期、轮次、权重、技能编号都不作玩家编号解释。
const playerParameters = new Set([
  "id",
  "actor",
  "target",
  "from",
  "to",
  "winner",
  "hunter",
  "sheriff",
  "partner",
  "first",
  "second",
  "bride",
  "groom",
  "giver",
  "witness",
  "recipient",
  "caster",
  "witch",
  "source",
  "effective",
  "requested",
  "blocked",
]);
const playerIdMessages = new Set([
  "common.player",
  "common.player_reference",
  "replay.player",
  "replay.player_timeline",
  "replay.lineup_player",
]);

/** 保留 text 的严格参数校验与缺省输出；显式传入名单，不使用跨局可变的全局展示状态。 */
export function createPlayerText(players: readonly NamedPlayer[] = []): PlayerText {
  const names = new Map(
    players.filter((player) => player.name).map((player) => [player.id, player]),
  );
  return (locale, key, parameters = {}) => {
    const original = text(locale, key, parameters);
    if (!names.size) return original;
    // 在词典模板上消费“号／Player”等编号单位，而非对渲染后的整行做替换。
    return dictionaries[locale][key].replace(
      /(Player |player )?\{([a-zA-Z][a-zA-Z0-9_]*)\}([ \t]*号(?:玩家)?)?/g,
      (_placeholder, prefix: string | undefined, parameter: string, suffix: string | undefined) => {
        const value = parameters[parameter];
        const id =
          typeof value === "number" ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
        const isPlayer =
          playerParameters.has(parameter) && (parameter !== "id" || playerIdMessages.has(key));
        const player = isPlayer ? names.get(id) : undefined;
        return player
          ? playerLabel(player, locale)
          : `${prefix ?? ""}${String(value)}${suffix ?? ""}`;
      },
    );
  };
}
