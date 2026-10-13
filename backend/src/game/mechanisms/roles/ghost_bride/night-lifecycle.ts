/**
 * 负责鬼新娘本次夜间开夜事实与晚交接；输入为延迟 World／事件、日期和原 setup ownership，
 * 输出保持原刀源捕获与关闭。owned 的捕获失败仍须关闭，不增加取得成功的前置守卫。
 * 经理原两个终止调用保持；已付婚约、setup、源验证、死亡规则及阶段推进由各原 owner 负责。
 * 规则依据：docs/expansion/rules/awa-melbourne-ghost-bride-v1.md。
 */
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../../core/domain/world";
import { captureWeddingKnife, closeWeddingNight } from "./authority";

export interface WeddingNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
}

export const weddingNightTerminal = Object.freeze({
  close(world: World): void {
    closeWeddingNight(world);
  },
});

export class WeddingNightUnit {
  /** 经理接收同一所有权实例，原终止函数仍使用调用时的参数。 */
  readonly close = weddingNightTerminal.close;

  private transferred = false;

  constructor(
    private readonly runtime: WeddingNightRuntime,
    private readonly owned: boolean,
  ) {}

  open(day: number, isCurrent: () => boolean): void {
    const capture = captureWeddingKnife(this.runtime.world, day, isCurrent);
    this.runtime.events.push({
      timestamp: Date.now(),
      type: "ghost_bride_knife_captured",
      payload: { ...capture, actorIds: [...capture.actorIds] },
      audience: Object.freeze([]),
    });
  }

  transferToManager(owned: boolean): void {
    this.transferred = owned;
  }

  abortIfOwned(): void {
    if (this.owned && !this.transferred) closeWeddingNight(this.runtime.world);
  }
}
