/**
 * 负责寻香魅影／觉醒预言家的选择 turn、请求正文与共享期限绑定。输入为原 World／context、
 * 类型对应请求和有限期限别名；输出为原 scope、合法工具及领域提交回执。
 * 不变量：领域 choice 与信封必须分别通过复验；失配／过期一旦被观察就关闭共享 turn，已登记别名保留原 context。
 * choice.commit 成功后才关 turn 并通知 true，发布与退款不归本模块；新别名不会凭路由 metadata 获权。
 */
import { registerRequestAliasPropagation } from "../../domain/request-delivery";
import { types } from "node:util";
import type { ActionRequest, ToolCall } from "../../domain/actions";
import { Phase } from "../../domain/identity";
import type { World } from "../../domain/world";
import { snapshotPlainData } from "../../domain/plain-data";
import { bindRequestDeliveryGuard, settleRequestDelivery } from "../../domain/request-delivery";
import { normalizePair } from "./state";
import {
  fragrantChoiceActor,
  fragrantChoiceCandidates,
  openFragrantBindChoice,
  openPairCheckChoice,
} from "./authority";
type Kind = "bind" | "pair";
type ChoiceTool = Extract<ToolCall, { name: "bind_fragrant_pair" | "check_pair" }>;
/** 原请求正文／context 与每别名 context／deadline 分开固定，共享 choice、预算及 closed，不复制领域库存。 */
interface Turn {
  readonly world: World;
  readonly day: number;
  readonly actorId: number;
  readonly kind: Kind;
  readonly scope: object;
  readonly choice:
    ReturnType<typeof openFragrantBindChoice> | ReturnType<typeof openPairCheckChoice>;
  readonly original: ActionRequest;
  readonly context: object;
  readonly originalDeadline: unknown;
  readonly json: string;
  deadline: number | null;
  closed: boolean;
}
interface RequestAlias {
  readonly turn: Turn;
  readonly context: object;
  readonly deadline: unknown;
}
const turns = new WeakMap<object, Turn>(),
  requests = new WeakMap<object, RequestAlias>();
