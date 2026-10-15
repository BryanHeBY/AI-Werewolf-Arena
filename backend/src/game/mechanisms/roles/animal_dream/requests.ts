/**
 * 负责动物梦境选择 turn、请求信封与交付完成通知。输入为原 World／请求及河豚单元 token；
 * 输出为本地 scope、工具读取结果和领域提交回执。不变量：领域 choice 与信封必须同时 current 才可提交，
 * choice.commit 返回之后才关 turn 并通知 true；关闭按原序撤信封、关 choice、通知 false。
 * 路由 metadata 不授予行动权；异常保留此前已写前缀，不提供事务回滚。
 */
import { registerRequestAliasPropagation } from "../../../../domain/request-delivery";
import { z } from "zod";
import type { World } from "../../../../domain/world";
import { Phase } from "../../../../domain/identity";
import type { ActionRequest, ToolCall } from "../../../../domain/actions";
import { snapshotPlainData } from "../../../../domain/plain-data";
import {
  bindRequestDeliveryGuard,
  settleRequestDelivery,
} from "../../../../domain/request-delivery";
import {
  captureAnimalRequestEnvelope,
  animalRequestEnvelopeHeader,
  animalRequestEnvelopeCurrent,
  inheritAnimalRequestEnvelope,
  revokeAnimalRequestEnvelope,
} from "./request_envelope";
import {
  createAnimalFoxRequest,
  openAnimalFoxChoice,
  createAnimalPufferRequest,
  openAnimalPufferChoice,
} from "./authority";
import { animalOriginalPlayer } from "./roster";
type Call = Extract<ToolCall, { name: "fox_distract" | "puffer_retaliate" }>;
/** scope 关联唯一领域 choice 与信封；closed 是本地撤权位，不是库存或事件的副本。 */
interface Turn {
  readonly world: World;
  readonly scope: object;
  readonly envelope: object;
  readonly actorId: number;
  readonly day: number;
  readonly kind: "fox" | "puffer";
  readonly choice:
    ReturnType<typeof openAnimalFoxChoice> | ReturnType<typeof openAnimalPufferChoice>;
  closed: boolean;
}
const turns = new WeakMap<object, Turn>(),
  requests = new WeakMap<object, Turn>();
const callSchema = z.union([
  z.strictObject({
    name: z.literal("fox_distract"),
    args: z.strictObject({ target_id: z.number().int().positive().safe().nullable() }),
  }),
  z.strictObject({
    name: z.literal("puffer_retaliate"),
    args: z.strictObject({ activate: z.boolean() }),
  }),
]);
function current(t: Turn): boolean {
  if (t.closed) return false;
  if (!t.choice.isCurrent() || !animalRequestEnvelopeCurrent(t.envelope)) {
    t.closed = true;
    t.choice.close();
    return false;
  }
  return true;
}
export function openAnimalRequest(
  world: World,
  request: ActionRequest,
  unitToken?: object,
): object {
  if (requests.has(request)) throw Error("animal_request_already_bound");
  const envelope = captureAnimalRequestEnvelope(world, request),
    h = animalRequestEnvelopeHeader(envelope)!;
  const choice =
    h.kind === "fox"
      ? openAnimalFoxChoice(
          world,
          h.day,
          createAnimalFoxRequest(world, h.day, undefined, envelope).token,
        )
      : unitToken
        ? openAnimalPufferChoice(
            world,
            unitToken,
            createAnimalPufferRequest(world, unitToken, undefined, envelope).token,
          )
        : null;
  if (!choice) throw Error("animal_request_unavailable");
  const scope = Object.freeze({}),
    t: Turn = {
      world,
      scope,
      envelope,
      actorId: h.actorId,
      day: h.day,
      kind: h.kind,
      choice,
      closed: false,
    };
  bindRequestDeliveryGuard(request, () => current(t), scope);
  turns.set(scope, t);
  requests.set(request, t);
  registerRequestAliasPropagation(request, 100, inheritAnimalDeadlineRequest);
  return scope;
}
export function animalRequestScope(world: World, request: object): object | undefined {
  const t = requests.get(request);
  return t?.world === world && current(t) ? t.scope : undefined;
}
export function inheritAnimalDeadlineRequest(original: ActionRequest, clone: ActionRequest): void {
  const t = requests.get(original);
  if (!t || requests.has(clone)) return;
  inheritAnimalRequestEnvelope(t.envelope, original, clone);
  bindRequestDeliveryGuard(clone, () => current(t), t.scope);
  requests.set(clone, t);
  registerRequestAliasPropagation(clone, 100, inheritAnimalDeadlineRequest);
}
export function readAnimalTool(raw: unknown): Call | null {
  try {
    return callSchema.parse(snapshotPlainData(raw));
  } catch {
    return null;
  }
}
export function canSubmitAnimalTool(
  world: World,
  actorId: number,
  phase: Phase,
  day: number,
  scope: object | undefined,
  raw: unknown,
): boolean {
  const t = scope && turns.get(scope),
    call = readAnimalTool(raw);
  if (
    !t ||
    t.world !== world ||
    t.actorId !== actorId ||
    t.day !== day ||
    phase !== (t.kind === "fox" ? Phase.Night : Phase.Voting) ||
    !call ||
    call.name !== (t.kind === "fox" ? "fox_distract" : "puffer_retaliate") ||
    !current(t)
  )
    return false;
  if (call.name === "fox_distract") {
    const h = animalRequestEnvelopeHeader(t.envelope)!;
    return (
      call.args.target_id === null ||
      (h.candidates?.includes(call.args.target_id) === true &&
        !!animalOriginalPlayer(world, call.args.target_id))
    );
  }
  return true;
}
export function commitAnimalRequest(world: World, scope: object, raw: unknown) {
  const t = turns.get(scope),
    call = readAnimalTool(raw);
  if (
    !t ||
    !call ||
    !canSubmitAnimalTool(
      world,
      t.actorId,
      t.kind === "fox" ? Phase.Night : Phase.Voting,
      t.day,
      scope,
      call,
    )
  )
    throw Error("animal_required_action_invalid");
  // 领域 commit 先返回，才写 closed 并通知完成；commit 或通知抛错均不重建原资源。
  const receipt =
    call.name === "fox_distract"
      ? (t.choice as ReturnType<typeof openAnimalFoxChoice>).commit(call.args.target_id)
      : (t.choice as ReturnType<typeof openAnimalPufferChoice>).commit(call.args.activate);
  t.closed = true;
  settleRequestDelivery(scope, true);
  return receipt;
}
export function closeAnimalRequest(scope: object): void {
  const t = turns.get(scope);
  if (!t) return;
  t.closed = true;
  revokeAnimalRequestEnvelope(t.envelope);
  t.choice.close();
  settleRequestDelivery(scope, false);
}
