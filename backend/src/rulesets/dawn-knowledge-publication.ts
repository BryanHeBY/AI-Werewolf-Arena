/**
 * 负责熊夜前捕获与黎明公开事实／动物板知识的完整同步发布组合。
 * 输入为晚读 World、配置与原事件数组、同一 nullable frame 和当前性回调；输出为原 frame 或原事实／知识前缀。
 * 捕获留在首夜准备与猎魔原体检查之后、夜流水线之前；发布留在完整死亡波与原清理／当前性检查之后。
 * 无 frame 仍先取事件起点；可选发布只短路其参数，动物配置仍按原顺序推进熊知识与狼美人通知。
 * 熊的采样、原体、历史、两政策和发布租约归 frame；知识唯一归 Animal facts，阶段、await 与判胜仍归经理。
 * 本模块不存镜像、标死、退款或授予行动许可；后项失败保已经发表的熊事实和已有知识前缀。
 * 规则见 docs/rules/awa-bear-v1.md 和 docs/rules/awa-animal-dream-twelve-v1.md。
 */
import type { BearSignalPolicy, ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { GameEvent } from "../domain/events";
import type { World } from "../domain/world";
import { BearNightFrame } from "../features/bear/ports";
import { noteAnimalBearPublication, appendAnimalBeautyNotice } from "../features/animal-dream/ports";

/** 每次在原表达式位置取真实引用；方法类型不是许可，不提前缓存 World、数组或配置。 */
export interface DawnKnowledgeRuntime {
  world(): World;
  events(): GameEvent[];
  signalPolicy(): BearSignalPolicy | undefined;
  animalDream(): ReadonlyBoardConfig["animalDream"];
}

/** 原 static callee 先于 World／policy 参数；undefined catalog 保留原默认初始化时点。 */
export function captureDawnKnowledge(
  runtime: Pick<DawnKnowledgeRuntime, "world" | "signalPolicy">,
  day: number,
): BearNightFrame | null {
  return BearNightFrame.capture(
    runtime.world(),
    day,
    undefined,
    runtime.signalPolicy(),
  );
}

/**
 * 同一 frame 保原 publish receiver，null 不读其 World／events 参数；Animal gate 与 frame 成功无关。
 * 先发表熊事件再扫描该起点之后的事实，随后才发狼美人通知；失败原样抛出，不捕获或回滚前项。
 */
export function publishDawnKnowledge(
  bearFrame: BearNightFrame | null,
  runtime: Pick<DawnKnowledgeRuntime, "world" | "events" | "animalDream">,
  day: number,
  isCurrent: () => boolean,
): void {
  const bearStart = runtime.events().length;
  bearFrame?.publish(runtime.world(), runtime.events(), isCurrent);
  if (runtime.animalDream()) {
    noteAnimalBearPublication(runtime.world(), runtime.events(), bearStart);
    appendAnimalBeautyNotice(runtime.world(), runtime.events(), day);
  }
}
