/** 负责新建与编辑 Agent 共用的思考控件及连接摘要；输入模型目录、原生参数和公开连接设置，输出有效值及显式修改，不接触认证或保存文件。 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import { agentText } from "@ai-werewolf-arena/game-text/workbench-agent";
import type { JsonObject } from "@ai-werewolf-arena/workbench-contract";
import { asObject } from "./config-edit";
import {
  changeThinking,
  connectionTier,
  thinkingValue,
  type ConnectionSummary,
  type ModelSummary,
} from "./agent-platforms";

export function AgentThinkingField({
  kind,
  provider,
  model,
  options,
  models,
  locale,
  onChange,
}: {
  kind: string;
  provider: string;
  model: string;
  options: JsonObject;
  models: ModelSummary[];
  locale: Locale;
  onChange: (options: JsonObject) => void;
}) {
  const value = thinkingValue(kind, provider, model, options);
  const current = models.find((item) => item.provider === provider && item.id === model);
  const levels =
    kind === "llm"
      ? ["none", "minimal", "low", "medium", "high", "xhigh"]
      : current
        ? current.thinkingLevels
        : ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
  const overridden =
    kind === "pi" && Object.hasOwn(asObject(options.modelThinkingLevels), `${provider}/${model}`);
  return (
    <label>
      {agentText(locale, "thinking")}
      <select
        aria-label={agentText(locale, "thinking")}
        value={value}
        onChange={(event) =>
          onChange(changeThinking(kind, provider, model, options, event.target.value))
        }
      >
        <option value="">{agentText(locale, "sdkDefault")}</option>
        {[...new Set([...levels, ...(value ? [value] : [])])].map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
      <small className="muted">
        {agentText(locale, overridden ? "thinkingOverrideHelp" : "thinkingHelp")}
      </small>
    </label>
  );
}

export function AgentConnectionInfo({
  connection,
  provider,
  model,
  locale,
}: {
  connection?: ConnectionSummary;
  provider: string;
  model: string;
  locale: Locale;
}) {
  if (!connection) return null;
  return (
    <div className="hint">
      <p>{agentText(locale, "sharedConnectionHelp")}</p>
      <p>
        {agentText(locale, "concurrency")}:{" "}
        {connection.maxConcurrentRequests ?? agentText(locale, "runtimeDefault")}
      </p>
      {connection.kind === "acp" && (
        <p>
          {agentText(locale, "initializeTimeout")}:{" "}
          {connection.initializeTimeoutMs ?? agentText(locale, "runtimeDefault")}
        </p>
      )}
      {connection.kind === "pi" && provider === "openai-codex" && (
        <p>
          {agentText(locale, "effectiveTier")}:{" "}
          <strong>
            {connectionTier(connection, provider, model) || agentText(locale, "sdkDefault")}
          </strong>
        </p>
      )}
    </div>
  );
}
