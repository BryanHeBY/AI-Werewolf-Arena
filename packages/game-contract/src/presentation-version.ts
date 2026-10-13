/**
 * 负责录制文件声明的中立展示协议身份；供数据 reader、writer 与实际 renderer 共同引用。
 * 输出为唯一 id／version 结构，不包含文案、World 或渲染算法；输入无需运行状态。
 * 该声明不是任意 renderer 的支持保证，实际显示支持仍由 game-presentation 判断，严格复现仍核精确来源。
 */
export const GAME_PRESENTATION_CONTRACT = Object.freeze({
  id: "awa-game-presentation",
  version: "1",
} as const);
