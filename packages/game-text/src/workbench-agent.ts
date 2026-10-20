/** 负责平台配置的双语说明。输入语言与消息标识，输出可恢复的操作说明；不解释认证或修改配置。 */
import type { Locale } from "@ai-werewolf-arena/game-text";
export const zhCN = {
  editNativeSource: "高级参数可在 JSON 源码中编辑；表单修改保留其它参数。",
  optionalEndpoint: "可留空：使用 Pi 内置地址；只有代理或自定义服务才填写覆盖。",
  requiredEndpoint: "此兼容服务需要填写 API 地址。",
  apiHelp: "填写此平台的 API key 或环境占位符，不需要同时设置地址。",
  nativeHelp: "直接编辑 Pi 原生 models/auth 等连接字段；未填写的字段继续使用 SDK 缺省值。",
  nativeConnection: "原生连接扩展（JSON 对象）",
  nativeOptions: "Agent 原生参数（JSON 对象）",
  nativeGeneralHelp:
    "仅填写表单没有提供的高级字段；重复声明表单字段会提示冲突。使用对应 LLM 或 ACP 的配置字段，不是 Pi 配置。",
  argsHelp: "留空沿用平台预设参数（自定义 ACP 为无参数）；显式填写 [] 表示不传任何参数。",
  environment: "环境变量（JSON 对象）",
  provider: "Pi 提供商 ID",
  optionalModel:
    "可留空，使用提示的内置模型。自定义模型必须先在本连接的原生 models.providers 中注册。",
  thinking: "思考等级",
  sdkDefault: "使用 SDK 默认（不指定）",
  runtimeDefault: "沿用运行时默认",
  thinkingHelp:
    "留空不写入思考参数；选择等级后显式应用于当前模型。off/none 表示关闭思考，与未指定不同。",
  thinkingOverrideHelp:
    "当前值来自此模型的 modelThinkingLevels 覆盖，优先于默认等级；修改此处会移除当前模型的旧覆盖。",
  concurrency: "共享连接最大并发数",
  concurrencyHelp:
    "同一连接的所有玩家共用此限制，排队也计入行动时限。留空沿用运行时默认；数值越小等待越长。",
  initializeTimeout: "ACP 会话初始化上限（毫秒）",
  initializeHelp:
    "只约束进程与会话初始化；游戏的单次行动时限仍可更早结束请求。留空使用运行时默认。",
  sharedConnectionHelp:
    "以下设置由该共享连接提供，影响复用它的玩家。修改请前往“连接与认证源码”，不会由 Agent 表单改写。",
  effectiveTier: "当前模型的连接请求档位",
  fastCheckbox: "启用快速请求档位（priority）",
  fastHelp:
    "勾选为该连接中的当前模型设置 priority 请求档位；未勾选时沿用原生配置或 SDK 默认。复用此连接和模型的其他 Agent 也会继承；不改变思考等级。",
  apiCompatibleHelp: "填写服务的 API key 或环境占位符，并在下方填写该兼容服务的 API 地址。",
  nativeConflict: "原生 JSON 与表单重复声明字段，请删除重复字段后保存：",
  invalidNative: "请填写有效的 JSON 对象。",
  invalidPositive: "请输入正整数，或留空使用默认：",
  modelMissing: "请选择模型。自定义 Pi 模型需要在本连接 models.providers 中注册。",
  providerMissing: "请填写 Pi 提供商 ID。",
  keyMissing: "请填写 API key、环境占位符，或在原生连接中配置认证。",
  fieldsMissing: "此兼容服务需要 API key 和 API 地址。",
  commandMissing: "请填写 ACP 启动命令。",
  invalidArgs: "启动参数必须是由字符串组成的 JSON 数组。",
  invalidEnvironment: "环境变量必须是字符串键值组成的 JSON 对象。",
  duplicateAgent: "该 Agent ID 已存在，请修改 ID 或编辑已有 Agent。",
  duplicateBackend: "该连接 ID 已存在，请复用已有连接或修改 Agent ID。",
  incompatibleBackend: "该连接没有为所选平台配置提供商或认证，请选择兼容连接。",
  modelsUnavailable: "模型目录尚未就绪，请稍候重试，或明确注册自定义模型。",
  unknownModel:
    "此 Pi 模型未在内置目录或本连接中注册。请检查模型 ID，或先在原生 models.providers 中添加模型声明。",
  isolation: "使用隔离启动器，仅挂载工具依赖、选定认证与当前玩家工作区。",
  authFile: "本地 Claude 认证文件",
  authMode: "Claude Code 认证方式",
  subscription: "本地 Claude 订阅",
  apiMode: "Anthropic 兼容 API（可用 Coding Plan）",
  installed: "隔离启动器、适配器和 bwrap 已就绪。",
  notInstalled:
    "缺少适配器或 bwrap，请先按本地运行指南安装，或修改启动路径。保存配置不会安装工具。",
  linuxOnly:
    "该隔离预设使用 Linux bwrap。当前系统请使用 Pi、LLM，或在自定义 ACP 中填写适合本机的隔离命令。",
  connectionReady:
    "连接已保存并锁定连接字段，重试会复用它继续导入认证或创建 Agent。修改连接请清除向导后进入连接源码。",
  codex_auth_missing: "未找到本地 Codex 认证，请先在运行工作台的机器上登录 Codex，再重试。",
  codex_auth_unreadable: "工作台无法读取 Codex 认证文件，请检查运行用户和文件权限后重试。",
  codex_auth_invalid: "Codex 认证文件无法解析或缺少订阅令牌，请重新登录 Codex 后重试。",
  editAgent: "编辑 Agent",
  existingAgents: "已配置 Agent",
  existingConnections: "连接与认证源码",
} as const;
export const en: Record<keyof typeof zhCN, string> = {
  editNativeSource: "Edit advanced options in JSON source. Form edits preserve the other options.",
  optionalEndpoint:
    "Optional: uses Pi's built-in endpoint. Set only for a proxy or custom service.",
  requiredEndpoint: "This compatible endpoint requires an API URL.",
  apiHelp: "Enter this provider's API key or an environment placeholder. No endpoint is required.",
  nativeHelp: "Edit native Pi models/auth and connection fields. Omitted fields keep SDK defaults.",
  nativeConnection: "Native connection overrides (JSON object)",
  nativeOptions: "Native agent options (JSON object)",
  nativeGeneralHelp:
    "Use advanced fields not managed by the form; duplicate form fields are rejected. Use this LLM or ACP backend's fields, not Pi settings.",
  argsHelp:
    "Blank uses the platform's preset arguments (none for Custom ACP). An explicit [] passes no arguments.",
  environment: "Environment variables (JSON object)",
  provider: "Pi provider ID",
  optionalModel:
    "Optional: uses the suggested bundled model. Custom models must first be registered in this connection's native models.providers.",
  thinking: "Thinking level",
  sdkDefault: "Use SDK default (unspecified)",
  runtimeDefault: "Use runtime default",
  thinkingHelp:
    "Unspecified omits the thinking parameter. Selecting a level applies it explicitly to this model. off/none disables thinking and differs from unspecified.",
  thinkingOverrideHelp:
    "This model's modelThinkingLevels override takes precedence over the default. Editing here removes the previous override for this model.",
  concurrency: "Shared connection concurrency limit",
  concurrencyHelp:
    "All players using this connection share this limit. Queue time counts toward the turn deadline. Leave blank for runtime defaults; lower limits cause longer waits.",
  initializeTimeout: "ACP session initialization limit (milliseconds)",
  initializeHelp:
    "Limits process and session initialization only. The game's turn deadline can end the request sooner. Leave blank for runtime defaults.",
  sharedConnectionHelp:
    "These shared connection settings apply to all players reusing it. Edit them in Connection and credential source; the agent form does not rewrite them.",
  effectiveTier: "Connection request tier for this model",
  fastCheckbox: "Enable priority requests",
  fastHelp:
    "Select priority requests for this model in this connection. Unchecked keeps native settings or SDK defaults. Other agents reusing the connection and model inherit it. This does not change the thinking level.",
  apiCompatibleHelp:
    "Enter the service's API key or environment placeholder and its API URL below.",
  nativeConflict: "Native JSON repeats a form-managed field. Remove the duplicate before saving:",
  invalidNative: "Enter a valid JSON object.",
  invalidPositive: "Enter a positive integer, or leave blank for the default:",
  modelMissing:
    "Select a model. Custom Pi models must be registered in this connection's models.providers.",
  providerMissing: "Enter a Pi provider ID.",
  keyMissing:
    "Enter an API key, environment placeholder, or configure authentication in native connection settings.",
  fieldsMissing: "This compatible service requires an API key and API URL.",
  commandMissing: "Enter the ACP launch command.",
  invalidArgs: "Launch arguments must be a JSON array of strings.",
  invalidEnvironment: "Environment variables must be a JSON object with string values.",
  duplicateAgent: "This agent ID already exists. Choose another ID or edit the existing agent.",
  duplicateBackend: "This connection ID already exists. Reuse it or choose another agent ID.",
  incompatibleBackend:
    "This connection has no matching provider or credentials. Choose a compatible connection.",
  modelsUnavailable:
    "The model catalog is not ready. Try again shortly or explicitly register a custom model.",
  unknownModel:
    "This Pi model is not registered in the bundled catalog or this connection. Check the ID or add a native models.providers declaration first.",
  isolation:
    "Uses an isolated launcher with tool dependencies, selected credentials and this player's workspace.",
  authFile: "Local Claude credentials file",
  authMode: "Claude Code authentication",
  subscription: "Local Claude subscription",
  apiMode: "Anthropic-compatible API (including coding plans)",
  installed: "Isolated launcher, adapter and bwrap are ready.",
  notInstalled:
    "Adapter or bwrap is missing. Install using the local guide, or change the launch paths. Saving does not install tools.",
  linuxOnly:
    "This isolation preset requires Linux bwrap. Use Pi, LLM, or a platform-appropriate isolated command under Custom ACP.",
  connectionReady:
    "Connection saved and its fields are locked. Retry reuses it to import credentials or create the agent. Clear the wizard to edit connection source.",
  codex_auth_missing:
    "Local Codex credentials were not found. Sign in to Codex on the server machine, then retry.",
  codex_auth_unreadable:
    "The workbench cannot read Codex credentials. Check the server user and file permissions, then retry.",
  codex_auth_invalid:
    "Codex credentials are invalid or missing subscription tokens. Sign in again, then retry.",
  editAgent: "Edit agent",
  existingAgents: "Configured agents",
  existingConnections: "Connection and credential source",
};
export function agentText(locale: Locale, key: keyof typeof zhCN): string {
  return (locale === "en" ? en : zhCN)[key];
}
