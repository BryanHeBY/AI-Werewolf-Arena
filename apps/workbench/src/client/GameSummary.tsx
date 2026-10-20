/** 负责游戏配置摘要；输入为已保存原文与公开目录，输出板子和 Agent 继承关系。不展开认证字段，不推断发牌。 */
import type { JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "./types";
import { asObject } from "./config-edit";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
export function GameSummary({
  raw,
  catalog,
  locale,
  t,
}: {
  raw: JsonObject;
  catalog: Catalog;
  locale: Locale;
  t: Translator;
}) {
  const board = catalog.boards.find((b) => b.id === raw.board),
    bindings = (field: "roles" | "players") =>
      Object.entries(asObject(raw[field])).flatMap(([id, value]) => {
        const agent = asObject(value).agent;
        return typeof agent === "string"
          ? [`${field === "roles" ? roleName(id, locale) : id} → ${agent}`]
          : [];
      });
  return (
    <dl className="config-summary">
      <div>
        <dt>{t("chooseBoard")}</dt>
        <dd>
          {String(raw.board ?? "—")}
          {board && ` · ${board.size}`}
        </dd>
      </div>
      <div>
        <dt>{t("defaultAgent")}</dt>
        <dd>{String(raw.agent ?? catalog.defaultAgent ?? "—")}</dd>
      </div>
      <div>
        <dt>{configUiText(locale, "roleAgents")}</dt>
        <dd>{bindings("roles").join(" · ") || t("inherited")}</dd>
      </div>
      <div>
        <dt>{configUiText(locale, "seatAgents")}</dt>
        <dd>{bindings("players").join(" · ") || t("inherited")}</dd>
      </div>
    </dl>
  );
}
