/**
 * 负责游戏运行选项的公共缺省值；CLI 解析器与配置界面共同消费，不读取文件或环境。
 * 运行缺省保留既有行为；工作台新建推荐值会显式写入草稿，不能改变旧文件省略字段的含义。
 */
export const GAME_CONFIG_DEFAULTS = Object.freeze({
  board: "six_player_mvp",
  locale: "zh-CN" as const,
  maxDays: 10,
  maxRuntimeMs: 30_000,
  llmTimeoutMs: 30_000,
  trace: false,
  printAllEvents: false,
  printChat: false,
  streamEvents: true,
  color: true,
  printLlmIo: false,
  printThinking: false,
  printPrivateEvents: true,
});

/** 新建完整对局采用较宽松的保护限制，给订阅 Agent 的初始化、思考和工具提交保留时间。 */
export const NEW_GAME_CONFIG_DEFAULTS = Object.freeze({
  maxDays: 10,
  maxRuntimeMs: 7_200_000,
  llmTimeoutMs: 180_000,
  streamEvents: true,
  printThinking: true,
  printPrivateEvents: false,
});
