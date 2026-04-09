
/**
 * ANSI 颜色工具：统一日志着色开关与渲染。
 */
export type AnsiTone =
  | "muted"
  | "info"
  | "ok"
  | "warn"
  | "error"
  | "accent"
  | "god";

const ANSI_RESET = "\u001b[0m";
const ANSI: Record<AnsiTone, string> = {
  muted: "\u001b[90m",
  info: "\u001b[36m",
  ok: "\u001b[32m",
  warn: "\u001b[33m",
  error: "\u001b[31m",
  accent: "\u001b[35m",
  god: "\u001b[94m",
};

/**
 * 判断当前运行环境是否启用 ANSI 颜色输出。
 */
export function isAnsiEnabled(explicit?: boolean): boolean {
  if (explicit !== undefined) {
    return explicit;
  }
  const noColor = String(process.env.NO_COLOR ?? "").trim();
  if (noColor !== "") {
    return false;
  }
  const forceColor = String(process.env.FORCE_COLOR ?? "").trim();
  if (["1", "true", "yes", "on"].includes(forceColor.toLowerCase())) {
    return true;
  }
  return Boolean(process.stdout.isTTY);
}

/**
 * 按指定色调渲染文本。
 */
export function colorize(text: string, tone: AnsiTone, enabled: boolean): string {
  if (!enabled) {
    return text;
  }
  return `${ANSI[tone]}${text}${ANSI_RESET}`;
}
