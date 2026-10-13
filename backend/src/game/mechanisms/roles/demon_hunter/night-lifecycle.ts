/**
 * 负责恶魔猎手本次夜间的取得与晚交接；输入为延迟 World 查询、日期和有效性回调，
 * 输出保持原生开夜及原 pipeline 条件关闭。成功 begin 后才 acquired，失败 begin 不新增 close。
 * 经理的原终止入口保持无条件调用；不修改封存库存、原生生命、已付效果或阶段。
 * 规则依据：docs/expansion/rules/awa-netease-demon-hunter-v1.md。
 */
import type { World } from "../../../../core/domain/world";
import { beginDemonHunterNight, closeDemonHunterNight } from "./authority";

export interface DemonNightRuntime {
  readonly world: World;
}

export const demonNightTerminal = Object.freeze({
  close(world: World): void {
    closeDemonHunterNight(world);
  },
});

export class DemonNightUnit {
  /** 经理接收同一所有权实例，原终止函数仍使用调用时的参数。 */
  readonly close = demonNightTerminal.close;

  private acquired = false;
  private transferred = false;

  constructor(private readonly runtime: DemonNightRuntime) {}

  open(day: number, isCurrent: () => boolean): void {
    beginDemonHunterNight(this.runtime.world, day, isCurrent);
    this.acquired = true;
  }

  transferToManager(owned: boolean): void {
    this.transferred = owned;
  }

  abortIfOwned(): void {
    if (this.acquired && !this.transferred) closeDemonHunterNight(this.runtime.world);
  }
}
