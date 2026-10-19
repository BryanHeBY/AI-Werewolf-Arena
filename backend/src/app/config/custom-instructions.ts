/**
 * 负责自定义指令的纯校验、语言选择与有序组合。
 * 输入为公开配置片段和指定语言，输出已解析的操作／文本或仅含字段路径的错误；
 * 原文不翻译、不插值，语言回退诊断不包含正文。同一来源的诊断只登记一次。
 * 本模块不读取文件、创建 Agent 或修改基础系统提示，replace／clear 仅作用于附加指令。
 */
import type { Locale } from "@ai-werewolf-arena/game-contract";
import type { CustomInstructions, GameSetupWarning, LocalizedInstructionText } from "./contracts";

export type ResolvedCustomInstructions =
  { mode: "append" | "replace"; text: string } | { mode: "clear" };

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`runtime_config_required_string_invalid: ${field}`);
  return value;
}

export function parseCustomInstructions(
  value: unknown,
  field: string,
): CustomInstructions | undefined {
  if (value === undefined) return undefined;
  if (!object(value)) throw new Error(`runtime_config_custom_instructions_invalid: ${field}`);
  for (const key of Object.keys(value))
    if (!["mode", "text"].includes(key))
      throw new Error(`runtime_config_unknown_field: ${field}.${key}`);
  const mode = value.mode === undefined ? "append" : value.mode;
  if (mode !== "append" && mode !== "replace" && mode !== "clear")
    throw new Error(`runtime_config_custom_instructions_mode_invalid: ${field}.mode`);
  if (mode === "clear") {
    if (Object.hasOwn(value, "text"))
      throw new Error(`runtime_config_custom_instructions_clear_has_text: ${field}.text`);
    return { mode };
  }
  let body: LocalizedInstructionText;
  if (object(value.text)) {
    if (!Object.keys(value.text).length)
      throw new Error(`runtime_config_custom_instructions_text_empty: ${field}.text`);
    body = Object.fromEntries(
      Object.entries(value.text).map(([locale, raw]) => {
        if (locale !== "zh-CN" && locale !== "en")
          throw new Error(`runtime_config_unknown_field: ${field}.text.${locale}`);
        return [locale, text(raw, `${field}.text.${locale}`)];
      }),
    );
  } else body = text(value.text, `${field}.text`);
  return { mode, text: body };
}

/** 先逐层选择语言，再组合；回退依序选中文、英文，并保留来源路径以便定位配置。 */
export function resolveCustomInstructions(
  value: CustomInstructions | undefined,
  locale: Locale,
  field: string,
  warnings: GameSetupWarning[],
): ResolvedCustomInstructions | undefined {
  if (!value || value.mode === "clear") return value;
  if (typeof value.text === "string") return { mode: value.mode ?? "append", text: value.text };
  if (value.text[locale] !== undefined)
    return { mode: value.mode ?? "append", text: value.text[locale]! };
  const fallbackLocale = value.text["zh-CN"] !== undefined ? "zh-CN" : "en";
  if (!warnings.some((warning) => warning.path === `${field}.text`))
    warnings.push({
      code: "locale_prompt_fallback",
      path: `${field}.text`,
      requestedLocale: locale,
      fallbackLocale,
    });
  return { mode: value.mode ?? "append", text: value.text[fallbackLocale]! };
}

/** 所选 Agent 的正文只作为起点；后续 clear／replace 不触及身份、规则或工具协议。 */
export function combineCustomInstructions(
  initial: string | undefined,
  ...layers: (ResolvedCustomInstructions | undefined)[]
): string | undefined {
  let parts = initial === undefined ? [] : [initial];
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.mode !== "append") parts = [];
    if (layer.mode !== "clear") parts.push(layer.text);
  }
  return parts.length ? parts.join("\n\n") : undefined;
}
