/**
 * 负责请求对象上的交付检查、完成回调和期限别名传播。输入为机制已经绑定的原请求、
 * 当前性查询及不透明完成身份；输出为同步交付检查、一次性结算通知和有序别名绑定。
 * 元数据仅存运行时弱表，不进入模型上下文或归档。机制仍拥有权限、最早期限及单调撤权；
 * 本模块只调用已注册的规则，不以缺少交付检查或相同 JSON 字段判定请求已获授权。
 * 本模块仅写入交付弱表，不修改生命、库存或阶段；结算先删除待通知项再调用回调，异常不恢复。
 * 别名传播遇异常即停止，已完成的绑定不回滚。
 */
import type { ActionRequest } from "./actions";

type AliasPropagation = (original: ActionRequest, alias: ActionRequest) => void;
/** 原请求与别名各自登记元数据；completion 可指向同一机制窗口，不是可序列化许可。 */
interface DeliveryMetadata {
  /** 查询是否可交付；具体原体、生命版本与永久撤权由机制的查询实现负责。 */
  current?: () => boolean;
  /** 将一次 Provider 返回关联到后续领域提交或关闭，不把返回动作当成提交成功。 */
  completion?: object;
  /** 回调身份是键；同一回调重登记只更新顺序，具体别名绑定仍由该机制执行。 */
  aliases?: Map<AliasPropagation, number>;
}

/** 弱表按对象身份关联：复制请求字段不会复制当前性检查或完成身份。 */
const guards = new WeakMap<object, DeliveryMetadata>();
/** 同一完成身份同时最多保留一个待结算回调；原请求和合法别名可共享该身份。 */
const settlements = new WeakMap<object, (accepted: boolean) => void>();
/** 机制成功绑定后登记一次交付检查；保留此前已登记的别名路由。 */
export function bindRequestDeliveryGuard(
  request: object,
  isCurrent: () => boolean,
  completion?: object,
): void {
  const existing = guards.get(request);
  if (existing && "current" in existing)
    throw new Error("action_request_delivery_guard_already_bound");
  guards.set(request, { ...existing, current: isCurrent, completion });
}
/** 无登记时不额外拒绝；有检查时必须严格返回 true，不能用真值替代机制确认。 */
export function assertRequestDelivery(request: ActionRequest): void {
  const guard = guards.get(request);
  if (guard && "current" in guard && guard.current!() !== true)
    throw new Error("action_request_delivery_authority_revoked");
}
/** 登记事务请求的延后通知；无完成身份则返回 false，由调用方执行原有即时通知政策。 */
export function deferRequestDelivery(
  request: ActionRequest,
  settle: (accepted: boolean) => void,
): boolean {
  const completion = guards.get(request)?.completion;
  if (!completion) return false;
  if (settlements.has(completion)) throw new Error("action_request_delivery_already_pending");
  settlements.set(completion, settle);
  return true;
}
export function settleRequestDelivery(completion: object, accepted: boolean): void {
  const settle = settlements.get(completion);
  if (!settle) return;
  // 先消费再通知：重入或回调抛错都不会再次发送同一成功／拒绝通知，也不回滚领域前缀。
  settlements.delete(completion);
  settle(accepted);
}

/** 仅登记已成功绑定的路由；登记自身不会执行回调、校验权限或设置期限。 */
export function registerRequestAliasPropagation(
  request: object,
  order: number,
  inherit: AliasPropagation,
): void {
  let metadata = guards.get(request);
  if (!metadata) {
    metadata = {};
    guards.set(request, metadata);
  }
  (metadata.aliases ??= new Map()).set(inherit, order);
}

/** 机制自行接纳并绑定别名；按顺序调用不等于授予新行动权限。 */
export function inheritRequestAlias(original: ActionRequest, alias: ActionRequest): void {
  const routes = guards.get(original)?.aliases;
  if (!routes) return;
  // 先取路由快照再稳定排序；回调期间增删路由不改变本次名单，抛错时后续路由不执行。
  for (const [inherit] of [...routes].sort((left, right) => left[1] - right[1]))
    inherit(original, alias);
}

/** 调用方先计算最早期限；这里保留原字段展开顺序，再由已登记机制绑定新对象。 */
export function deriveBoundedRequest(original: ActionRequest, deadlineAtMs: number): ActionRequest {
  const alias = { ...original, deadlineAtMs };
  inheritRequestAlias(original, alias);
  return alias;
}
