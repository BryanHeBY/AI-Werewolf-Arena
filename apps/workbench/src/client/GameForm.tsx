/**
 * 负责游戏向导中的板子、Agent 继承、指令及时间设置；输入原始 JSON，输出局部字段编辑。
 * 只呈现公开配置，不预先发牌或覆盖未展示字段；最终支持判断由服务端配置检查负责。
 */
import type { Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { roleName, type Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "./types";
import { asObject, readPath, writePath } from "./config-edit";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";

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
        <option value="clear">{t("clear")}</option>
      </select>
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
}: {
  value: Json | undefined;
  onChange: (v: Json | undefined) => void;
  catalog: Catalog;
  t: Translator;
  inherit?: boolean;
  label?: string;
}) {
  return (
    <select
      aria-label={label ?? t("chooseAgent")}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">{inherit ? t("inherited") : t("chooseAgent")}</option>
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
  const set = (field: string, value: Json | undefined) => change(writePath(raw, field, value)),
    board = catalog.boards.find((b) => b.id === raw.board && b.supported && b.source === "local"),
    count = board?.size ?? 12;
  return (
    <div className="form-body">
      {!catalog.boards.some((board) => board.supported && board.source === "local") && (
        <p className="notice">{configUiText(locale, "needsBoard")}</p>
      )}
      <div className="two-columns">
        <label>
          {t("chooseBoard")}
          <select value={String(raw.board ?? "")} onChange={(e) => set("board", e.target.value)}>
            <option value="">{t("chooseBoard")}</option>
            {catalog.boards
              .filter((b) => b.supported && b.source === "local")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.size} · {b.id}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t("defaultAgent")}
          <AgentSelect
            label={t("defaultAgent")}
            value={raw.agent}
            onChange={(v) => set("agent", v)}
            catalog={catalog}
            t={t}
          />
        </label>
      </div>
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
      <details>
        <summary>{t("advanced")}</summary>
        <div className="three-columns">
          {[
            ["maxDays", "maxDays", 1, 8],
            ["maxRuntimeMs", "maxRuntime", 60000, 30],
            ["llmTimeoutMs", "turnTimeout", 1000, 45],
          ].map(([field, label, unit, fallback]) => (
            <label key={field}>
              {t(label as "maxDays")}
              <input
                type="number"
                min={1}
                value={Number(raw[field] ?? Number(unit) * Number(fallback)) / Number(unit)}
                onChange={(e) => set(String(field), Number(e.target.value) * Number(unit))}
              />
            </label>
          ))}
        </div>
        <label>
          {t("language")}
          <select
            value={String(raw.locale ?? "zh-CN")}
            onChange={(e) => set("locale", e.target.value)}
          >
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
                checked={raw[field] === true}
                onChange={(e) => set(field, e.target.checked)}
              />
              {t(label as "chatLogs")}
            </label>
          ))}
        </div>
        <p className="muted">{t("includeReasoning")}</p>
      </details>
    </div>
  );
}
