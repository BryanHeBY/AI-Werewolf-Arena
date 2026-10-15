/**
 * 负责 CLI 配置目录的来源优先级。输入为显式路径和环境，输出显式值、环境值或项目内默认绝对路径。
 * 仅默认值相对项目求绝对路径；显式／环境的原字符串由调用方后续按 cwd 解释，不在此探测文件。
 */
import path from "node:path";

/** nullish 优先级保留空串等显式输入；目录是否可用由加载层检查。 */
export function resolveCliConfigDirectory(
  explicit?: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return (
    explicit ?? environment.GAME_CONFIGS_DIR ?? path.resolve(__dirname, "../../../..", "configs")
  );
}
