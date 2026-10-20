/** 工作台文件与运行服务的中英文诊断；保留机器码，令牌、原始文件正文和异常栈不进入说明。 */
const messages = {
  file_access_denied: [
    "文件权限不允许此操作，请检查目标目录权限后重试。",
    "File permissions do not allow this action. Check the target directory permissions and retry.",
  ],
  disk_full: [
    "磁盘空间不足，文件尚未保存，请释放空间后重试。",
    "There is not enough disk space to save the file. Free some space and retry.",
  ],
  config_not_found: [
    "配置文件已不存在，请刷新列表。",
    "The configuration no longer exists. Refresh the list.",
  ],
  config_conflict: [
    "配置已被其他操作修改，请重新读取后再继续。",
    "The configuration changed. Reload it before continuing.",
  ],
  board_in_use: [
    "板子仍被游戏配置引用，请先修改或删除这些游戏。",
    "Saved games still reference this board. Change or delete them first.",
  ],
  board_references_unreadable: [
    "部分游戏配置无法读取，暂时无法安全确认板子引用。",
    "Some game configurations cannot be read, so board references cannot be checked safely.",
  ],
  delete_not_supported: [
    "此类配置不支持整份删除。",
    "This configuration type cannot be deleted as a whole.",
  ],
  run_conflict: [
    "对局文件已变化，请刷新状态后重新确认删除。",
    "The game files changed. Refresh the status and confirm deletion again.",
  ],
  run_not_found: [
    "对局记录已不存在，请刷新列表。",
    "The game record no longer exists. Refresh the list.",
  ],
  run_still_alive: [
    "对局进程仍然存活，请先停止并等待保存完成。",
    "The game process is still alive. Stop it and wait for saving to finish.",
  ],
  run_liveness_unknown: [
    "无法确认对局进程已退出，暂不能删除记录。",
    "The process cannot be confirmed as stopped, so its record cannot be deleted yet.",
  ],
  run_not_controllable: [
    "无法确认本机运行身份或停止通道，请刷新状态。",
    "The local process identity or stop channel cannot be verified. Refresh the status.",
  ],
  run_stop_failed: [
    "对局未接受停止请求，请检查日志并刷新状态。",
    "The game did not accept the stop request. Check its logs and refresh the status.",
  ],
  symlink_not_allowed: [
    "目标路径包含符号链接，无法安全修改。",
    "The target path contains a symbolic link and cannot be changed safely.",
  ],
  codex_auth_missing: [
    "未找到本机 ~/.codex/auth.json，请先登录 Codex，然后重试导入。",
    "Local ~/.codex/auth.json was not found. Sign in to Codex, then retry the import.",
  ],
  codex_auth_unreadable: [
    "无法读取本机 Codex 认证文件，请检查文件类型与读取权限后重试。",
    "The local Codex credentials cannot be read. Check the file type and permissions, then retry.",
  ],
  codex_auth_invalid: [
    "本机 Codex 认证文件不是有效 JSON，请重新登录后重试。",
    "The local Codex credentials are not valid JSON. Sign in again, then retry.",
  ],
  codex_auth_unavailable: [
    "本机 Codex 文件没有可导入的订阅令牌，请先完成订阅登录。",
    "The local Codex file has no importable subscription tokens. Complete subscription sign-in first.",
  ],
  invalid_document: [
    "请求缺少有效文档版本，请刷新配置后重试。",
    "The request is missing a valid document revision. Refresh the configuration and retry.",
  ],
  invalid_backend: [
    "所选连接不能接收该认证，请选择正确平台连接。",
    "This connection cannot accept these credentials. Choose the correct platform connection.",
  ],
} satisfies Record<string, readonly [string, string]>;

export function workbenchServiceMessage(locale: "zh-CN" | "en", code: string): string | undefined {
  const entry = messages[code as keyof typeof messages];
  return entry?.[locale === "en" ? 1 : 0];
}
