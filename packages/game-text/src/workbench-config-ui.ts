/** 负责配置管理文案；输入为界面语言和语义键，输出对应中英文用语。只服务配置界面，不定义运行规则或文件格式。 */
import type { Locale } from "@ai-werewolf-arena/game-contract";
const phrases = {
  savedGames: ["已保存的游戏配置", "Saved game configurations"],
  savedBoards: ["已保存的板子", "Saved boards"],
  newBoard: ["新建板子", "New board"],
  view: ["查看配置", "View configuration"],
  edit: ["编辑", "Edit"],
  copy: ["复制为新配置", "Copy to new configuration"],
  cancel: ["取消", "Cancel"],
  remove: ["删除", "Delete"],
  confirmDelete: ["确认删除", "Confirm deletion"],
  deleteGame: [
    "仅删除这份游戏配置；共用板子、Agent 和已有对局保持保留。",
    "Delete only this game configuration. Shared boards, agents and recorded sessions remain.",
  ],
  deleteBoard: [
    "仅删除这份本地板子。仍有游戏引用时会阻止删除。",
    "Delete only this local board. Saved games referencing it must be updated first.",
  ],
  deleteRun: [
    "删除本局录制、日志和工作台运行登记；其他对局与 output 中的视频保留。",
    "Delete this session's recording, logs and run registration. Other sessions and output videos remain.",
  ],
  references: ["以下游戏仍引用该板子", "Games still referencing this board"],
  noGames: [
    "还没有保存的游戏配置。先选择板子与 Agent，保存后即可启动。",
    "No saved games yet. Choose a board and agents, then save before starting.",
  ],
  noBoards: [
    "还没有本地板子。点击新建，从示例模板创建自己的板子。",
    "No local boards yet. Create a board from an example template.",
  ],
  local: ["本地配置", "Local configuration"],
  example: ["示例模板", "Example template"],
  templates: ["选择模板创建板子", "Create a board from a template"],
  templateHelp: [
    "模板不会被直接修改；填写新的配置 ID 后保存到本地板子。",
    "Templates stay unchanged. Enter a new configuration ID to save a local board.",
  ],
  createGame: ["新建游戏配置", "New game configuration"],
  editGame: ["编辑游戏配置", "Edit game configuration"],
  viewGame: ["查看游戏配置", "View game configuration"],
  editBoard: ["编辑板子", "Edit board"],
  viewBoard: ["查看板子", "View board"],
  discardConfirm: ["放弃当前未保存的修改？", "Discard the current unsaved changes?"],
  savedSnapshot: [
    "此前提交的版本已保存；当前新增修改尚未保存。",
    "The submitted version was saved. Your newer edits are still unsaved.",
  ],
  quickStart: ["选择已保存的游戏，直接开局", "Choose a saved game and start"],
  quickHelp: [
    "每次启动会生成独立的对局记录，游戏配置可以反复使用。",
    "Each start creates a separate session. Saved configurations can be reused.",
  ],
  activeRuns: ["正在运行的对局", "Active sessions"],
  pastRuns: ["已结束与历史对局", "Finished and historical sessions"],
  noActive: ["当前没有正在运行的对局。", "No active sessions."],
  noHistory: ["还没有已结束的对局。", "No finished sessions yet."],
  loading: ["正在读取配置…", "Loading configuration…"],
  readonly: ["查看模式 · 点击编辑后才会修改配置", "Viewing · choose Edit to make changes"],
  gameFile: ["游戏配置文件", "Game configuration file"],
  boardFile: ["板子文件", "Board file"],
  roleAgents: ["按角色覆盖 Agent", "Role agent overrides"],
  seatAgents: ["按座位覆盖 Agent", "Seat agent overrides"],
  startTarget: ["启动目标", "Start target"],
  needsBoard: [
    "先新建并保存本地板子，再配置游戏。",
    "Create and save a local board before configuring a game.",
  ],
  deleteBlocked: [
    "此对局仍在活动中或无法确认进程已结束，暂不可删除。",
    "Deletion is unavailable while this session is active or process liveness is uncertain.",
  ],
  good: ["好人阵营", "Good team"],
  wolf: ["狼人阵营", "Wolf team"],
  third_party: ["第三方", "Third party"],
  individual: ["个人胜利", "Individual victory"],
  relationship: ["关系阵营", "Relationship team"],
  none: ["无胜者", "No winner"],
} as const;
export type ConfigUiText = keyof typeof phrases;
export function configUiText(locale: Locale, key: ConfigUiText): string {
  return phrases[key][locale === "en" ? 1 : 0];
}
export function winnerLabel(locale: Locale, winner: string): string {
  return winner in phrases ? configUiText(locale, winner as ConfigUiText) : winner;
}
