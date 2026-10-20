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
  environment: "环境变量（JSON 对象）",
  provider: "Pi 提供商 ID",
  optionalModel: "可留空，使用提示的内置模型；也可填写自定义模型 ID。",
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
  environment: "Environment variables (JSON object)",
  provider: "Pi provider ID",
  optionalModel: "Optional: uses the suggested bundled model. You can enter a custom model ID.",
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
