/**
 * 负责当前 renderer 对中立展示协议声明的实际支持判断；输入为归档声明，输出为当前 renderer 是否支持。
 * 中立协议常量由 game-contract 单独维护；本 owner 判断内置标签／文案格式支持，不解释规则或修改用户昵称、发言、遗言、模型原文。
 * 历史未声明档案继续原 reader 政策；版本相同不能证明源码、依赖或严格复现兼容。
 */
import { GAME_PRESENTATION_CONTRACT } from "@ai-werewolf-arena/game-contract";
export { GAME_PRESENTATION_CONTRACT } from "@ai-werewolf-arena/game-contract";
export function supportsGamePresentation(identity: {
  readonly id: string;
  readonly version: string;
}): boolean {
  return (
    identity.id === GAME_PRESENTATION_CONTRACT.id &&
    identity.version === GAME_PRESENTATION_CONTRACT.version
  );
}
