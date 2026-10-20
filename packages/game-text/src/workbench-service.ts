/** 工作台文件与运行服务的中英文诊断；保留机器码，令牌、原始文件正文和异常栈不进入说明。 */
export const zhCN = {
  file_access_denied: "文件权限不允许此操作，请检查目标目录权限后重试。",
  disk_full: "磁盘空间不足，文件尚未保存，请释放空间后重试。",
  config_not_found: "配置文件已不存在，请刷新列表。",
  config_conflict: "配置已被其他操作修改，请重新读取后再继续。",
  board_in_use: "板子仍被游戏配置引用，请先修改或删除这些游戏。",
  board_references_unreadable: "部分游戏配置无法读取，暂时无法安全确认板子引用。",
  delete_not_supported: "此类配置不支持整份删除。",
  run_conflict: "对局文件已变化，请刷新状态后重新确认删除。",
  run_not_found: "对局记录已不存在，请刷新列表。",
  run_still_alive: "对局进程仍然存活，请先停止并等待保存完成。",
  run_liveness_unknown: "无法确认对局进程已退出，暂不能删除记录。",
  run_not_controllable: "无法确认本机运行身份或停止通道，请刷新状态。",
  run_stop_failed: "对局未接受停止请求，请检查日志并刷新状态。",
  symlink_not_allowed: "目标路径包含符号链接，无法安全修改。",
  codex_auth_missing: "未找到本机 ~/.codex/auth.json，请先登录 Codex，然后重试导入。",
  codex_auth_unreadable: "无法读取本机 Codex 认证文件，请检查文件类型与读取权限后重试。",
  codex_auth_invalid: "本机 Codex 认证文件不是有效 JSON，请重新登录后重试。",
  codex_auth_unavailable: "本机 Codex 文件没有可导入的订阅令牌，请先完成订阅登录。",
  invalid_document: "请求缺少有效文档版本，请刷新配置后重试。",
  invalid_backend: "所选连接不能接收该认证，请选择正确平台连接。",
} as const;
export const en: Record<keyof typeof zhCN, string> = {
  file_access_denied:
    "File permissions do not allow this action. Check the target directory permissions and retry.",
  disk_full: "There is not enough disk space to save the file. Free some space and retry.",
  config_not_found: "The configuration no longer exists. Refresh the list.",
  config_conflict: "The configuration changed. Reload it before continuing.",
  board_in_use: "Saved games still reference this board. Change or delete them first.",
  board_references_unreadable:
    "Some game configurations cannot be read, so board references cannot be checked safely.",
  delete_not_supported: "This configuration type cannot be deleted as a whole.",
  run_conflict: "The game files changed. Refresh the status and confirm deletion again.",
  run_not_found: "The game record no longer exists. Refresh the list.",
  run_still_alive: "The game process is still alive. Stop it and wait for saving to finish.",
  run_liveness_unknown:
    "The process cannot be confirmed as stopped, so its record cannot be deleted yet.",
  run_not_controllable:
    "The local process identity or stop channel cannot be verified. Refresh the status.",
  run_stop_failed:
    "The game did not accept the stop request. Check its logs and refresh the status.",
  symlink_not_allowed: "The target path contains a symbolic link and cannot be changed safely.",
  codex_auth_missing:
    "Local ~/.codex/auth.json was not found. Sign in to Codex, then retry the import.",
  codex_auth_unreadable:
    "The local Codex credentials cannot be read. Check the file type and permissions, then retry.",
  codex_auth_invalid: "The local Codex credentials are not valid JSON. Sign in again, then retry.",
  codex_auth_unavailable:
    "The local Codex file has no importable subscription tokens. Complete subscription sign-in first.",
  invalid_document:
    "The request is missing a valid document revision. Refresh the configuration and retry.",
  invalid_backend:
    "This connection cannot accept these credentials. Choose the correct platform connection.",
};

export function workbenchServiceMessage(locale: "zh-CN" | "en", code: string): string | undefined {
  return (locale === "en" ? en : zhCN)[code as keyof typeof zhCN];
}
