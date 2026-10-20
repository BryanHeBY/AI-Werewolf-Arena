/**
 * 负责终端 ANSI 着色开关与文本渲染。输入为显式开关、进程环境及原文本，输出开关或带颜色控制符的文本。
 * 只处理展示；不修改事件、环境变量或日志落盘内容，未给显式开关时按短路顺序读取当次环境，不缓存判断。
 */
export type AnsiTone = "muted" | "info" | "ok" | "warn" | "error" | "accent" | "god";

// 色调表只保存终端控制符；渲染结束恢复默认颜色，不参与游戏事件的数据结构。
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
 * 优先级为显式布尔值 → 非空 NO_COLOR → 认可的 FORCE_COLOR 值 → stdout.isTTY。
 * 显式 false 也直接返回；NO_COLOR 关闭后不会继续读取 FORCE_COLOR。
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
 * 关闭时返回原文本；开启时仅包裹控制符，不清洗正文或验证运行时传入的色调。
 */
export function colorize(text: string, tone: AnsiTone, enabled: boolean): string {
  if (!enabled) {
    return text;
  }
  return `${ANSI[tone]}${text}${ANSI_RESET}`;
}
