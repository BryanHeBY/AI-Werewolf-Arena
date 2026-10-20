/**
 * 负责导出已安装 Pi 的内置模型目录；输入仅为 SDK 版本，输出无认证的模型能力摘要。
 * 使用内存认证与空 modelsPath，关闭模型网络刷新；不创建 Agent 会话或读取宿主配置文件。
 */
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { PiMemoryCredentials } from "../../adapters/pi/memory-auth";
export async function describeModelCatalog() {
  const runtime = await ModelRuntime.create({
    credentials: new PiMemoryCredentials(),
    modelsPath: null,
    refreshOnCreate: false,
    allowModelNetwork: false,
  });
  return runtime.getModels().map((model) => ({
    provider: model.provider,
    id: model.id,
    name: model.name,
    // 内置目录的地址只用于表单缺省提示；不读取用户 overrides 或凭据。
    baseUrl: model.baseUrl,
    reasoning: model.reasoning,
    thinkingLevels: getSupportedThinkingLevels(model),
  }));
}
