/**
 * 负责猎魔人既有 typed 开局断言。输入为板子配置；输出为原精化类型或原 preset 拒绝。
 * rulesets 拥有支持结论与 Node 数据入口，本断言不创建状态、安装 roster 或授予猎杀许可。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type {} from "../../../../core";
import { isDemonHunterNodePreset as isDemonHunterPreset } from "../../../../rulesets";
export { isDemonHunterNodePreset as isDemonHunterPreset } from "../../../../rulesets";
import { DEMON_HUNTER_POLICY } from "./state-slot";
export type DemonHunterBoard = ReadonlyBoardConfig & {
  readonly demonHunter: { readonly policy: typeof DEMON_HUNTER_POLICY };
};
export function assertDemonHunterPreset(
  input: ReadonlyBoardConfig,
): asserts input is DemonHunterBoard {
  if (!isDemonHunterPreset(input)) throw new Error("demon_hunter_preset_invalid");
}
