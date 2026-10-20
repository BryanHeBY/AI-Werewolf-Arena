/** 负责展示和编辑对局保护限制；输入原文及公共运行缺省，输出带来源的数值和显式修改，不把新建推荐值冒充省略字段的实际执行值。 */
import type { Json, JsonObject } from "@ai-werewolf-arena/workbench-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import type { Translator } from "./types";
import { effectiveGameSettings } from "./game-config";

export function GameBudgets({
  raw,
  set,
  t,
  locale,
}: {
  raw: JsonObject;
  set: (field: string, value: Json | undefined) => void;
  t: Translator;
  locale: Locale;
}) {
  const effective = effectiveGameSettings(raw);
  return (
    <section className="field-section">
      <h3>{configUiText(locale, "budgetTitle")}</h3>
      <p className="muted">{configUiText(locale, "budgetHelp")}</p>
      <div className="three-columns">
        {(
          [
            ["maxDays", "maxDays", 1],
            ["maxRuntimeMs", "maxRuntime", 60_000],
            ["llmTimeoutMs", "turnTimeout", 1_000],
          ] as const
        ).map(([field, label, unit]) => (
          <label key={field}>
            {t(label)}
            <input
              aria-label={t(label)}
              type="number"
              min={1 / unit}
              step={field === "maxDays" ? 1 : "any"}
              value={Number(effective[field]) / unit}
              onChange={(e) =>
                set(
                  field,
                  Number.isFinite(e.target.valueAsNumber)
                    ? e.target.valueAsNumber * unit
                    : undefined,
                )
              }
            />
            <small className="muted">
              {configUiText(locale, raw[field] === undefined ? "runtimeDefault" : "explicitValue")}
            </small>
            {raw[field] !== undefined && (
              <button type="button" className="text-link" onClick={() => set(field, undefined)}>
                {configUiText(locale, "restoreDefault")}
              </button>
            )}
          </label>
        ))}
      </div>
      <p className="muted">{configUiText(locale, "turnLimitHelp")}</p>
    </section>
  );
}
