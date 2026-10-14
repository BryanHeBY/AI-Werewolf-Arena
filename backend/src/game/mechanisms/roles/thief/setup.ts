/**
 * 负责盗贼对共享初始身份 scope 和选择查询的本族接线；输入为原参与者与请求，输出保留原绑定。
 * 生命周期、库存及选择提交仍由共享所有者复验；请求别名统一走公共传播入口，不以查询或构造依赖授予许可。
 * 包装类构造时才读取 shared 类，并透传同一惰性依赖；请求工厂仍在共享窗口原执行点创建，异常原样传播。
 */
import type { World, ActionRequest, Phase, GameEvent } from "../../../../core/domain";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import type { ActionRequestFactoryConstructorPort } from "../../../../core/domain/actions";
import * as shared from "../initial_identity/setup";
export type ThiefScope = shared.InitialIdentityScope;
export const authorizedThiefScope = (
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
) => shared.authorizedInitialIdentityScope(world, actorId, day, phase, scope, "thief");
/** 先让共享请求绑定检查原体／context，再按kind返回原scope；查询不接受行动或续期权限。 */
export const thiefRequestScope = (world: World, r: ActionRequest) => {
  const s = shared.initialIdentityRequestScope(world, r);
  return s?.kind === "thief" ? s : undefined;
};
/** 共享owner核actor／kind／当前性后，旧盗贼视图只保required与同一cards数组；不另公开allowedSlots。 */
export function projectThiefChoices(world: World, actorId: number) {
  const s = shared.initialIdentityRequestChoices(world, actorId, "thief");
  return s ? { required: s.mustChoose, cards: s.cards } : undefined;
}
/** Catalog可在共享setup求值中导入；原new点才读取shared类，保参数／惰性依赖原引用，不在顶层捕获构造器。 */
export class ThiefSetupWindow {
  private readonly window: shared.InitialIdentitySetupWindow;
  constructor(
    world: World,
    gateway: ToolGateway,
    events: GameEvent[],
    construction: { readonly requestFactory: ActionRequestFactoryConstructorPort },
  ) {
    this.window = new shared.InitialIdentitySetupWindow(world, gateway, events, "thief", construction);
  }
  execute(...args: Parameters<shared.InitialIdentitySetupWindow["execute"]>): Promise<boolean> {
    return this.window.execute(...args);
  }
}
