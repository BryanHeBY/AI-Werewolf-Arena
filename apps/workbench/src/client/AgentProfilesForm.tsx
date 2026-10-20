/**
 * 负责编辑已保存 Agent 的连接、模型与附加指令；表单只局部修改所选条目，原生参数始终可见。
 * 输入同一原始文档，输出局部修改；高级参数通过父编辑器的源码页修改，不维护另一份未应用草稿。
 */
import { useEffect, useState } from "react";
import type { JsonObject } from "@ai-werewolf-arena/workbench-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "./types";
import { asObject } from "./config-edit";
import { Instructions } from "./GameForm";
import { agentText } from "@ai-werewolf-arena/game-text/workbench-agent";
import { AgentConnectionTest } from "./AgentConnectionTest";

export function AgentProfilesForm({
  raw,
  change,
  catalog,
  t,
  locale,
  dirty = false,
}: {
  raw: JsonObject;
  change: (value: JsonObject) => void;
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  dirty?: boolean;
}) {
  const items = asObject(raw.items);
  const [selected, setSelected] = useState(Object.keys(items)[0] ?? "");
  const entry = asObject(items[selected]);
  const options = asObject(entry.options);
  useEffect(() => {
    if (!Object.hasOwn(items, selected)) setSelected(Object.keys(items)[0] ?? "");
  }, [raw, selected]);
  const update = (value: JsonObject) => change({ ...raw, items: { ...items, [selected]: value } });
  const kind = catalog.backends.find((backend) => backend.name === entry.backend)?.kind;
  const modelField = kind === "pi" ? "defaultModel" : "model";
  return (
    <div className="form-body">
      <label>
        {agentText(locale, "existingAgents")}
        <select
          aria-label={agentText(locale, "existingAgents")}
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
          }}
        >
          {Object.keys(items).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      {selected && Object.hasOwn(items, selected) && (
        <>
          <AgentConnectionTest name={selected} locale={locale} disabled={dirty} />
          <label>
            {t("defaultAgent")}
            <select
              value={String(raw.default ?? "")}
              onChange={(event) => change({ ...raw, default: event.target.value })}
            >
              {Object.keys(items).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("connection")}
            <select
              value={String(entry.backend ?? "")}
              onChange={(event) => update({ ...entry, backend: event.target.value })}
            >
              {catalog.backends
                .filter((backend) => backend.kind === kind || backend.name === entry.backend)
                .map((backend) => (
                  <option key={backend.name} value={backend.name}>
                    {backend.name} · {backend.kind}
                  </option>
                ))}
            </select>
          </label>
          {kind !== "acp" && (
            <label>
              {t("model")}
              <input
                value={String(options[modelField] ?? "")}
                onChange={(event) =>
                  update({ ...entry, options: { ...options, [modelField]: event.target.value } })
                }
              />
            </label>
          )}
          {kind === "pi" && (
            <label>
              {agentText(locale, "provider")}
              <input
                value={String(options.defaultProvider ?? "")}
                onChange={(event) =>
                  update({ ...entry, options: { ...options, defaultProvider: event.target.value } })
                }
              />
            </label>
          )}
          <section className="field-section">
            <h3>{t("customInstructions")}</h3>
            <Instructions
              value={entry.customInstructions}
              onChange={(value) => {
                const next = { ...entry };
                if (value === undefined) delete next.customInstructions;
                else next.customInstructions = value;
                update(next);
              }}
              t={t}
            />
          </section>
          <details className="field-section">
            <summary>{agentText(locale, "nativeOptions")}</summary>
            <p className="muted">{agentText(locale, "editNativeSource")}</p>
            <pre>{JSON.stringify(options, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}
