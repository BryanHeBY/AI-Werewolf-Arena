/**
 * 负责内置展示格式的显式身份与当前支持范围；输入为归档声明，输出为当前 renderer 是否支持。
 * 本 owner 只声明内置标签／文案格式，不解释规则或修改用户昵称、发言、遗言、模型原文。
 * 历史未声明档案继续原 reader 政策；版本相同不能证明源码、依赖或严格复现兼容。
 */
export const GAME_PRESENTATION_CONTRACT = Object.freeze({
  id: "awa-game-presentation",
  version: "1",
} as const);
export function supportsGamePresentation(identity: {
  readonly id: string;
  readonly version: string;
}): boolean {
  return (
    identity.id === GAME_PRESENTATION_CONTRACT.id &&
    identity.version === GAME_PRESENTATION_CONTRACT.version
  );
}
