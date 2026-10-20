/**
 * 负责把唯一板子解析器的 schema、实际缺省与支持范围投影为表单。
 * 输入原始 JSON，输出显式编辑；有限玩法裁决由服务端解析器承担，浏览器只协调同一设置的底层表示。
 */
import { useEffect, useState } from "react";
import {
  dictionaries,
  roleName,
  text,
  type Locale,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import {
  applyBoardRuleEdit,
  type Json,
  type JsonObject,
} from "@ai-werewolf-arena/workbench-contract";
import { api } from "./api";
import { asObject, readPath } from "./config-edit";
import { boardLabel } from "@ai-werewolf-arena/game-text/workbench-board";
import {
  workbenchConfigLocation,
  workbenchServiceMessage,
} from "@ai-werewolf-arena/game-text/workbench-service";
import type { Translator } from "./types";

interface RuleConstraint {
  allowedValues?: Json[];
  omittable?: boolean;
  fixed?: boolean;
}
interface RuleCatalog {
  board: JsonObject;
  roles: { role: string; schema: JsonObject; defaults: JsonObject }[];
  resolved?: JsonObject;
  constraints?: Record<string, RuleConstraint>;
  diagnostics?: { code: string; path: string }[];
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
/** 简介必须跟随本局选择的策略，不能拿角色的孤立默认说明覆盖当前配置。 */
export function boardRoleBrief(
  role: string,
  options: JsonObject,
  locale: Locale,
): string | undefined {
  if (role === "bear" && options.signalPolicy === "netease_dawn_live_v1")
    return text(locale, "role.bear.dawn_brief");
  if (role === "pufferfish")
    return boardLabel(
      locale,
      options.ballotPolicy === "awa_first_ballot_v1" ? "pufferFirstBrief" : "pufferFinalBrief",
    );
  const key = `role.${role}.brief` as MessageKey;
  return Object.hasOwn(dictionaries[locale], key) ? text(locale, key) : undefined;
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
  const [loaded, setLoaded] = useState<{ source: string; catalog: RuleCatalog }>();
  const [error, setError] = useState("");
  const rawText = JSON.stringify(raw);
  const catalog = loaded?.catalog;
  const current = loaded?.source === rawText;
  const resolved = current ? catalog?.resolved : undefined;
  useEffect(() => {
    const controller = new AbortController();
    // 支持探测只处理公开板子数据，不落盘、不补文件。旧请求被取消，避免较慢响应覆盖新草稿。
    void api<RuleCatalog>("board-rules", {
      method: "POST",
      body: { board: JSON.parse(rawText) },
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        setLoaded({ source: rawText, catalog: value });
        setError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.code ?? "request_failed");
      });
    return () => controller.abort();
  }, [rawText]);
  const set = (field: string, value: Json | undefined) =>
    change(applyBoardRuleEdit(raw, field, value));
  const format = (value: Json | undefined): string => {
    if (value === undefined) return boardLabel(locale, "unconfiguredValue");
    if (Array.isArray(value))
      return value.map(format).join(" / ") || boardLabel(locale, "disabled");
    return boardLabel(locale, typeof value === "boolean" ? `boolean.${value}` : String(value));
  };
  const allowed = (path: string, value: Json) => {
    // 新草稿的结果未到达时不能借用旧草稿的可选范围；数字输入仍可连续输入并立即得到校验。
    if (!current) return false;
    const values = catalog?.constraints?.[path]?.allowedValues;
    return (
      !values || values.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))
    );
  };
  const fields = (schema: JsonObject, prefix: string, defaults: JsonObject = {}): React.ReactNode =>
    Object.entries(asObject(schema.properties)).map(([name, field]) => {
      const definition = asObject(field),
        path = `${prefix}.${name}`;
      // 底层钩子只是自爆窗口的表示细节；GUI 只保留一套实际生效的窗口。
      if (path === "rules.hooks") return null;
      const sheriff = asObject(asObject(raw.mechanisms).sheriff);
      if (prefix === "mechanisms.sheriff" && name !== "enabled" && sheriff.enabled === false)
        return null;
      const optional = !(Array.isArray(schema.required) && schema.required.includes(name));
      const explicit = readPath(raw, path);
      const value =
        explicit ?? readPath(resolved ?? {}, path) ?? defaults[name] ?? definition.default;
      const choices = schemaChoices(definition);
      const state = catalog?.constraints?.[path];
      const label = boardLabel(
        locale,
        path === "roles.knight.enabledWindows" ? "duelWindows" : name,
      );
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
            {path === "mechanisms.selfDestruct" && (
              <p className="muted">{boardLabel(locale, "selfDestructHelp")}</p>
            )}
          </section>
        );
      const fixedTie =
        path === "mechanisms.sheriff.tieBreaker" &&
        sheriff.electionPolicy === "awa_nomination_offstage_pk_v1"
          ? "pkSheriffTie"
          : path === "mechanisms.tieBreaker.exileVote" &&
              asObject(asObject(raw.mechanisms).voting).exilePolicy === "awa_one_pk_v1"
            ? "pkExileTie"
            : undefined;
      if (fixedTie)
        return (
          <p key={path} className="muted" data-rule-path={path}>
            {label}：{boardLabel(locale, fixedTie)}
          </p>
        );
      if (state?.fixed && name !== "eventPack")
        return (
          <div key={path} className="field-section" data-rule-path={path}>
            <span>
              {label}：{format(value)}
            </span>
            <p className="muted">{boardLabel(locale, "fixedByBoard")}</p>
          </div>
        );
      if (definition.type === "boolean")
        return (
          <label key={path} className="check">
            <input
              type="checkbox"
              checked={value === true}
              disabled={!allowed(path, value !== true)}
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
              {options.map((choice) => {
                const next = selected.includes(choice)
                  ? selected.filter((item) => item !== choice)
                  : [...selected, choice];
                return (
                  <label key={String(choice)}>
                    <input
                      type="checkbox"
                      checked={selected.includes(choice)}
                      disabled={!allowed(path, next)}
                      title={
                        allowed(path, next) ? undefined : boardLabel(locale, "unavailableChoice")
                      }
                      onChange={() => set(path, next)}
                    />
                    {boardLabel(locale, String(choice))}
                  </label>
                );
              })}
            </div>
            {name === "winConditions" && selected.length > 1 && (
              <ol>
                {selected.map((choice, index) => {
                  const ordered = [...selected];
                  if (index)
                    [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
                  return (
                    <li key={String(choice)}>
                      {boardLabel(locale, String(choice))}{" "}
                      <button
                        type="button"
                        disabled={!index || !allowed(path, ordered)}
                        aria-label={`${boardLabel(locale, String(choice))} ↑`}
                        onClick={() => set(path, ordered)}
                      >
                        ↑
                      </button>
                    </li>
                  );
                })}
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
              disabled={!current}
              value={
                optional && explicit === undefined ? "" : value === undefined ? "" : String(value)
              }
              onChange={(event) =>
                set(
                  path,
                  event.target.value === ""
                    ? undefined
                    : choices.find((choice) => String(choice) === event.target.value),
                )
              }
            >
              {optional && (
                <option value="" disabled={state?.omittable === false}>
                  {name === "eventPack"
                    ? boardLabel(locale, "noExtraRules")
                    : boardLabel(locale, "defaultValue").replace("{value}", format(value))}
                </option>
              )}
              {choices.map((choice) => (
                <option
                  key={String(choice)}
                  value={String(choice)}
                  disabled={!allowed(path, choice)}
                >
                  {typeof choice === "number"
                    ? boardLabel(locale, "nightNumber").replace("{night}", String(choice))
                    : boardLabel(locale, String(choice))}
                </option>
              ))}
            </select>
            {name === "eventPack" && (
              <small className="muted">
                {boardLabel(locale, explicit ? "wallNotesHelp" : "extraRulesHelp")}
              </small>
            )}
          </label>
        );
      if (definition.type === "number" || definition.type === "integer")
        return (
          <label key={path}>
            {label}
            <input
              aria-label={label}
              type="number"
              step={definition.type === "integer" ? 1 : "any"}
              value={typeof value === "number" ? value : ""}
              placeholder={
                name === "initialSeat" ? boardLabel(locale, "noInitialSheriff") : undefined
              }
              min={
                typeof definition.minimum === "number"
                  ? definition.minimum
                  : definition.exclusiveMinimum === 0
                    ? Number.EPSILON
                    : undefined
              }
              max={
                name === "initialSeat"
                  ? Number(asObject(raw.board).size)
                  : typeof definition.maximum === "number"
                    ? definition.maximum
                    : undefined
              }
              onChange={(event) =>
                set(path, event.target.value === "" ? undefined : Number(event.target.value))
              }
            />
            {name === "initialSeat" && (
              <small className="muted">{boardLabel(locale, "initialSheriffHelp")}</small>
            )}
          </label>
        );
      return null;
    });
  const root = asObject(catalog?.board.properties);
  const roleIds = (
    Array.isArray(asObject(raw.board).roleSetups) ? (asObject(raw.board).roleSetups as Json[]) : []
  ).map((row) => String(asObject(row).role));
  return (
    <section className="field-section" aria-busy={!current}>
      <h3>{t("rules")}</h3>
      {error && <p role="alert">{workbenchServiceMessage(locale, error) ?? t("error")}</p>}
      {!catalog && !error && <p className="muted">…</p>}
      {current &&
        catalog?.diagnostics?.map((diagnostic) => (
          <p role="alert" key={diagnostic.path}>
            {workbenchServiceMessage(locale, diagnostic.code) ?? t("error")} ·{" "}
            {workbenchConfigLocation(locale, diagnostic.path)}
          </p>
        ))}
      {fields(asObject(root.rules), "rules")}
      {fields(asObject(root.mechanisms), "mechanisms")}
      {catalog?.roles
        .filter((role) => roleIds.includes(role.role))
        .map((role) => {
          const options = {
            ...role.defaults,
            ...asObject(asObject(resolved?.roles)[role.role]),
            ...asObject(asObject(raw.roles)[role.role]),
          };
          return (
            <section key={role.role} className="field-section">
              <h4>{roleName(role.role, locale)}</h4>
              <p className="muted">{boardRoleBrief(role.role, options, locale)}</p>
              {fields(role.schema, `roles.${role.role}`, role.defaults)}
            </section>
          );
        })}
    </section>
  );
}
