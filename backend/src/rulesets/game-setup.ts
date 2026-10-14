/**
 * 负责首夜开局设置的确定序列：盗贼／千面人、野孩子、孤独少女、鬼魂新娘。
 * 输入为现场读取 World、网关、事件和板子的查询，以及原 provider、日期和唯一当前性回调；
 * 输出为全部准备通过，或在首个未准备完成／失效步骤之后立即返回 false。异常原样向上抛出。
 * 组合只装配原窗口并串行交还原执行 Promise；选择、库存、接受权限和 finally 关闭仍由各机制拥有。
 * 不缓存 World 或提前读取构造参数；成功末尾没有额外当前性查询，也不推进阶段或生成快照。
 */
import type { GameEvent, ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider } from "../core/domain/actions";
import type { World } from "../core/domain/world";
import type { ToolGateway } from "../game/gateway/tool_gateway";
import {
  InitialIdentitySetupWindow,
  initialIdentitySetupReady,
  initialIdentityKind,
} from "../game/mechanisms/roles/initial_identity/ports";
import { wildChildReady } from "../game/mechanisms/roles/wild_child/ports";
import { WildChildSetupWindow } from "../game/mechanisms/roles/wild_child/setup-ports";
import { LonelyGirlSetupWindow, lonelyGirlReady } from "../game/mechanisms/roles/lonely_girl/ports";
import { GhostBrideSetupWindow, ghostBrideReady } from "../game/mechanisms/roles/ghost_bride/ports";

/** 查询只读取原调用点；事件数组与板子引用交给窗口，不产生新授权或状态镜像。 */
export interface GameSetupRuntime {
  world(): World;
  toolGateway(): ToolGateway;
  events(): GameEvent[];
  config(): ReadonlyBoardConfig;
}

export function* prepareGameSetup(
  runtime: GameSetupRuntime,
  actionProvider: ActionProvider,
  nightDay: number,
  nightIsCurrent: () => boolean,
): Generator<Promise<boolean>, boolean, boolean> {
  // 没有待设置窗口时同步结束；只在原 execute 的 Promise 处暂停，不增加 helper 完成等待。
  // 每个 new 先查找原类，再按原顺序读取参数；execute 仍使用该实例作为 receiver。
  if (!initialIdentitySetupReady(runtime.world())) {
    const ready = yield new InitialIdentitySetupWindow(
      runtime.world(),
      runtime.toolGateway(),
      runtime.events(),
      initialIdentityKind(runtime.world())!,
    ).execute(runtime.config(), actionProvider, nightDay, nightIsCurrent);
    // false 先短路，不再查询当前性或推进其它设置；窗口的失败关闭仍由自己的 finally 完成。
    if (!ready || !nightIsCurrent()) return false;
  }
  if (!wildChildReady(runtime.world())) {
    const ready = yield new WildChildSetupWindow(
      runtime.world(),
      runtime.toolGateway(),
      runtime.events(),
    ).execute(runtime.config(), actionProvider, nightDay, nightIsCurrent);
    if (!ready || !nightIsCurrent()) return false;
  }
  if (!lonelyGirlReady(runtime.world())) {
    const ready = yield new LonelyGirlSetupWindow(
      runtime.world(),
      runtime.toolGateway(),
      runtime.events(),
    ).execute(runtime.config(), actionProvider, nightDay, nightIsCurrent);
    if (!ready || !nightIsCurrent()) return false;
  }
  if (!ghostBrideReady(runtime.world())) {
    const ready = yield new GhostBrideSetupWindow(
      runtime.world(),
      runtime.toolGateway(),
      runtime.events(),
    ).execute(runtime.config(), actionProvider, nightDay, nightIsCurrent);
    if (!ready || !nightIsCurrent()) return false;
  }
  return true;
}