const invalid = Symbol("fragrant_request_field_invalid");
function own(value: object, key: string): unknown {
  if (types.isProxy(value)) return invalid;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : d ? invalid : undefined;
}
function body(value: object): string | null {
  try {
    const p = snapshotPlainData(value, new Set(), 0, 16384) as Record<string, unknown>;
    return JSON.stringify(
      Object.fromEntries(Object.entries(p).filter(([key]) => key !== "deadlineAtMs")),
    );
  } catch {
    return null;
  }
}
/** 不调用领域 owner／控制器；领域 lease 在其末次外部检查后调用此信封检查，失配只写共享 closed。 */
function envelopeCurrent(request: object, alias: RequestAlias): boolean {
  const t = alias.turn;
  const eligible =
    (t.deadline === null || t.deadline > Date.now()) &&
    !t.closed &&
    body(t.original) === t.json &&
    own(t.original, "context") === t.context &&
    own(t.original, "deadlineAtMs") === t.originalDeadline &&
    own(request, "context") === alias.context &&
    own(request, "deadlineAtMs") === alias.deadline &&
    body(request) === t.json;
  if (!eligible) t.closed = true;
  return eligible;
}
function current(request: object, alias: RequestAlias): boolean {
  if (alias.turn.closed) return false;
  const eligible = alias.turn.choice.isCurrent() && envelopeCurrent(request, alias);
  if (!eligible) alias.turn.closed = true;
  return eligible;
}
export function openFragrantPairRequest(
  world: World,
  day: number,
  kind: Kind,
  request: ActionRequest,
): object {
  const actorId = fragrantChoiceActor(world, day, kind),
    json = body(request);
  if (actorId === null || !json || requests.has(request))
    throw Error("fragrant_request_unavailable");
  const p = JSON.parse(json) as ActionRequest,
    c = p.context.turn_constraints,
    context = own(request, "context"),
    deadline = own(request, "deadlineAtMs"),
    name = kind === "bind" ? "bind_fragrant_pair" : "check_pair",
    stage = kind === "bind" ? "fragrant_bind" : "pair_inspection",
    targets = fragrantChoiceCandidates(world, day);
  if (
    p.actorId !== actorId ||
    p.phase !== Phase.Night ||
    p.context.day !== day ||
    p.context.stage !== stage ||
    p.allowedTools.length !== 1 ||
    p.allowedTools[0] !== name ||
    p.context.allow_fallback !== false ||
    p.context.action_failure_policy !== "error" ||
    c?.min_valid_actions !== 1 ||
    c.max_valid_actions !== 1 ||
    JSON.stringify(c.required_any_tools) !== JSON.stringify([name]) ||
    JSON.stringify(
      kind === "bind" ? p.context.fragrant_pair_candidates : p.context.pair_check_candidates,
    ) !== JSON.stringify(targets) ||
    p.context.ability_id !== (kind === "pair" ? "native:pair_check" : undefined) ||
    !context ||
    typeof context !== "object" ||
    (deadline !== undefined &&
      (typeof deadline !== "number" || !Number.isFinite(deadline) || deadline <= Date.now()))
  )
    throw Error("fragrant_request_unavailable");
  let alias: RequestAlias;
  const scope = Object.freeze({}),
    requestCurrent = () => !!alias && envelopeCurrent(request, alias),
    choice =
      kind === "bind"
        ? openFragrantBindChoice(world, day, requestCurrent)
        : openPairCheckChoice(world, day, requestCurrent),
    turn: Turn = {
      world,
      day,
      actorId,
      kind,
      scope,
      choice,
      original: request,
      context,
      originalDeadline: deadline,
      json,
      deadline: deadline === undefined ? null : (deadline as number),
      closed: false,
    };
  alias = { turn, context, deadline };
  bindRequestDeliveryGuard(request, () => current(request, alias), scope);
  turns.set(scope, turn);
  requests.set(request, alias);
  registerRequestAliasPropagation(request, 90, inheritFragrantPairDeadlineRequest);
  return scope;
}
export function fragrantPairRequestScope(world: World, request: object): object | undefined {
  const r = requests.get(request);
  return r && r.turn.world === world && current(request, r) ? r.turn.scope : undefined;
}
export function inheritFragrantPairDeadlineRequest(
  request: ActionRequest,
  clone: ActionRequest,
): void {
  const r = requests.get(request),
    deadline = own(clone, "deadlineAtMs");
  if (
    !r ||
    requests.has(clone) ||
    !current(request, r) ||
    body(clone) !== r.turn.json ||
    own(clone, "context") !== r.context ||
    typeof deadline !== "number" ||
    !Number.isFinite(deadline) ||
    deadline <= Date.now() ||
    (r.turn.deadline !== null && deadline > r.turn.deadline)
  )
    return;
  const alias = { turn: r.turn, context: r.context, deadline };
  bindRequestDeliveryGuard(clone, () => current(clone, alias), r.turn.scope);
  r.turn.deadline = deadline;
  requests.set(clone, alias);
  registerRequestAliasPropagation(clone, 90, inheritFragrantPairDeadlineRequest);
}
export function readFragrantPairTool(raw: unknown): ChoiceTool | null {
  try {
    const p = snapshotPlainData(raw) as Record<string, unknown>;
    if (
      Object.keys(p).length !== 2 ||
      !Object.hasOwn(p, "name") ||
      !Object.hasOwn(p, "args") ||
      (p.name !== "bind_fragrant_pair" && p.name !== "check_pair") ||
      !p.args ||
      typeof p.args !== "object" ||
      Array.isArray(p.args) ||
      Object.keys(p.args).length !== 1 ||
      !Object.hasOwn(p.args, "target_ids")
    )
      return null;
    const value = (p.args as { target_ids: unknown }).target_ids;
    if (p.name === "bind_fragrant_pair" && value === null)
      return { name: p.name, args: { target_ids: null } };
    return { name: p.name, args: { target_ids: normalizePair(value) } };
  } catch {
    return null;
  }
}
export function canSubmitFragrantPairChoice(
  world: World,
  actorId: number,
  phase: Phase,
  day: number,
  scope: object | undefined,
  raw: unknown,
): boolean {
  const t = scope && turns.get(scope),
    call = readFragrantPairTool(raw);
  if (
    !t ||
    t.world !== world ||
    actorId !== t.actorId ||
    phase !== Phase.Night ||
    day !== t.day ||
    fragrantPairRequestScope(world, t.original) !== scope ||
    !call ||
    call.name !== (t.kind === "bind" ? "bind_fragrant_pair" : "check_pair")
  )
    return false;
  return (
    call.args.target_ids === null ||
    call.args.target_ids.every((id) => t.choice.candidates.includes(id))
  );
}
export function commitFragrantPairChoice(world: World, scope: object, raw: unknown) {
  const t = turns.get(scope),
    call = readFragrantPairTool(raw);
  if (
    !t ||
    !call ||
    !canSubmitFragrantPairChoice(world, t.actorId, Phase.Night, t.day, scope, call)
  )
    throw Error("fragrant_request_unavailable");
  // commit 返回前不宣称完成；成功后的通知或上游事实失败不撤销此前领域写入。
  const receipt = t.choice.commit(call.args.target_ids);
  t.closed = true;
  settleRequestDelivery(scope, true);
  return receipt;
}
export function closeFragrantPairRequest(scope: object): void {
  const t = turns.get(scope);
  if (t) t.closed = true;
  settleRequestDelivery(scope, false);
}
