/**
 * Owns native Demon-board Witch request bindings and shared earliest deadlines. Receives
 * original turn/context references and bounded aliases; writes local bindings only after
 * native scope and body validation. Expired, replaced or invalid original requests revoke
 * delivery; completion stays owned by the original scope.
 */
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import {
  Phase,
  PotionType,
  bindRequestDeliveryGuard,
  type ActionRequest,
  type ToolCall,
  type World,
} from "../../../../core";
import { COMPONENT, StatusMark } from "../../../../core";
import {
  StatusMarksComponent,
  statusMarkSnapshot,
} from "../../../../core/domain/components/status_marks";
import { demonSnapshot, exactDemonData, ownDemonData } from "./state";
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
}
interface Request {
  turn: Turn;
  context: object;
  deadline: unknown;
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
  return (
    r.turn.current() &&
    body(r.turn.original) === r.turn.json &&
    ownDemonData(r.turn.original, "context") === r.turn.originalContext &&
    ownDemonData(r.turn.original, "deadlineAtMs") === r.turn.originalDeadline &&
    body(request) === r.turn.json &&
    ownDemonData(request, "context") === r.context &&
    ownDemonData(request, "deadlineAtMs") === r.deadline &&
    (r.turn.deadline === null || r.turn.deadline > Date.now())
  );
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
    },
    r = { turn, context, deadline };
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
/** Bound aliases share the earliest deadline; ordinary copies and changed bodies cannot inherit. */
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
  const copied: Request = { turn: r.turn, context: r.context, deadline };
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

const trustedMarkMethods = Object.fromEntries(
  ["has", "add", "remove", "clear", "values", "renderPrompt"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(StatusMarksComponent.prototype, key)!.value,
  ]),
);
export function demonWitchMarksSafe(world: World, targetId: number): boolean {
  const marks = world.getComponent(targetId, COMPONENT.StatusMarks);
  if (!marks) return true;
  if (
    !statusMarkSnapshot(marks, StatusMark.PoisonMark) ||
    Object.getPrototypeOf(marks) !== StatusMarksComponent.prototype
  )
    return false;
  return Object.entries(trustedMarkMethods).every(
    ([key, method]) =>
      !Object.getOwnPropertyDescriptor(marks, key) &&
      Object.getOwnPropertyDescriptor(StatusMarksComponent.prototype, key)?.value === method,
  );
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
