/**
 * 负责盗贼对共享初始身份 scope、别名和选择查询的本族接线；输入为原参与者与请求，输出保留原绑定。
 * 只在对应 stage 传播别名；生命周期、库存及选择提交仍由共享所有者复验，不以查询或构造依赖授予许可。
 * 包装类构造时才读取 shared 类，并透传同一惰性依赖；请求工厂仍在共享窗口原执行点创建，异常原样传播。
 */
import type { World, ActionRequest, Phase, GameEvent } from "../../../../core/domain";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import type { ActionRequestFactoryConstructorPort } from "../../../../core/domain/actions";
import * as shared from "../initial_identity/setup";
export type ThiefScope = shared.InitialIdentityScope;
export const sameThiefScope = (s: ThiefScope) =>
  s.kind === "thief" && shared.sameInitialIdentityScope(s);
export const authorizedThiefScope = (
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
) => shared.authorizedInitialIdentityScope(world, actorId, day, phase, scope, "thief");
export const bindThiefRequest = (world: World, r: ActionRequest) => {
  if (r.context.stage === "thief") shared.bindInitialIdentityRequest(world, r);
};
export const thiefRequestScope = (world: World, r: ActionRequest) => {
  const s = shared.initialIdentityRequestScope(world, r);
  return s?.kind === "thief" ? s : undefined;
};
export const inheritThiefDeadlineRequest = (a: ActionRequest, b: ActionRequest) => {
  if (a.context.stage === "thief") shared.inheritInitialIdentityDeadlineRequest(a, b);
};
export function projectThiefChoices(world: World, actorId: number) {
  const s = shared.initialIdentityRequestChoices(world, actorId, "thief");
  return s ? { required: s.mustChoose, cards: s.cards } : undefined;
}
/** Catalog 可在共享 setup 尚在求值时导入此模块；因此只在实例构造时读取共享类，不在顶层捕获。 */
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
