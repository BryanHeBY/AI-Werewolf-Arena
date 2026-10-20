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
import type { Locale } from "@ai-werewolf-arena/game-text";
import {
  platforms,
  compatibleConnection,
  buildConnection,
  buildAgentOptions,
  nativeObject,
  requiresCodexImport,
  nativeModelTier,
  type ModelSummary,
} from "./agent-platforms";
import { agentText } from "@ai-werewolf-arena/game-text/workbench-agent";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import { workbenchServiceMessage } from "@ai-werewolf-arena/game-text/workbench-service";
import { AgentConnectionTest } from "./AgentConnectionTest";
import { AgentThinkingField, AgentConnectionInfo } from "./AgentModelSettings";
interface PlatformDefaults {
  claudeCode: {
    supported: boolean;
    command: string;
    args: string[];
    authSource: string;
    env: Record<string, string>;
    available: { launcher: boolean; adapter: boolean; bwrap: boolean };
  };
}
export function AgentWizard({
  catalog,
  t,
  locale,
  onSaved,
}: {
  catalog: Catalog;
  t: Translator;
  locale: Locale;
  onSaved: () => void;
}) {
  const [savedAgent, setSavedAgent] = useState("");
  const [instructions, setInstructions] = useState<Json | undefined>();
  const [platformId, setPlatformId] = useState("openai"),
    [name, setName] = useState(""),
    [key, setKey] = useState(""),
    [model, setModel] = useState(""),
    [thinking, setThinking] = useState(""),
    [thinkingTouched, setThinkingTouched] = useState(false),
    [fast, setFast] = useState(false),
    [baseURL, setBaseURL] = useState(""),
    [backend, setBackend] = useState(""),
    [command, setCommand] = useState(""),
    [args, setArgs] = useState(""),
    [providerInput, setProviderInput] = useState(""),
    [environment, setEnvironment] = useState("{}"),
    [native, setNative] = useState("{}"),
    [nativeOptions, setNativeOptions] = useState("{}"),
    [concurrency, setConcurrency] = useState("2"),
    [initializeTimeout, setInitializeTimeout] = useState("45000"),
    [createdConnection, setCreatedConnection] = useState(""),
    [defaults, setDefaults] = useState<PlatformDefaults>(),
    [authMode, setAuthMode] = useState("subscription"),
    [authSource, setAuthSource] = useState(""),
    [models, setModels] = useState<ModelSummary[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const platform = platforms.find((p) => p.id === platformId)!;
  const importSubscription = requiresCodexImport(
    platform,
    catalog.backends.find((item) => item.name === backend),
  );
  const provider = platform.id === "pi-native" ? providerInput.trim() : platform.provider;
  const l = (key: Parameters<typeof agentText>[1]) => agentText(locale, key);
  useEffect(() => {
    const controller = new AbortController();
    void api<ModelSummary[]>("models", { signal: controller.signal })
      .then(setModels)
      .catch(() => {});
    void api<PlatformDefaults>("platform-defaults", { signal: controller.signal })
      .then(setDefaults)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const choices = models.filter((m) => m.provider === provider);
  const suggested =
    choices.find((m) => ["gpt-6-luna", "glm-5.3-flash", "claude-sonnet-5"].includes(m.id)) ??
    choices[0];
  const modelId = model.trim() || (platform.kind === "pi" ? (suggested?.id ?? "") : "");
  const currentModel = choices.find((m) => m.id === modelId);
  let optionDraft: JsonObject = {};
  let nativeTier = "";
  try {
    optionDraft = nativeObject(nativeOptions);
    nativeTier = nativeModelTier(nativeObject(native), provider, modelId);
  } catch {
    /* 保存时统一报告 JSON 错误，输入时保留原草稿。 */
  }
  const thinkingOptions = {
    ...optionDraft,
    ...(thinking ? { defaultThinkingLevel: thinking, reasoningEffort: thinking } : {}),
  };
  const dirty = !!(
    native !== "{}" ||
    nativeOptions !== "{}" ||
    concurrency !== "2" ||
    initializeTimeout !== "45000" ||
    environment !== "{}" ||
    providerInput ||
    name ||
    key ||
    model ||
    command ||
    instructions ||
    baseURL ||
    backend ||
    args !== "" ||
    fast ||
    thinkingTouched ||
    authSource ||
    authMode !== "subscription"
  );
  useDraft(dirty);
  const clearDraft = () => {
    // 凭据和连接选项都属于同一份内存草稿；显式清除之后才能安全切换页面。
    setName("");
    setProviderInput("");
    setEnvironment("{}");
    setNative("{}");
    setNativeOptions("{}");
    setCreatedConnection("");
    setAuthSource("");
    setKey("");
    setModel("");
    setCommand("");
    setArgs("");
    setBaseURL("");
    setBackend("");
    setFast(false);
    setThinking("");
    setConcurrency("2");
    setInitializeTimeout("45000");
    setThinkingTouched(false);
    setAuthMode("subscription");
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
      if (platform.kind !== "acp" && !modelId) throw Error("model_required");
      if (catalog.agents.some((a) => a.name === name)) throw Error("agent_already_exists");
      const connection = backend || createdConnection || `${name}_connection`;
      // 先完成本地字段检查，避免高级参数冲突或未知模型留下半份连接。
      const options = buildAgentOptions(
        platform,
        provider,
        modelId,
        thinking,
        nativeObject(nativeOptions),
      );
      if (platform.kind === "pi") {
        const host = nativeObject(!backend && !createdConnection ? native : "{}");
        const registered = asObject(asObject(host.models).providers)[provider];
        const customModels = asObject(registered).models;
        const savedConnection = catalog.backends.find((item) => item.name === connection);
        const declared = savedConnection?.registeredModels?.[provider] ?? [];
        if (
          !models.some((item) => item.provider === provider && item.id === modelId) &&
          !declared.includes(modelId) &&
          !(
            Array.isArray(customModels) &&
            customModels.some((item) => asObject(item).id === modelId)
          )
        )
          throw Error(models.length ? "unknown_pi_model" : "models_unavailable");
      }
      if (
        backend &&
        !compatibleConnection(
          catalog.backends.find((b) => b.name === backend)!,
          platform,
          provider,
        )
      )
        throw Error("incompatible_backend");
      if (!backend && !createdConnection) {
        const doc = await api<ConfigDocument>("documents/backends/backends"),
          raw = JSON.parse(doc.text) as JsonObject;
        if (Object.hasOwn(asObject(raw.items), connection)) throw Error("backend_already_exists");
        let launchCommand = command,
          launchArgs = args.trim() || "[]",
          launchEnv = environment;
        if (platform.id === "claude-code") {
          const preset = defaults?.claudeCode;
          if (!preset) throw Error("platform_defaults_unavailable");
          if (!preset.supported) throw Error("linuxOnly");
          launchCommand = command.trim() || preset.command;
          launchArgs = args.trim() ? args : JSON.stringify(preset.args);
          const env: JsonObject = { ...preset.env, ...nativeObject(environment) };
          if (authMode === "subscription")
            env.ACP_AUTH_SOURCE = authSource.trim() || preset.authSource;
          else {
            if (!key) throw Error("api_key_required");
            env.ANTHROPIC_AUTH_TOKEN = key;
            if (baseURL.trim()) env.ANTHROPIC_BASE_URL = baseURL.trim();
          }
          if (model.trim()) env.ANTHROPIC_MODEL = model.trim();
          env.ACP_ENV_ALLOWLIST = [
            ...new Set(
              [
                String(env.ACP_ENV_ALLOWLIST ?? "").split(":"),
                ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL"],
              ]
                .flat()
                .filter(Boolean),
            ),
          ].join(":");
          launchEnv = JSON.stringify(env);
        }
        raw.items = {
          ...asObject(raw.items),
          [connection]: buildConnection({
            platform,
            provider,
            model: modelId,
            key,
            baseURL,
            fast,
            command: launchCommand,
            args: launchArgs,
            env: launchEnv,
            native,
            maxConcurrentRequests: concurrency,
            initializeTimeoutMs: initializeTimeout,
          }),
        };
        await api("documents/backends/backends", {
          method: "PUT",
          body: { revision: doc.revision, text: JSON.stringify(raw) },
        });
        // 两文件保存可能部分成功，明确保留已创建连接；重试继续认证/Agent步骤，不碰无关条目。
        setCreatedConnection(connection);
      }
      if (importSubscription)
        await api("codex-import", { method: "POST", body: { backend: connection } });
      if (platform.id === "codex" && fast && !backend) {
        const current = await api<ConfigDocument>("documents/backends/backends");
        const raw = JSON.parse(current.text) as JsonObject;
        const item = asObject(asObject(raw.items)[connection]);
        const config = asObject(item.config),
          models = asObject(config.models),
          providers = asObject(models.providers);
        const providerConfig = asObject(providers[provider]),
          overrides = asObject(providerConfig.modelOverrides);
        const modelConfig = asObject(overrides[modelId]);
        if (asObject(modelConfig.samplingParams).service_tier !== "priority") {
          providerConfig.modelOverrides = {
            ...overrides,
            [modelId]: {
              ...modelConfig,
              samplingParams: { ...asObject(modelConfig.samplingParams), service_tier: "priority" },
            },
          };
          providers[provider] = providerConfig;
          models.providers = providers;
          config.models = models;
          item.config = config;
          raw.items = { ...asObject(raw.items), [connection]: item };
          await api("documents/backends/backends", {
            method: "PUT",
            body: { revision: current.revision, text: JSON.stringify(raw) },
          });
        }
      }
      const doc = await api<ConfigDocument>("documents/agents/agents"),
        raw = JSON.parse(doc.text) as JsonObject;
      // 目录刷新前可能新增同名 Agent；基于刚读取的原文件检查，不能覆盖外部新条目。
      if (Object.hasOwn(asObject(raw.items), name)) throw Error("agent_already_exists");
      raw.items = {
        ...asObject(raw.items),
        [name]: {
          backend: connection,
          options,
          ...(instructions === undefined ? {} : { customInstructions: instructions }),
        },
      };
      // 首个 Agent 同时成为默认值，后续添加保留用户已经选择的默认 Agent。
      if (raw.default === undefined) raw.default = name;
      await api("documents/agents/agents", {
        method: "PUT",
        body: { revision: doc.revision, text: JSON.stringify(raw) },
      });
      clearDraft();
      setSavedAgent(name);
      setMessage(t("saved"));
      onSaved();
    } catch (error) {
      const codes = {
        model_required: "modelMissing",
        provider_required: "providerMissing",
        api_key_required: "keyMissing",
        connection_fields_required: "fieldsMissing",
        acp_command_required: "commandMissing",
        invalid_arguments: "invalidArgs",
        invalid_environment: "invalidEnvironment",
        agent_already_exists: "duplicateAgent",
        backend_already_exists: "duplicateBackend",
        incompatible_backend: "incompatibleBackend",
        models_unavailable: "modelsUnavailable",
        unknown_pi_model: "unknownModel",
      } as const;
      const code = error instanceof Error ? error.message : "request_failed";
      setError(
        error instanceof SyntaxError || code === "object_required"
          ? l("invalidNative")
          : code.startsWith("native_field_conflict:")
            ? `${l("nativeConflict")} ${code.split(":").slice(1).join(":")}`
            : code.startsWith("positive_integer_required:")
              ? `${l("invalidPositive")} ${code.split(":")[1]}`
              : Object.hasOwn(codes, code)
                ? l(codes[code as keyof typeof codes])
                : code,
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel wizard">
      <fieldset disabled={busy} className="wizard-fields">
        <span className="eyebrow">{t("selectPlatform")}</span>
        <h2>{t("newAgent")}</h2>
        <p className="muted">{t("agentHelp")}</p>
        <div className="platform-grid">
          {platforms.map((p) => (
            <button
              disabled={!!createdConnection}
              className={`platform ${p.id === platformId ? "selected" : ""}`}
              key={p.id}
              onClick={() => {
                setPlatformId(p.id);
                setCreatedConnection("");
                setNative("{}");
                setNativeOptions("{}");
                setEnvironment("{}");
                setProviderInput("");
                setAuthSource("");
                setModel("");
                setBackend("");
                setKey("");
                setBaseURL("");
                setCommand("");
                setArgs("");
                setFast(false);
                setThinking("");
                setConcurrency("2");
                setInitializeTimeout("45000");
                setThinkingTouched(false);
                setError("");
              }}
            >
              <span className="platform-mark">{p.name.charAt(0)}</span>
              <strong>{p.name}</strong>
              <small>{p.kind.toUpperCase()}</small>
            </button>
          ))}
        </div>
        {(backend || createdConnection) && (
          <AgentConnectionInfo
            connection={catalog.backends.find(
              (item) => item.name === (backend || createdConnection),
            )}
            provider={provider}
            model={modelId}
            locale={locale}
          />
        )}
        <div className="two-columns">
          <label>
            {t("agentId")}
            <input
              aria-label={t("agentId")}
              value={name}
              placeholder="my_agent"
              onChange={(e) => setName(e.target.value)}
            />
            <small className="muted">{configUiText(locale, "configIdHelp")}</small>
          </label>
          <label>
            {t("backend")}
            <select
              disabled={!!createdConnection}
              value={backend}
              onChange={(e) => setBackend(e.target.value)}
            >
              <option value="">{t("connectionAuto")}</option>
              {catalog.backends
                .filter((b) => compatibleConnection(b, platform, provider))
                .map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {platform.id === "pi-native" && (
          <label>
            {l("provider")}
            <input
              list="pi-providers"
              disabled={!!createdConnection}
              value={providerInput}
              onChange={(e) => setProviderInput(e.target.value)}
            />
            <datalist id="pi-providers">
              {[...new Set(models.map((m) => m.provider))].map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </label>
        )}
        {platform.kind === "acp" ? (
          !backend && (
            <>
              {platform.id === "claude-code" && (
                <div className="hint">
                  <p>{l("isolation")}</p>
                  <p>
                    {defaults?.claudeCode.supported === false
                      ? l("linuxOnly")
                      : defaults && Object.values(defaults.claudeCode.available).every(Boolean)
                        ? l("installed")
                        : l("notInstalled")}
                  </p>
                  <label>
                    {l("authMode")}
                    <select
                      aria-label={l("authMode")}
                      disabled={!!createdConnection}
                      value={authMode}
                      onChange={(e) => setAuthMode(e.target.value)}
                    >
                      <option value="subscription">{l("subscription")}</option>
                      <option value="api">{l("apiMode")}</option>
                    </select>
                  </label>
                  {authMode === "subscription" ? (
                    <label>
                      {l("authFile")}
                      <input
                        disabled={!!createdConnection}
                        value={authSource}
                        placeholder={defaults?.claudeCode.authSource}
                        onChange={(e) => setAuthSource(e.target.value)}
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        {t("apiKey")}
                        <input
                          aria-label={t("apiKey")}
                          type="password"
                          autoComplete="off"
                          disabled={!!createdConnection}
                          value={key}
                          onChange={(e) => setKey(e.target.value)}
                        />
                      </label>
                      <label>
                        {t("baseURL")}
                        <input
                          aria-label={t("baseURL")}
                          disabled={!!createdConnection}
                          value={baseURL}
                          placeholder="https://api.anthropic.com"
                          onChange={(e) => setBaseURL(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    {t("model")}
                    <input
                      disabled={!!createdConnection}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <div className="two-columns">
                <label>
                  {t("command")}
                  <input
                    disabled={!!createdConnection}
                    value={command}
                    placeholder={
                      platform.id === "claude-code"
                        ? defaults?.claudeCode.command
                        : "/absolute/path/to/isolated-acp-launcher"
                    }
                    onChange={(e) => setCommand(e.target.value)}
                  />
                </label>
                <label>
                  {t("args")}
                  <textarea
                    aria-label={t("args")}
                    disabled={!!createdConnection}
                    value={args}
                    placeholder={
                      platform.id === "claude-code"
                        ? JSON.stringify(defaults?.claudeCode.args)
                        : "[]"
                    }
                    onChange={(e) => setArgs(e.target.value)}
                  />
                  <small className="muted">{l("argsHelp")}</small>
                </label>
              </div>
              <label>
                {l("environment")}
                <textarea
                  aria-label={l("environment")}
                  disabled={!!createdConnection}
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                />
              </label>
            </>
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
                  placeholder={platform.kind === "pi" ? suggested?.id : ""}
                  onChange={(e) => setModel(e.target.value)}
                />
                <datalist id="models">
                  {choices.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </datalist>
                {platform.kind === "pi" && <small className="muted">{l("optionalModel")}</small>}
              </label>
              <AgentThinkingField
                kind={platform.kind}
                provider={provider}
                model={modelId}
                options={thinkingOptions}
                models={models}
                locale={locale}
                onChange={(options) => {
                  const field = platform.kind === "pi" ? "defaultThinkingLevel" : "reasoningEffort";
                  setThinking(String(options[field] ?? ""));
                  const extension = { ...optionDraft };
                  delete extension[field];
                  if (options.modelThinkingLevels)
                    extension.modelThinkingLevels = options.modelThinkingLevels;
                  else delete extension.modelThinkingLevels;
                  setNativeOptions(JSON.stringify(extension, null, 2));
                  setThinkingTouched(true);
                }}
              />
            </div>
            {!backend && platform.id !== "codex" && (
              <label>
                {t("apiKey")}
                <input
                  aria-label={t("apiKey")}
                  type="password"
                  autoComplete="off"
                  disabled={!!createdConnection}
                  value={key}
                  placeholder={platform.credential ? "${" + platform.credential + "}" : ""}
                  onChange={(e) => setKey(e.target.value)}
                />
                <small className="muted">
                  {l(platform.kind === "llm" ? "apiCompatibleHelp" : "apiHelp")}
                </small>
              </label>
            )}
            {!backend && (
              <label>
                {t("baseURL")}
                <input
                  aria-label={t("baseURL")}
                  disabled={!!createdConnection}
                  value={baseURL}
                  placeholder={
                    platform.kind === "pi"
                      ? (currentModel?.baseUrl ?? suggested?.baseUrl)
                      : "https://example.com/v1"
                  }
                  onChange={(e) => setBaseURL(e.target.value)}
                />
                <small className="muted">
                  {l(platform.kind === "pi" ? "optionalEndpoint" : "requiredEndpoint")}
                </small>
              </label>
            )}
            {platform.id === "codex" && (
              <div className="hint">
                <p>{t("codexHelp")}</p>
                {!backend && (
                  <label className="check">
                    <input
                      type="checkbox"
                      disabled={!!createdConnection}
                      checked={fast}
                      onChange={(e) => setFast(e.target.checked)}
                    />
                    {l("fastCheckbox")}
                  </label>
                )}
                <p className="muted">{l("fastHelp")}</p>
                {!backend && (
                  <p>
                    {l("effectiveTier")}:{" "}
                    <strong>{fast ? "priority" : nativeTier || l("sdkDefault")}</strong>
                  </p>
                )}
              </div>
            )}
          </>
        )}
        <details className="field-section">
          <summary>{t("advanced")}</summary>
          <p className="muted">{l(platform.kind === "pi" ? "nativeHelp" : "nativeGeneralHelp")}</p>
          {!backend && (
            <>
              <label>
                {l("concurrency")}
                <input
                  aria-label={l("concurrency")}
                  type="number"
                  min="1"
                  step="1"
                  disabled={!!createdConnection}
                  value={concurrency}
                  onChange={(event) => setConcurrency(event.target.value)}
                />
                <small className="muted">{l("concurrencyHelp")}</small>
              </label>
              {platform.kind === "acp" && (
                <label>
                  {l("initializeTimeout")}
                  <input
                    aria-label={l("initializeTimeout")}
                    type="number"
                    min="1"
                    step="1"
                    disabled={!!createdConnection}
                    value={initializeTimeout}
                    onChange={(event) => setInitializeTimeout(event.target.value)}
                  />
                  <small className="muted">{l("initializeHelp")}</small>
                </label>
              )}
              <label>
                {l("nativeConnection")}
                <textarea
                  aria-label={l("nativeConnection")}
                  disabled={!!createdConnection}
                  value={native}
                  onChange={(e) => setNative(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            {l("nativeOptions")}
            <textarea
              aria-label={l("nativeOptions")}
              value={nativeOptions}
              onChange={(e) => setNativeOptions(e.target.value)}
            />
          </label>
        </details>
        <section className="field-section">
          <h3>{t("customInstructions")}</h3>
          <Instructions value={instructions} onChange={setInstructions} t={t} />
        </section>
        <div className="actions">
          <button disabled={busy || !dirty} onClick={clearDraft}>
            {t("clear")}
          </button>
          <button className="primary" disabled={busy || !name} onClick={() => void submit()}>
            {importSubscription ? `${t("codexImport")} + ${t("save")}` : t("save")}
          </button>
        </div>
      </fieldset>
      {createdConnection && (
        <p className="hint">
          {l("connectionReady")} <code>{createdConnection}</code>
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {t("error")}
          <p>
            {["codex_auth_missing", "codex_auth_unreadable", "codex_auth_invalid"].includes(error)
              ? l(error as "codex_auth_missing")
              : (workbenchServiceMessage(locale, error) ?? error)}
          </p>
        </div>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {savedAgent && (
        <AgentConnectionTest name={savedAgent} locale={locale} disabled={dirty || busy} />
      )}
    </section>
  );
}
