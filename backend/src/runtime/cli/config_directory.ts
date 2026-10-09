import path from "node:path";

/** Defaults are project-relative; explicit and environment paths remain cwd-relative. */
export function resolveCliConfigDirectory(
  explicit?: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return (
    explicit ?? environment.GAME_CONFIGS_DIR ?? path.resolve(__dirname, "../../../..", "configs")
  );
}
