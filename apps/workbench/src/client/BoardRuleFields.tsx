/**
 * 负责从实际运行 schema 生成规则选择表单。输入原始板子及只读目录，输出显式字段修改。
 * 不复制组合校验，不补写提示中的缺省值；固定政策由角色说明呈现，未识别字段仍可在源码编辑。
 */
import { useEffect, useState } from "react";
import {
  dictionaries,
  roleName,
  text,
  type Locale,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import type { Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { api } from "./api";
import { asObject, readPath, writePath } from "./config-edit";
import { boardLabel } from "@ai-werewolf-arena/game-text/workbench-board";
import type { Translator } from "./types";

interface RuleCatalog {
  board: JsonObject;
  roles: { role: string; schema: JsonObject; defaults: JsonObject }[];
}
export function schemaChoices(schema: JsonObject): Json[] {
  if (Array.isArray(schema.enum)) return schema.enum;
  if (Array.isArray(schema.anyOf))
    return schema.anyOf.flatMap((choice) => {
      const option = asObject(choice);
      return Object.hasOwn(option, "const") ? [option.const] : [];
    });
  return [];
}
export function BoardRuleFields({
  raw,
  change,
  locale,
  t,
}: {
  raw: JsonObject;
  change: (value: JsonObject) => void;
  locale: Locale;
  t: Translator;
}) {
  const [catalog, setCatalog] = useState<RuleCatalog>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void api<RuleCatalog>("board-rules", { signal: controller.signal })
      .then(setCatalog)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.code ?? "request_failed");
      });
    return () => controller.abort();
  }, []);
  const set = (field: string, value: Json | undefined) => {
    let next = writePath(raw, field, value);
    // 启用自爆窗口同时启用对应阶段钩子，仍由唯一板子解析器核验全部关系。
    if (field === "mechanisms.selfDestruct.enabledWindows" && Array.isArray(value)) {
      const hooks: Record<string, string> = {
        on_daybreak: "onDaybreak",
        on_pre_election: "onPreElection",
        on_pre_vote: "onPreVote",
        on_per_speech_gap: "onPerSpeechGap",
      };
      for (const window of value)
        if (typeof window === "string" && hooks[window])
          next = writePath(next, `rules.hooks.${hooks[window]}`, true);
    }
    change(next);
  };
  const fields = (schema: JsonObject, prefix: string, defaults: JsonObject = {}): React.ReactNode =>
    Object.entries(asObject(schema.properties)).map(([name, field]) => {
      const definition = asObject(field),
        path = `${prefix}.${name}`;
      const optional = !(Array.isArray(schema.required) && schema.required.includes(name));
      const value = readPath(raw, path) ?? defaults[name] ?? definition.default;
      const choices = schemaChoices(definition);
      const label = boardLabel(locale, name);
      if (
        Object.hasOwn(definition, "const") ||
        (choices.length === 1 && !optional && name === "policy")
      )
        return null;
      if (definition.type === "object")
        return (
          <section key={path} className="field-section">
            <h4>{label}</h4>
            {fields(definition, path, asObject(defaults[name]))}
          </section>
        );
      if (definition.type === "boolean")
        return (
          <label key={path} className="check">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(event) => set(path, event.target.checked)}
            />
            {label}
          </label>
        );
      if (definition.type === "array") {
        const options = schemaChoices(asObject(definition.items));
        const selected = Array.isArray(value) ? value : [];
        return (
          <div key={path} className="field-section">
            <h4>{label}</h4>
            <div className="checks">
              {options.map((choice) => (
                <label key={String(choice)}>
                  <input
                    type="checkbox"
                    checked={selected.includes(choice)}
                    onChange={(event) =>
                      set(
                        path,
                        event.target.checked
                          ? [...selected, choice]
                          : selected.filter((item) => item !== choice),
                      )
                    }
                  />
                  {boardLabel(locale, String(choice))}
                </label>
              ))}
            </div>
            {name === "winConditions" && selected.length > 1 && (
              <ol>
                {selected.map((choice, index) => (
                  <li key={String(choice)}>
                    {boardLabel(locale, String(choice))}{" "}
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`${boardLabel(locale, String(choice))} ↑`}
                      onClick={() => {
                        const ordered = [...selected];
                        [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
                        set(path, ordered);
                      }}
                    >
                      ↑
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      }
      if (choices.length)
        return (
          <label key={path}>
            {label}
            <select
              aria-label={label}
              value={value === undefined ? "" : String(value)}
              onChange={(event) =>
                set(
                  path,
                  event.target.value === ""
                    ? undefined
                    : choices.find((choice) => String(choice) === event.target.value),
                )
              }
            >
              {optional && <option value="">{boardLabel(locale, "omitted")}</option>}
              {choices.map((choice) => (
                <option key={String(choice)} value={String(choice)}>
                  {typeof choice === "number"
                    ? boardLabel(locale, "nightNumber").replace("{night}", String(choice))
                    : boardLabel(locale, String(choice))}
                </option>
              ))}
            </select>
          </label>
        );
      if (definition.type === "number" || definition.type === "integer")
        return (
          <label key={path}>
            {label}
            <input
              type="number"
              step={definition.type === "integer" ? 1 : "any"}
              value={typeof value === "number" ? value : ""}
              min={typeof definition.minimum === "number" ? definition.minimum : undefined}
              max={typeof definition.maximum === "number" ? definition.maximum : undefined}
              onChange={(event) =>
                set(path, event.target.value === "" ? undefined : Number(event.target.value))
              }
            />
          </label>
        );
      return null;
    });
  const root = asObject(catalog?.board.properties);
  const roleIds = (
    Array.isArray(asObject(raw.board).roleSetups) ? (asObject(raw.board).roleSetups as Json[]) : []
  ).map((row) => String(asObject(row).role));
  return (
    <section className="field-section">
      <h3>{t("rules")}</h3>
      {error && (
        <p role="alert">
          {t("error")} · {error}
        </p>
      )}
      {!catalog && !error && <p className="muted">…</p>}
      {fields(asObject(root.rules), "rules")}
      {fields(asObject(root.mechanisms), "mechanisms")}
      {catalog?.roles
        .filter((role) => roleIds.includes(role.role))
        .map((role) => {
          const key = `role.${role.role}.brief` as MessageKey;
          return (
            <section key={role.role} className="field-section">
              <h4>{roleName(role.role, locale)}</h4>
              {Object.hasOwn(dictionaries[locale], key) && (
                <p className="muted">{text(locale, key)}</p>
              )}
              {fields(role.schema, `roles.${role.role}`, role.defaults)}
            </section>
          );
        })}
    </section>
  );
}
