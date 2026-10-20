/**
 * 负责运行配置中原生 Agent 文档的静态能力校验；输入已解析 RuntimeConfig，输出校验成功或原生字段错误。
 * 共享真实 adapter 校验器，不读取文件或环境、不创建会话，不修改候选文档与认证；运行资源仍归 Agent 装配。
 * 环境占位只由上游 parser 在临时对象中解析，调用方保存原始文档，不将此校验输入写回 JSON。
 */
import type { RuntimeConfig } from "./contracts";
import { RuntimeConfigFieldError } from "./field-error";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

// 缓存的只有锁定 SDK 的内置模型目录：没有配置、认证或可变注册，所有使用者只读。
// 用户模型覆盖仍使用独立目录，既避免每次保存为每个内置连接重复装配，也不串用自定义模型。
let bundledModels: Promise<ModelRuntime> | undefined;

export async function validateRuntimeNativeConfig(runtime: {
  providers: Pick<RuntimeConfig["providers"], "items">;
  agents: Pick<RuntimeConfig["agents"], "items">;
}): Promise<void> {
  if (!Object.values(runtime.providers.items).some((provider) => provider.type === "pi")) return;
  const { validatePiHostConfig, validatePiSettings, registerNativePiModels } =
    await import("../../adapters/pi/native-config");
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { InMemoryCredentialStore } = await import("@earendil-works/pi-ai");
  const { bindPiMemoryAuth } = await import("../../adapters/pi/memory-auth");
  // 只组合内置目录与显式模型声明；不注入真实凭据，不创建会话、不刷新网络模型目录。
  // 含模型声明或覆盖的连接独立建立目录；仅内置目录可共用，避免跨连接串用自定义模型。
  for (const [backend, provider] of Object.entries(runtime.providers.items)) {
    if (provider.type !== "pi") continue;
    const host = validatePiHostConfig({ models: provider.models, auth: provider.auth });
    const createCatalog = () =>
      ModelRuntime.create({
        credentials: new InMemoryCredentialStore(),
        modelsPath: null,
        refreshOnCreate: false,
        allowModelNetwork: false,
      });
    const customized =
      Object.keys((host.models.providers as Record<string, unknown> | undefined) ?? {}).length > 0;
    const models = customized ? await createCatalog() : await (bundledModels ??= createCatalog());
    if (customized) {
      bindPiMemoryAuth(models, new Set());
      registerNativePiModels(models, host.models);
      bindPiMemoryAuth(models, new Set());
      await models.refresh({ allowNetwork: false });
      if (models.getError())
        throw new RuntimeConfigFieldError(
          "pi_models_invalid",
          `backends.items.${backend}.config.models`,
        );
    }
    const declared = new Set([
      ...Object.keys(host.auth),
      ...Object.keys((host.models.providers as Record<string, unknown> | undefined) ?? {}),
    ]);
    for (const [name, agent] of Object.entries(runtime.agents.items)) {
      if (agent.kind !== "pi" || agent.provider !== backend) continue;
      const settings = validatePiSettings({ ...agent.piSettings });
      const providerId = settings.defaultProvider as string;
      const modelId = settings.defaultModel as string;
      const field = `agents.items.${name}.options`;
      if (!declared.has(providerId))
        throw new RuntimeConfigFieldError("pi_provider_not_configured", `${field}.defaultProvider`);
      if (!models.getModel(providerId, modelId))
        throw new RuntimeConfigFieldError("pi_model_not_found", `${field}.defaultModel`);
    }
  }
}
