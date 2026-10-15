/**
 * 负责千面人对共享初始身份 scope 和选择查询的本族接线；输入为原参与者与请求，输出保留原绑定。
 * 生命周期、库存及选择提交仍由共享所有者复验；请求别名统一走公共传播入口，不以查询或构造依赖授予许可。
 * 包装类构造时才读取 shared 类，并透传同一惰性依赖；请求工厂仍在共享窗口原执行点创建，异常原样传播。
 */
import type { World, ActionRequest, Phase, GameEvent } from "../../../../domain";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import type { ActionRequestFactoryConstructorPort } from "../../../../domain/actions";
// 公共选择 API 保同一原绑定；不在模块顶层捕获窗口类，原构造器仍在 new 表达式处晚读。
import * as shared from "../initial_identity/ports";
export type ShapeshifterScope = shared.InitialIdentityScope;
export const authorizedShapeshifterScope = (
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
) => shared.authorizedInitialIdentityScope(world, actorId, day, phase, scope, "shapeshifter");
/** 先让共享请求绑定检查原体／context，再按kind返回原scope；查询不接受行动或续期权限。 */
export const shapeshifterRequestScope = (world: World, r: ActionRequest) => {
  const s = shared.initialIdentityRequestScope(world, r);
  return s?.kind === "shapeshifter" ? s : undefined;
};
/** 返回原共享选择对象，保mustChoose／allowedSlots／cards形状；不照盗贼裁剪或重新推导必选政策。 */
export function projectShapeshifterChoices(world: World, actorId: number) {
  const s = shared.initialIdentityRequestChoices(world, actorId, "shapeshifter");
  return s;
}
/** Catalog可在共享setup求值中导入；原new点才读取shared类，保参数／惰性依赖原引用，不在顶层捕获构造器。 */
export class ShapeshifterSetupWindow {
  private readonly window: shared.InitialIdentitySetupWindow;
  constructor(
    world: World,
    gateway: ToolGateway,
    events: GameEvent[],
    construction: { readonly requestFactory: ActionRequestFactoryConstructorPort },
  ) {
    this.window = new shared.InitialIdentitySetupWindow(world, gateway, events, "shapeshifter", construction);
  }
  execute(...args: Parameters<shared.InitialIdentitySetupWindow["execute"]>): Promise<boolean> {
    return this.window.execute(...args);
  }
}
