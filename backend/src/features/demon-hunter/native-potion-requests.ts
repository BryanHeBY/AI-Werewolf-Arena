/**
 * 负责原生猎魔板女巫请求绑定、共享最早截止时间，以及药印记可信读取的唯一实现。
 * 输入保留 World、turn／context、scope 和原库存引用；输出为请求当前性或只读可信查询，不授予用药权限。
 * 请求别名只在原生 scope／躯体和正文检查后绑定；原正文／领域及期限一经观察失效，共同 turn 永久撤权。
 * 别名自身失配仅永久退休该别名，未知对象／错误 World 不毒化原请求；完成仍归原 scope。
 * 五个印记方法在本模块原初始化点捕获一次；原库存／原型、实例遮蔽和已退休展示名称按原次序拒绝。
 * 捕获表、请求 WeakMap 和 guard 保持同一所有者；只读查询不冻结实例、不复制库存或写来源／付款。
 */
import { registerRequestAliasPropagation } from "../../domain/request-delivery";
import {
  Phase,
  PotionType,
  bindRequestDeliveryGuard,
  type ActionRequest,
  type ToolCall,
  type World,
} from "../../domain";
import { COMPONENT, StatusMark } from "../../domain";
import {
  StatusMarksComponent,
  statusMarkSnapshot,
} from "../../domain/components/status-marks";
import { demonSnapshot, exactDemonData, ownDemonData } from "./state-slot";
/** 同一原请求的运行绑定；别名共享可提前的期限，World／上下文和current闭包不是序列化凭证。 */
interface Turn {
  world: World;
  original: object;
  originalContext: object;
  originalDeadline: unknown;
  targetCurrent: (targetId: number) => boolean;
  scope: object;
  current: () => boolean;
  json: string;
  deadline: number | null;
  revoked: boolean;
}
/** 每个真实别名保留原上下文与截止字段，记录本身不深复制请求或扩大资源许可。 */
interface Request {
  turn: Turn;
  context: object;
  deadline: unknown;
  retired: boolean;
}
const requests = new WeakMap<object, Request>();
function body(request: object): string | null {
  try {
    const data = demonSnapshot(request, new Set(), 0, 16384) as Record<string, unknown>;
    return JSON.stringify(
      Object.fromEntries(Object.entries(data).filter(([key]) => key !== "deadlineAtMs")),
    );
  } catch {
    return null;
  }
}
function current(request: object, r: Request): boolean {
  const turn = r.turn;
  if (turn.revoked || r.retired) return false;
  let shared = true;
  try {
    // 保原领域→原正文／身份→当前请求正文的读取次序；共同证据坏后不能靠恢复字段重开。
    if (!(
      turn.current() &&
      body(turn.original) === turn.json &&
      ownDemonData(turn.original, "context") === turn.originalContext &&
      ownDemonData(turn.original, "deadlineAtMs") === turn.originalDeadline
    )) {
      turn.revoked = true;
      return false;
    }
    shared = false;
    if (!(
      body(request) === turn.json &&
      ownDemonData(request, "context") === r.context &&
      ownDemonData(request, "deadlineAtMs") === r.deadline
    )) {
      if (request === turn.original) turn.revoked = true;
      else r.retired = true;
      return false;
    }
    shared = true;
    if (turn.deadline === null || turn.deadline > Date.now()) return true;
    turn.revoked = true;
    return false;
  } catch (error) {
    if (shared || request === turn.original) turn.revoked = true;
    else r.retired = true;
    throw error;
  }
}
function bindDemonNativeRequest(
  world: World,
  request: ActionRequest,
  scope: object,
  isCurrent: () => boolean,
  targetCurrent: (targetId: number) => boolean,
  spec: readonly [string, string, string],
): void {
  const json = body(request),
    context = ownDemonData(request, "context"),
    deadline = ownDemonData(request, "deadlineAtMs");
  if (
    !json ||
    !context ||
    typeof context !== "object" ||
    requests.has(request) ||
    request.phase !== Phase.Night ||
    request.context.stage !== spec[0] ||
    request.allowedTools.length !== 1 ||
    request.allowedTools[0] !== spec[1] ||
    request.context.ability_id !== spec[2] ||
    (deadline !== undefined &&
      (typeof deadline !== "number" || !Number.isFinite(deadline) || deadline <= Date.now()))
  )
    throw new Error("demon_hunter_native_witch_request_invalid");
  const turn: Turn = {
      world,
      original: request,
      originalContext: context,
      originalDeadline: deadline,
      targetCurrent,
      scope,
      current: isCurrent,
      json,
      deadline: deadline === undefined ? null : (deadline as number),
      revoked: false,
    },
    r = { turn, context, deadline, retired: false };
  bindRequestDeliveryGuard(request, () => current(request, r), scope);
  requests.set(request, r);
  registerRequestAliasPropagation(request, 70, inheritDemonWitchDeadlineRequest);
}
export function bindDemonWitchRequest(
  world: World,
  request: ActionRequest,
  scope: object,
  isCurrent: () => boolean,
  targetCurrent: (id: number) => boolean,
): void {
  bindDemonNativeRequest(world, request, scope, isCurrent, targetCurrent, [
    "witch",
    "use_potion",
    "native:potion",
  ]);
}
export function bindDemonNativeNightRequest(
  world: World,
  request: ActionRequest,
  scope: object,
  isCurrent: () => boolean,
  targetCurrent: (id: number) => boolean,
  kind: "seer_check" | "guard",
): void {
  bindDemonNativeRequest(
    world,
    request,
    scope,
    isCurrent,
    targetCurrent,
    kind === "guard"
      ? ["guard", "guard", "native:guard"]
      : ["seer", "check_identity", "native:seer_check"],
  );
}
export function readDemonNativeNightTool(
  value: unknown,
): Extract<ToolCall, { name: "check_identity" | "guard" }> | null {
  try {
    const call = demonSnapshot(value);
    if (
      !exactDemonData(call, ["name", "args"]) ||
      !exactDemonData(call.args, call.name === "guard" ? ["target_id", "abstain"] : ["target_id"])
    )
      return null;
    const target = call.args.target_id,
      positive = Number.isSafeInteger(target) && (target as number) > 0;
    if (call.name === "check_identity")
      return positive ? (call as unknown as Extract<ToolCall, { name: "check_identity" }>) : null;
    if (
      call.name !== "guard" ||
      !(
        (target === null && call.args.abstain === true) ||
        (positive && call.args.abstain === false)
      )
    )
      return null;
    return call as unknown as Extract<ToolCall, { name: "guard" }>;
  } catch {
    return null;
  }
}
export function demonWitchRequestCurrent(world: World, request: object): boolean {
  const r = requests.get(request);
  return !!r && r.turn.world === world && current(request, r);
}
/** 通过原绑定与正文／同一上下文检查的别名共享最早截止时间；在原位置记录新的更早期限。 */
export function inheritDemonWitchDeadlineRequest(
  request: ActionRequest,
  clone: ActionRequest,
): void {
  const r = requests.get(request);
  if (
    !r ||
    !current(request, r) ||
    body(clone) !== r.turn.json ||
    ownDemonData(clone, "context") !== r.context ||
    requests.has(clone)
  )
    return;
  const deadline = ownDemonData(clone, "deadlineAtMs");
  if (
    typeof deadline !== "number" ||
    !Number.isFinite(deadline) ||
    deadline <= Date.now() ||
    (r.turn.deadline !== null && deadline > r.turn.deadline)
  )
    return;
  const copied: Request = { turn: r.turn, context: r.context, deadline, retired: false };
  bindRequestDeliveryGuard(clone, () => current(clone, copied), r.turn.scope);
  r.turn.deadline = deadline;
  requests.set(clone, copied);
  registerRequestAliasPropagation(clone, 70, inheritDemonWitchDeadlineRequest);
}
export function readDemonPotionTool(
  value: unknown,
): Extract<ToolCall, { name: "use_potion" }> | null {
  try {
    const call = demonSnapshot(value);
    if (
      !exactDemonData(call, ["name", "args"]) ||
      call.name !== "use_potion" ||
      !exactDemonData(call.args, ["target_id", "potion_type"]) ||
      !Number.isSafeInteger(call.args.target_id) ||
      (call.args.target_id as number) < 1 ||
      ![PotionType.Heal, PotionType.Poison, PotionType.None].includes(
        call.args.potion_type as PotionType,
      )
    )
      return null;
    return call as unknown as Extract<ToolCall, { name: "use_potion" }>;
  } catch {
    return null;
  }
}

