/**
 * 负责向应用调用方公开路径语义，输入声明的路径和基准，输出绝对路径：项目数据默认归仓库根，显式输入归调用目录，文件引用归声明文件。
 * 这里只定位路径，不读取配置、不搜索候选目录，也不改变调用进程或子进程的 cwd。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 源码／工作区安装共享的唯一根定位；应用不得再次按自己的目录层数推算仓库。 */
export const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export function projectDataPath(name: "configs" | "record" | "output" | ".workbench"): string {
  return path.resolve(PROJECT_ROOT, name);
}
export function resolveInputPath(input: string, invocationDirectory = process.cwd()): string {
  return path.resolve(invocationDirectory, input);
}
export function resolveDeclaredPath(input: string, declaringFile: string): string {
  return path.resolve(path.dirname(declaringFile), input);
}
/** 工具工作目录与用户数据目录分别定位，切换工具目录前应先解析全部输入。 */
export function applicationDirectory(
  application: "game" | "replay" | "video" | "workbench",
): string {
  return path.resolve(PROJECT_ROOT, "apps", application);
}
export function applicationResource(
  application: "game" | "replay" | "video" | "workbench",
  ...segments: string[]
): string {
  return path.resolve(applicationDirectory(application), ...segments);
}

export { resolveReplayInput } from "./replay-input";
