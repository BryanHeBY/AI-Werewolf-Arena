/**
 * 负责寻香魅影／觉醒预言家每次夜间获取、开夜发布与终止关闭。输入为惰性委托的原 World／events、
 * 实际夜数／当前性及知识抽签工厂；保持快照→开 authority／抽签→新快照→acquired→事实和录制的原顺序。
 * 仅已获取且未正常关闭的单元尝试 abort；开夜或发布失败保留此前前缀，不重抽、退款或延长已付绑定。
 * 原阵容、选择及关系写权仍由 authority 持有。
 */
import type { World } from "../../domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { RandomDraws } from "../../domain/random";
import { Role } from "@ai-werewolf-arena/game-contract";
import { beginFragrantNight, closeFragrantNight, fragrantAuthoritySnapshot } from "./authority";
import { FRAGRANT_PAIR_POLICY } from "./state";

export interface FragrantNightRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  drawKnowledge(): RandomDraws;
  recordOpening(day: number, notice: ReturnType<typeof beginFragrantNight>): void;
}

export class FragrantNightUnit {
  private acquired = false;
  private closed = false;
  constructor(
    private readonly runtime: FragrantNightRuntime,
    private readonly day: number,
  ) {}
  open(isCurrent: () => boolean): void {
    const ctx = this.runtime,
      day = this.day;
    const before = fragrantAuthoritySnapshot(ctx.world),
      notice = beginFragrantNight(ctx.world, day, ctx.drawKnowledge(), isCurrent),
      after = fragrantAuthoritySnapshot(ctx.world);
    // authority 已成功开夜后才取得清理责任；以下任一 push／录制失败仍保此前开夜与抽签前缀。
    this.acquired = true;
    ctx.events.push({
      timestamp: Date.now(),
      type: "fragrant_night_opened",
      payload: {
        policy: FRAGRANT_PAIR_POLICY,
        actorId: after.phantomId,
        day,
        knowledgeDrawCount: day === 1 ? 1 : 0,
      },
      audience: Object.freeze([]),
    });
    for (const old of before.fragrant.bindings.filter((b) => b.status.kind === "pending")) {
      if (after.fragrant.bindings.find((b) => b.id === old.id)?.status.kind === "expired")
        ctx.events.push({
          timestamp: Date.now(),
          type: "fragrant_binding_expired",
          payload: {
            policy: FRAGRANT_PAIR_POLICY,
            actorId: ctx.world.getEntityIdsByRole(Role.FragrantPhantom)[0]!,
            day,
            bindingId: old.id,
            createdNight: old.createdNight,
            pairIds: old.pairIds,
          },
          audience: Object.freeze([]),
        });
    }
    if (notice)
      ctx.events.push({
        timestamp: Date.now(),
        type: "fragrant_night_notified",
        payload: { policy: FRAGRANT_PAIR_POLICY, ...notice },
        audience: Object.freeze([notice.actorId]),
      });
    ctx.recordOpening(day, notice);
  }
  closeNormally(): void {
    closeFragrantNight(this.runtime.world, this.day, "normal");
    this.closed = true;
  }
  abortIfOwned(): void {
    if (this.acquired && !this.closed) closeFragrantNight(this.runtime.world, this.day, "aborted");
  }
}
