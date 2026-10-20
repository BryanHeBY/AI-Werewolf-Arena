/** 负责游戏配置摘要；输入为已保存原文与公开目录，输出板子和 Agent 继承关系。不展开认证字段，不推断发牌。 */
import type { JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "./types";
import { asObject } from "./config-edit";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import { effectiveGameSettings } from "./game-config";
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
  const effective = effectiveGameSettings(raw),
    board = catalog.boards.find((b) => b.id === effective.board),
    bindings = (field: "roles" | "players") =>
      Object.entries(asObject(raw[field])).flatMap(([id, value]) => {
        const agent = asObject(value).agent;
        return typeof agent === "string"
          ? [`${field === "roles" ? roleName(id, locale) : id} → ${agent}`]
          : [];
      });
  const instruction = (value: unknown) => {
    const data = asObject(value),
      mode = String(data.mode ?? "append"),
      body = data.text;
    return (
      <>
        <strong>
          {t(mode === "clear" ? "clearInstructions" : mode === "replace" ? "replace" : "append")}
        </strong>
        {mode !== "clear" && (
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {typeof body === "string" ? body : JSON.stringify(body, null, 2)}
          </pre>
        )}
      </>
    );
  };
  const roleInstructions = Object.entries(asObject(raw.roles)).filter(
    ([, row]) => asObject(row).customInstructions !== undefined,
  );
  const playerSettings = Object.entries(asObject(raw.players));
  return (
    <dl className="config-summary">
      <div>
        <dt>{t("chooseBoard")}</dt>
        <dd>
          {String(effective.board)}
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
      {(
        [
          ["maxDays", "maxDays", 1],
          ["maxRuntimeMs", "maxRuntime", 60_000],
          ["llmTimeoutMs", "turnTimeout", 1_000],
        ] as const
      ).map(([field, label, unit]) => (
        <div key={field}>
          <dt>{t(label)}</dt>
          <dd>
            {Number(effective[field]) / unit}
            {raw[field] === undefined && (
              <small className="muted"> · {configUiText(locale, "runtimeDefault")}</small>
            )}
          </dd>
        </div>
      ))}
      <div>
        <dt>{t("language")}</dt>
        <dd>{String(effective.locale)}</dd>
      </div>
      {raw.displayLocale !== undefined && (
        <div>
          <dt>{configUiText(locale, "displayLanguage")}</dt>
          <dd>{String(raw.displayLocale)}</dd>
        </div>
      )}
      <div>
        <dt>{configUiText(locale, "terminalOutput")}</dt>
        <dd>
          {(
            [
              ["streamEvents", "chatLogs"],
              ["printThinking", "thinkingLogs"],
              ["printPrivateEvents", "privateLogs"],
            ] as const
          ).map(([field, label]) => (
            <p key={field}>
              {t(label)}: {configUiText(locale, effective[field] === true ? "enabled" : "disabled")}
              {raw[field] === undefined && (
                <small className="muted"> · {configUiText(locale, "runtimeDefault")}</small>
              )}
            </p>
          ))}
        </dd>
      </div>
      {raw.customInstructions !== undefined && (
        <div>
          <dt>{t("globalInstructions")}</dt>
          <dd>{instruction(raw.customInstructions)}</dd>
        </div>
      )}
      {roleInstructions.length > 0 && (
        <div>
          <dt>{configUiText(locale, "roleInstructions")}</dt>
          <dd>
            {roleInstructions.map(([role, row]) => (
              <details key={role}>
                <summary>{roleName(role, locale)}</summary>
                {instruction(asObject(row).customInstructions)}
              </details>
            ))}
          </dd>
        </div>
      )}
      {playerSettings.length > 0 && (
        <div>
          <dt>{configUiText(locale, "playerSettings")}</dt>
          <dd>
            {playerSettings.map(([seat, row]) => {
              const value = asObject(row);
              return (
                <details key={seat}>
                  <summary>
                    {t("seat")} {seat}
                    {typeof value.name === "string" ? ` · ${value.name}` : ""}
                  </summary>
                  <p>
                    {t("defaultAgent")}:{" "}
                    {typeof value.agent === "string"
                      ? value.agent
                      : configUiText(locale, "inheritRoleAgent")}
                  </p>
                  {value.customInstructions !== undefined && instruction(value.customInstructions)}
                </details>
              );
            })}
          </dd>
        </div>
      )}
      <div>
        <dt>{configUiText(locale, "budgetTitle")}</dt>
        <dd className="muted">
          {configUiText(locale, "budgetHelp")} {configUiText(locale, "turnLimitHelp")}
        </dd>
      </div>
    </dl>
  );
}
