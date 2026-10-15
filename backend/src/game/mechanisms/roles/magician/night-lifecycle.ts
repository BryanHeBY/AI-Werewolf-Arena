/**
 * 负责由魔术师配置决定的三族共享清理移交。输入为调用处求值的配置布尔值和延迟 World 读取；
 * 输出为同一只读移交查询及魔术师正常关闭／中止调用。本单位拥有 transferred，狼术师和诡术师共读该视图。
 * 移交只按原布尔值赋值，不是配置原引用、成功开夜回执或行动授权；不开独立 acquired／closed 守卫。
 * priority=80 的开夜仍归阶段。经理每次传入当次 World／day，未移交时清理才晚读 runtime.world；
 * frame 保留关闭／中止和重复调用的原政策；查询或 World 读取失败原样传播，不承诺幂等或补偿前缀。
 * 本单位不映射目标、消费号码、退还历史或推进阶段。
 */
import type { World } from "../../../../domain/world";
import { closeMagicianNight, abortMagicianNight } from "./night_frame";

/** 只保存运行对象供需要中止时读取 World；构造不执行 world getter，也不复制玩家或捕获生命。 */
export interface MagicianNightRuntime {
  readonly world: World;
}

/** 三族共用的运行查询，每次读取原移交布尔值；它不提供移交命令、World 或请求许可。 */
export interface MagicianNightCleanupOwnership {
  readonly isTransferred: () => boolean;
}

/** 冻结的是终结方法表；每次用调用方当次参数交原 frame，不缓存夜间或增加关闭去重。 */
export const magicianNightTerminal = Object.freeze({
  closeNormally(world: World, day: number): void {
    closeMagicianNight(world, day);
  },
  abort(world: World): void {
    abortMagicianNight(world);
  },
});

export class MagicianNightUnit {
  /** 经理接收同一单位；字段保存终结表的原函数值，World／day 由当次调用传入而非构造时捕获。 */
  readonly closeNormally = magicianNightTerminal.closeNormally;
  readonly abort = magicianNightTerminal.abort;

  // 初始清理由流水线保有；该冻结视图只冻结方法表，闭包仍读取本单位当前 transferred。
  private transferred = false;
  readonly cleanupOwnership: MagicianNightCleanupOwnership = Object.freeze({
    isTransferred: () => this.transferred,
  });

  constructor(private readonly runtime: MagicianNightRuntime) {}

  /** 保原赋值，包括再次传 false；只记录调用方配置判断，不复验原体或建立新的清理许可。 */
  transferToManager(configured: boolean): void {
    this.transferred = configured;
  }

  /** 先判移交值；未移交才查原中止函数并晚读 World，失败按原调用栈传播，不增加重试。 */
  abortIfOwned(): void {
    if (!this.transferred) abortMagicianNight(this.runtime.world);
  }
}
