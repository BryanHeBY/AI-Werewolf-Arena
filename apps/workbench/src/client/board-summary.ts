/** 负责显示同角色组成的板子差异。输入公开规则字段，输出双语差异摘要；不读取私有配置或推断规则。 */
import type { BoardCard, Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import { boardLabel, hasBoardLabel } from "@ai-werewolf-arena/game-text/workbench-board";

function flatten(value: JsonObject, prefix = ""): Record<string, Json> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, value]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value))
        return Object.entries(flatten(value, field));
      return [[field, value]];
    }),
  );
}
export function variantRuleSummary(board: BoardCard, group: BoardCard[], locale: Locale): string {
  const fields = (value: BoardCard) =>
    flatten({
      rules: value.rules ?? {},
      mechanisms: value.mechanisms ?? {},
      roleOptions: value.roleOptions ?? {},
    });
  const current = fields(board),
    others = group.map(fields);
  return Object.entries(current)
    .filter(([path, value]) => {
      const leaf = path.split(".").at(-1)!;
      return (
        !path.startsWith("rules.hooks.") &&
        hasBoardLabel(leaf) &&
        others.some((other) => JSON.stringify(other[path]) !== JSON.stringify(value))
      );
    })
    .map(([path, value]) => {
      const keys = path.split(".");
      const label = boardLabel(locale, keys.at(-1)!);
      const role = keys[0] === "roleOptions" ? `${roleName(keys[1], locale)} · ` : "";
      const format = (v: Json) =>
        boardLabel(locale, typeof v === "boolean" ? `boolean.${v}` : String(v));
      return `${role}${label}：${Array.isArray(value) ? value.map(format).join(" / ") : format(value)}`;
    })
    .join("；");
}
