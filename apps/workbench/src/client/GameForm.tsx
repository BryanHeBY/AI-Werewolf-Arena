/**
 * 负责游戏向导中的板子、Agent 继承、指令及时间设置；输入原始 JSON，输出局部字段编辑。
 * 只呈现公开配置，不预先发牌或覆盖未展示字段；最终支持判断由服务端配置检查负责。
 */
import type { Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "./types";
import { asObject, readPath } from "./config-edit";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import {
  effectiveGameSettings,
  inapplicableGameBindings,
  removeInapplicableGameBindings,
  updateGameField,
} from "./game-config";
import { GameBudgets } from "./GameBudgets";
import { GameInstructionPreview } from "./GameInstructionPreview";

export function Instructions({
  value,
  onChange,
  t,
}: {
  value: Json | undefined;
  onChange: (v: Json | undefined) => void;
  t: Translator;
}) {
  const data = asObject(value),
    mode = value === undefined ? "" : String(data.mode ?? "append"),
    body = data.text;
  return (
    <div className="instructions">
      <select
        style={{ maxWidth: "100%" }}
        aria-label={t("customInstructions")}
        value={mode}
        onChange={(e) => {
          const next = e.target.value;
          onChange(
            !next
              ? undefined
              : next === "clear"
                ? { mode: "clear" }
                : {
                    mode: next,
                    text:
                      typeof body === "string" || (body && typeof body === "object") ? body : "",
                  },
          );
        }}
      >
        <option value="">{t("inherit")}</option>
        <option value="append">{t("append")}</option>
        <option value="replace">{t("replace")}</option>
        <option value="clear">{t("clearInstructions")}</option>
      </select>
      <p className="muted">
        {t(
          mode === "append"
            ? "instructionsAppendHelp"
            : mode === "replace"
              ? "instructionsReplaceHelp"
              : mode === "clear"
                ? "instructionsClearHelp"
                : "instructionsInheritHelp",
        )}
      </p>
      {mode &&
        mode !== "clear" &&
        (body && typeof body === "object" ? (
          <div className="two-columns">
            {["zh-CN", "en"].map((lang) => (
              <label key={lang}>
                {lang}
                <textarea
                  value={String(asObject(body)[lang] ?? "")}
                  onChange={(e) =>
                    onChange({ ...data, text: { ...asObject(body), [lang]: e.target.value } })
                  }
                />
              </label>
            ))}
          </div>
        ) : (
          <textarea
            aria-label={t("customInstructions")}
            value={typeof body === "string" ? body : ""}
            onChange={(e) => onChange({ ...data, text: e.target.value })}
          />
        ))}
    </div>
  );
}
export function AgentSelect({
  value,
  onChange,
  catalog,
  t,
  inherit = true,
  label,
  inheritedLabel,
  locale,
}: {
  value: Json | undefined;
  onChange: (v: Json | undefined) => void;
  catalog: Catalog;
  t: Translator;
  inherit?: boolean;
  label?: string;
  inheritedLabel?: string;
  locale: Locale;
}) {
  return (
    <select
      aria-label={label ?? t("chooseAgent")}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">{inherit ? (inheritedLabel ?? t("inherited")) : t("chooseAgent")}</option>
      {typeof value === "string" &&
        value &&
        !catalog.agents.some((agent) => agent.name === value) && (
          <option value={value}>
            {configUiText(locale, "missingAgent")} · {value}
          </option>
        )}
      {catalog.agents.map((agent) => (
        <option key={agent.name} value={agent.name}>
          {agent.name} · {agent.model ?? agent.kind}
        </option>
      ))}
    </select>
  );
}
export function GameForm({
  raw,
  change,
  catalog,
  t,
  locale,
}: {
  raw: JsonObject;
  change: (v: JsonObject) => void;
  catalog: Catalog;
  t: Translator;
  locale: Locale;
}) {
  const set = (field: string, value: Json | undefined) =>
      change(updateGameField(raw, field, value)),
    effective = effectiveGameSettings(raw),
    board = catalog.boards.find(
      (b) => b.id === effective.board && b.supported && b.source === "local",
    ),
    count = board?.size ?? 0,
    invalid = inapplicableGameBindings(raw, board),
    defaultAgent = typeof raw.agent === "string" && raw.agent ? raw.agent : catalog.defaultAgent;
  const inheritedAgent = `${configUiText(locale, "inheritGameAgent")}: ${defaultAgent ?? configUiText(locale, "noDefaultAgent")}`;
  return (
    <div className="form-body">
      {!catalog.boards.some((board) => board.supported && board.source === "local") && (
        <p className="notice">{configUiText(locale, "needsBoard")}</p>
      )}
      <div className="two-columns">
        <label>
          {t("chooseBoard")}
          <select
            aria-label={t("chooseBoard")}
            value={String(effective.board)}
            onChange={(e) => set("board", e.target.value)}
          >
            <option value="">{t("chooseBoard")}</option>
            {typeof effective.board === "string" && effective.board && !board && (
              <option value={effective.board}>
                {t("invalid")} · {effective.board}
              </option>
            )}
            {catalog.boards
              .filter((b) => b.supported && b.source === "local")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.size} · {b.id}
                </option>
              ))}
          </select>
          {raw.board === undefined && (
            <small className="muted">{configUiText(locale, "runtimeDefault")}</small>
          )}
        </label>
        <label>
          {t("defaultAgent")}
          <AgentSelect
            label={t("defaultAgent")}
            locale={locale}
            inheritedLabel={`${configUiText(locale, "inheritRuntimeAgent")}: ${catalog.defaultAgent ?? configUiText(locale, "noDefaultAgent")}`}
            value={raw.agent}
            onChange={(v) => set("agent", v)}
            catalog={catalog}
            t={t}
          />
        </label>
      </div>
      {(invalid.roles.length > 0 || invalid.players.length > 0) && (
        <section className="notice error" role="alert">
          <h3>{configUiText(locale, "invalidBindingsTitle")}</h3>
          <p>{configUiText(locale, "invalidBindingsHelp")}</p>
          {invalid.roles.length > 0 && (
            <p>
              {t("roles")}: {invalid.roles.map((role) => roleName(role, locale)).join(" · ")}
            </p>
          )}
          {invalid.players.length > 0 && (
            <p>
              {t("players")}: {invalid.players.join(" · ")}
            </p>
          )}
          <button
            type="button"
            onClick={() => board && change(removeInapplicableGameBindings(raw, board))}
          >
            {configUiText(locale, "cleanupBindings")}
          </button>
        </section>
      )}
      <GameBudgets raw={raw} set={set} t={t} locale={locale} />
      <section className="field-section">
        <h3>{t("globalInstructions")}</h3>
        <p className="muted">{t("instructionsHelp")}</p>
        <Instructions
          value={raw.customInstructions}
          onChange={(v) => set("customInstructions", v)}
          t={t}
        />
      </section>
      <details>
        <summary>{t("roles")}</summary>
        <p className="muted">{t("effective")}</p>
        {board?.roles.map(({ role }) => (
          <div key={role} className="binding">
            <h4>{roleName(role, locale)}</h4>
            <AgentSelect
              value={readPath(raw, `roles.${role}.agent`)}
              locale={locale}
              inheritedLabel={inheritedAgent}
              onChange={(v) => set(`roles.${role}.agent`, v)}
              catalog={catalog}
              t={t}
            />
            <Instructions
              value={readPath(raw, `roles.${role}.customInstructions`)}
              onChange={(v) => set(`roles.${role}.customInstructions`, v)}
              t={t}
            />
          </div>
        ))}
      </details>
      <details>
        <summary>
          {t("players")} · {count}
        </summary>
        <div className="player-grid">
          {Array.from({ length: count }, (_, i) => String(i + 1)).map((seat) => (
            <div className="seat-config" key={seat}>
              <div className="seat-number">{seat.padStart(2, "0")}</div>
              <label>
                {t("playerName")}
                <input
                  value={String(readPath(raw, `players.${seat}.name`) ?? "")}
                  onChange={(e) => set(`players.${seat}.name`, e.target.value || undefined)}
                />
              </label>
              <label>
                {t("chooseAgent")}
                <AgentSelect
                  value={readPath(raw, `players.${seat}.agent`)}
                  locale={locale}
                  inheritedLabel={`${configUiText(locale, "inheritRoleAgent")}: ${defaultAgent ?? configUiText(locale, "noDefaultAgent")}`}
                  onChange={(v) => set(`players.${seat}.agent`, v)}
                  catalog={catalog}
                  t={t}
                />
              </label>
              <Instructions
                value={readPath(raw, `players.${seat}.customInstructions`)}
                onChange={(v) => set(`players.${seat}.customInstructions`, v)}
                t={t}
              />
            </div>
          ))}
        </div>
      </details>
      <GameInstructionPreview raw={raw} board={board} t={t} locale={locale} />
      <details>
        <summary>{t("advanced")}</summary>
        <label>
          {t("language")}
          <select value={String(effective.locale)} onChange={(e) => set("locale", e.target.value)}>
            <option value="zh-CN">{t("chinese")}</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="checks">
          {[
            ["streamEvents", "chatLogs"],
            ["printThinking", "thinkingLogs"],
            ["printPrivateEvents", "privateLogs"],
          ].map(([field, label]) => (
            <label key={field}>
              <input
                type="checkbox"
                aria-label={t(label as "chatLogs")}
                checked={effective[field as "streamEvents"] === true}
                onChange={(e) => set(field, e.target.checked)}
              />
              {t(label as "chatLogs")}
              {raw[field] === undefined && (
                <small className="muted"> · {configUiText(locale, "runtimeDefault")}</small>
              )}
            </label>
          ))}
        </div>
        <p className="muted">{t("includeReasoning")}</p>
      </details>
    </div>
  );
}
