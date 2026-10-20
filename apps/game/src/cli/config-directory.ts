/**
 * 负责 CLI 配置目录的来源优先级；输入为显式参数与环境路径，输出相对公共入口调用目录解析的绝对路径。
 * 缺省目录由项目根唯一定位；空串保留给配置加载器诊断，不搜索其它候选目录。
 */
import { projectDataPath, resolveInputPath } from "@ai-werewolf-arena/project-paths";
export function resolveCliConfigDirectory(
  explicit?: string,
  environment: NodeJS.ProcessEnv = process.env,
  invocationDirectory = process.cwd(),
): string {
  const input = explicit ?? environment.GAME_CONFIGS_DIR;
  return input === undefined
    ? projectDataPath("configs")
    : input === ""
      ? ""
      : resolveInputPath(input, invocationDirectory);
}
