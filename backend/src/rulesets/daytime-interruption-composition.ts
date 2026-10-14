/**
 * 负责白天自爆、骑士决斗和辩论窗口的有序装配及辩论重入政策。输入是调用方现场读取
 * World、角色注册、网关和事件的端口；输出为三个原窗口实例的窄视图与同步准入检查。
 * 构造顺序固定为自爆、决斗、辩论，首个读取／构造错误停止后续步骤，不回滚前缀。
 * 机制仍拥有许可、状态、付款与关闭；组合不缓存演员、改变配置、推进阶段或判断胜负。
 */
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../core/domain/world";
import type { RoleRegistry } from "../core/domain/registries/role_registry";
import type { ToolGateway } from "../game/gateway/tool_gateway";
import type { DaytimeInterruptionComposition } from "../game/engine/daytime-interruption-contracts";
import { SelfDestructWindow } from "./self-destruct-window";
import { KnightDuelWindow } from "../game/engine/knight_duel_window";
import { DebaterWindow } from "../game/mechanisms/roles/debater/window";
import { hasActiveDebate } from "../game/mechanisms/roles/debater/authority";

/** 延迟读取保留每次原调用点；窗口捕获构造时引用，重入检查则读取执行时的 World。 */
export interface DaytimeInterruptionRuntime {
  world(): World;
  roleRegistry(): RoleRegistry;
  toolGateway(): ToolGateway;
  events(): GameEvent[];
}

export function createDaytimeInterruptionComposition(
  runtime: DaytimeInterruptionRuntime,
): DaytimeInterruptionComposition {
  // 每个 new 先查找原构造器，再依原顺序读取参数；不要先收齐一次 World／网关快照。
  const selfDestruct = new SelfDestructWindow(
    runtime.world(),
    runtime.roleRegistry(),
    runtime.toolGateway(),
  );
  const duel = new KnightDuelWindow(runtime.world(), runtime.toolGateway());
  const debate = new DebaterWindow(runtime.world(), runtime.toolGateway(), runtime.events());

  return {
    selfDestruct,
    duel,
    debate,
    assertEntry() {
      // 即使调用方已失效，仍先拒绝现场已开启辩论；没有新预约、撤销或已付效果回滚。
      if (hasActiveDebate(runtime.world())) throw new Error("debate_window_reentry");
    },
  };
}
