/**
 * 负责平台优先的 Agent 创建向导；输入认证、模型与原生选项，输出既有 backend／agent 文档。
 * 只追加具名条目并保留其它配置；复用连接时不改认证，Codex 导入令牌只在服务端处理。
 */
import { useEffect, useState } from "react";
import type { ConfigDocument, JsonObject, Json } from "@ai-werewolf-arena/workbench-contract";
import type { Catalog, Translator } from "./types";
import { api } from "./api";
import { asObject } from "./config-edit";
import { useDraft } from "./draft-context";
import { Instructions } from "./GameForm";
const platforms = [
  { id: "openai", name: "OpenAI API", provider: "openai", kind: "pi" },
  { id: "codex", name: "OpenAI Codex", provider: "openai-codex", kind: "pi" },
  { id: "anthropic", name: "Anthropic API", provider: "anthropic", kind: "pi" },
  { id: "zhipu", name: "Zhipu Coding Plan", provider: "zai-coding-cn", kind: "pi" },
  { id: "kimi", name: "Kimi Coding", provider: "kimi-coding", kind: "pi" },
  { id: "compatible", name: "OpenAI Compatible", provider: "openai", kind: "llm" },
  { id: "claude-code", name: "Claude Code ACP", provider: "acp", kind: "acp" },
  { id: "acp", name: "Custom ACP", provider: "acp", kind: "acp" },
] as const;
interface ModelSummary {
  provider: string;
  id: string;
  name: string;
  reasoning: boolean;
  thinkingLevels: string[];
}
export function AgentWizard({
  catalog,
  t,
  onSaved,
}: {
  catalog: Catalog;
  t: Translator;
  onSaved: () => void;
}) {
  const [instructions, setInstructions] = useState<Json | undefined>();
  const [platformId, setPlatformId] = useState("openai"),
    [name, setName] = useState(""),
    [key, setKey] = useState(""),
    [model, setModel] = useState(""),
    [thinking, setThinking] = useState("medium"),
    [fast, setFast] = useState(false),
    [baseURL, setBaseURL] = useState(""),
    [backend, setBackend] = useState(""),
    [command, setCommand] = useState(""),
    [args, setArgs] = useState("[]"),
    [models, setModels] = useState<ModelSummary[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const platform = platforms.find((p) => p.id === platformId)!;
  useEffect(() => {
    const controller = new AbortController();
    void api<ModelSummary[]>("models", { signal: controller.signal })
      .then(setModels)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const choices = models.filter((m) => m.provider === platform.provider);
  const currentModel = choices.find((m) => m.id === model);
  const thinkingLevels =
    platform.kind === "llm"
      ? ["none", "minimal", "low", "medium", "high", "xhigh"]
      : currentModel?.thinkingLevels.length
        ? currentModel.thinkingLevels
        : ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
  useEffect(() => {
    if (!thinkingLevels.includes(thinking)) setThinking(thinkingLevels[0]);
  }, [model, platformId, models]);
  const dirty = !!(
    name ||
    key ||
    model ||
    command ||
    instructions ||
    baseURL ||
    backend ||
    args !== "[]" ||
    fast ||
    thinking !== "medium"
  );
  useDraft(dirty);
  const clearDraft = () => {
    // 凭据和连接选项都属于同一份内存草稿；显式清除之后才能安全切换页面。
    setName("");
    setKey("");
    setModel("");
    setCommand("");
    setArgs("[]");
    setBaseURL("");
    setBackend("");
    setFast(false);
    setThinking("medium");
    setInstructions(undefined);
    setError("");
    setMessage("");
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!/^[a-z][a-z0-9_-]*$/.test(name)) throw Error("invalid_config_name");
      if (platform.kind !== "acp" && !model) throw Error("model_required");
      if (catalog.agents.some((a) => a.name === name)) throw Error("agent_already_exists");
      const connection = backend || `${name}_connection`;
      if (!backend) {
        if (catalog.backends.some((b) => b.name === connection))
          throw Error("backend_already_exists");
        const doc = await api<ConfigDocument>("documents/backends/backends"),
          raw = JSON.parse(doc.text) as JsonObject;
        let config: JsonObject;
        if (platform.kind === "pi") {
          if (!model) throw Error("model_required");
          if (platform.id !== "codex" && !key) throw Error("api_key_required");
          const providers: JsonObject = {};
          if (baseURL || (fast && platform.id === "codex"))
            providers[platform.provider] = {
              ...(baseURL ? { baseUrl: baseURL } : {}),
              ...(fast && platform.id === "codex"
                ? { modelOverrides: { [model]: { samplingParams: { service_tier: "priority" } } } }
                : {}),
            };
          config = {
            models: { providers },
            auth: platform.id === "codex" ? {} : { [platform.provider]: { type: "api_key", key } },
          };
        } else if (platform.kind === "llm") {
          if (!model || !key || !baseURL) throw Error("connection_fields_required");
          config = { type: "openai", apiKey: key, baseURL };
        } else {
          if (!command) throw Error("acp_command_required");
          let argv: unknown;
          try {
            argv = JSON.parse(args);
          } catch {
            throw Error("invalid_arguments");
          }
          if (!Array.isArray(argv) || argv.some((v) => typeof v !== "string"))
            throw Error("invalid_arguments");
          config = { transport: "stdio", command, args: argv, env: {}, initializeTimeoutMs: 45000 };
        }
        raw.items = {
          ...asObject(raw.items),
          [connection]: { kind: platform.kind, config, limits: { maxConcurrentRequests: 2 } },
        };
        await api("documents/backends/backends", {
          method: "PUT",
          body: { revision: doc.revision, text: JSON.stringify(raw) },
        });
        if (platform.id === "codex")
          await api("codex-import", { method: "POST", body: { backend: connection } });
      }
      const doc = await api<ConfigDocument>("documents/agents/agents"),
        raw = JSON.parse(doc.text) as JsonObject;
      const kind = backend ? catalog.backends.find((b) => b.name === backend)?.kind : platform.kind;
      const options: JsonObject =
        kind === "pi"
          ? {
              defaultProvider: platform.provider,
              defaultModel: model,
              defaultThinkingLevel: thinking,
              defaultTools: [],
              cacheWarming: "off",
            }
          : kind === "llm"
            ? { model, reasoningEffort: thinking }
            : { sessionReuse: "per_player", actionTransport: "mcp" };
      raw.items = {
        ...asObject(raw.items),
        [name]: {
          backend: connection,
          options,
          ...(instructions === undefined ? {} : { customInstructions: instructions }),
        },
      };
      await api("documents/agents/agents", {
        method: "PUT",
        body: { revision: doc.revision, text: JSON.stringify(raw) },
      });
      clearDraft();
      setMessage(t("saved"));
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "request_failed");
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel wizard">
      <span className="eyebrow">{t("selectPlatform")}</span>
      <h2>{t("newAgent")}</h2>
      <p className="muted">{t("agentHelp")}</p>
      <div className="platform-grid">
        {platforms.map((p) => (
          <button
            className={`platform ${p.id === platformId ? "selected" : ""}`}
            key={p.id}
            onClick={() => {
              setPlatformId(p.id);
              setModel("");
              setBackend("");
              setKey("");
              setBaseURL("");
              setCommand("");
              setArgs("[]");
              setFast(false);
              setError("");
            }}
          >
            <span className="platform-mark">{p.name.charAt(0)}</span>
            <strong>{p.name}</strong>
            <small>{p.kind.toUpperCase()}</small>
          </button>
        ))}
      </div>
      <div className="two-columns">
        <label>
          {t("agentId")}
          <input value={name} placeholder="my_agent" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t("backend")}
          <select value={backend} onChange={(e) => setBackend(e.target.value)}>
            <option value="">{t("connectionAuto")}</option>
            {catalog.backends
              .filter((b) => b.kind === platform.kind)
              .map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {platform.kind === "acp" ? (
        !backend && (
          <div className="two-columns">
            <label>
              {t("command")}
              <input
                value={command}
                placeholder="/absolute/path/to/isolated-acp-launcher"
                onChange={(e) => setCommand(e.target.value)}
              />
            </label>
            <label>
              {t("args")}
              <textarea value={args} onChange={(e) => setArgs(e.target.value)} />
            </label>
          </div>
        )
      ) : (
        <>
          <div className="two-columns">
            <label>
              {t("model")}
              <input
                aria-label={t("model")}
                list="models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <datalist id="models">
                {choices.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label>
              {t("thinking")}
              <select
                aria-label={t("thinking")}
                value={thinking}
                onChange={(e) => setThinking(e.target.value)}
              >
                {thinkingLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!backend && platform.id !== "codex" && (
            <label>
              {t("apiKey")}
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
          )}
          {!backend && (
            <label>
              {t("baseURL")}
              <input
                value={baseURL}
                placeholder={platform.kind === "llm" ? "https://example.com/v1" : ""}
                onChange={(e) => setBaseURL(e.target.value)}
              />
            </label>
          )}
          {platform.id === "codex" && !backend && (
            <div className="hint">
              <p>{t("codexHelp")}</p>
              <label className="check">
                <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
                {t("fast")}
              </label>
            </div>
          )}
        </>
      )}
      <section className="field-section">
        <h3>{t("customInstructions")}</h3>
        <Instructions value={instructions} onChange={setInstructions} t={t} />
      </section>
      <div className="actions">
        <button disabled={busy || !dirty} onClick={clearDraft}>
          {t("clear")}
        </button>
        <button className="primary" disabled={busy || !name} onClick={() => void submit()}>
          {platform.id === "codex" && !backend ? `${t("codexImport")} + ${t("save")}` : t("save")}
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {t("error")}
          <code>{error}</code>
        </div>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
