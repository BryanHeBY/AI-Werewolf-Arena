/**
 * 负责给 Pi 提供显式空资源集。所有资源都由宿主输入，reload 不发现 home、项目或包路径。
 * 内存 extension runtime 只供 SDK 接线；没有扩展可取得它，也不创建 shell/MCP/文件工具。
 * 本模块没有在途 I/O 或独立 deadline；取消由会话 signal 持有，空 reload 不延长该期限。
 */
import { createExtensionRuntime, type ResourceLoader } from "@earendil-works/pi-coding-agent";

export function emptyPiResourceLoader(systemPrompt: string): ResourceLoader {
  const extensions = { extensions: [], errors: [], runtime: createExtensionRuntime() };
  return {
    getExtensions: () => extensions,
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: (paths) => {
      if (Object.values(paths).some((entries) => entries?.length)) {
        throw new Error("pi_resources_disabled");
      }
    },
    reload: async () => {},
  };
}
