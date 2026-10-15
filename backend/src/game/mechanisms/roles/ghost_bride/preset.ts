/**
 * 负责校验鬼新娘板子的既有有限配置，供解析、bootstrap、authority 安装及 Tape 调用。
 * 输入为 BoardConfig；输出为原类型收窄或 preset 错误。可支持组合由 ruleset 所有者定义，
 * 本断言不安装婚礼、分配资源或授予 live 狼刀权限。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { isGhostBridePreset } from "../../../../rulesets";
import { GHOST_BRIDE_POLICY } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import type {} from "../../../../domain";
export type GhostBrideBoard = ReadonlyBoardConfig & {
  readonly ghostBride: { readonly policy: typeof GHOST_BRIDE_POLICY };
};
/** 共享纯校验供公开解析、bootstrap、authority 安装及 Tape 使用。 */
export function assertGhostBridePreset(
  config: ReadonlyBoardConfig,
): asserts config is GhostBrideBoard {
  if (!isGhostBridePreset(config)) throw new Error("ghost_bride_preset_invalid");
}