// 五方法只在原请求 WeakMap 建立之后的模块初始化点捕获；按既定顺序取 descriptor.value，不执行方法。
// 表是唯一闭包基准，不在每次查询重捕获，也不因公开端口而提前到另一个模块初始化。
const trustedMarkMethods = Object.fromEntries(
  ["has", "add", "remove", "clear", "values"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(StatusMarksComponent.prototype, key)!.value,
  ]),
);
/** 原库存／方法身份的只读检查；无组件仍按原规则返回 true，不表示有药、合法目标或行动已提交。 */
export function demonWitchMarksSafe(world: World, targetId: number): boolean {
  const marks = world.getComponent(targetId, COMPONENT.StatusMarks);
  if (!marks) return true;
  // 先核原工厂私有库存，再查精确原型；不用实例 has 方法读印记，也不执行遮蔽方法。
  if (
    !statusMarkSnapshot(marks, StatusMark.PoisonMark) ||
    Object.getPrototypeOf(marks) !== StatusMarksComponent.prototype
  )
    return false;
  // 原顺序逐个查实例 descriptor 和原型方法身份，首个失败即停止；随后才查实例／原型旧展示名称。
  // 展示属性退出领域，不把旧名称的消失变成修改方法身份的绕过入口。
  return Object.entries(trustedMarkMethods).every(
    ([key, method]) =>
      !Object.getOwnPropertyDescriptor(marks, key) &&
      Object.getOwnPropertyDescriptor(StatusMarksComponent.prototype, key)?.value === method,
  ) &&
    !Object.getOwnPropertyDescriptor(marks, "renderPrompt") &&
    !Object.getOwnPropertyDescriptor(StatusMarksComponent.prototype, "renderPrompt");
}
export function demonWitchRequestTargetCurrent(
  world: World,
  request: object,
  targetId: number,
): boolean {
  const r = requests.get(request);
  return (
    !!r &&
    r.turn.world === world &&
    current(request, r) &&
    r.turn.targetCurrent(targetId) &&
    demonWitchMarksSafe(world, targetId)
  );
}
