/**
 * 负责运行配置中原生 Agent 文档的静态能力校验；输入已解析 RuntimeConfig，输出校验成功或原生字段错误。
 * 共享真实 adapter 校验器，不读取文件或环境、不创建会话，不修改候选文档与认证；运行资源仍归 Agent 装配。
 * 环境占位只由上游 parser 在临时对象中解析，调用方保存原始文档，不将此校验输入写回 JSON。
 */
import type { RuntimeConfig } from "./contracts";

export async function validateRuntimeNativeConfig(runtime: {
  providers: Pick<RuntimeConfig["providers"], "items">;
  agents: Pick<RuntimeConfig["agents"], "items">;
}): Promise<void> {
  if (!Object.values(runtime.providers.items).some((provider) => provider.type === "pi")) return;
  const { validatePiHostConfig, validatePiSettings } =
    await import("../../adapters/pi/native-config");
  for (const provider of Object.values(runtime.providers.items))
    if (provider.type === "pi")
      validatePiHostConfig({ models: provider.models, auth: provider.auth });
  for (const agent of Object.values(runtime.agents.items))
    if (agent.kind === "pi") validatePiSettings({ ...agent.piSettings });
}
