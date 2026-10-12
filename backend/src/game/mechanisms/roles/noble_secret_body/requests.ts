/**
 * Owns Noble/Secret Body choice and reveal request bindings plus delivery completion.
 * Receives original contexts, turn scopes and deadline aliases; writes only accepted current
 * local bindings and committed tools. Closed or invalid requests fail current checks; this
 * mechanical routing change preserves the existing restoration behavior until the separate
 * revocation correction.
 */
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import { types } from "node:util";
import { Phase } from "../../../../core/domain/identity";
import type { ActionRequest, ToolCall } from "../../../../core/domain/actions";
import type { World } from "../../../../core/domain/world";
import {
  bindRequestDeliveryGuard,
  settleRequestDelivery,
} from "../../../../core/domain/request_delivery";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import {
  nobleBodyChoiceActor,
  nobleBodyChoiceTargets,
  openSecretBodyChoice,
  openServantChoice,
  openSecretBodyRevealSpeech,
  checkpointNobleBodyAuthority,
} from "./authority";
type Kind = "body" | "noble";
type ChoiceTool = Extract<ToolCall, { name: "choose_servant" | "protect_secret_body" }>;
interface Turn {
  world: World;
  day: number;
  actorId: number;
  kind: Kind | "reveal";
  scope: object;
  lease: { isCurrent: () => boolean };
  choice?: ReturnType<typeof openSecretBodyChoice> | ReturnType<typeof openServantChoice>;
  reveal?: ReturnType<typeof openSecretBodyRevealSpeech>;
  targets: readonly number[];
  original: ActionRequest;
  context: object;
  originalDeadline: unknown;
  json: string;
  deadline: number | null;
  closed: boolean;
}
const turns = new WeakMap<object, Turn>();
const requests = new WeakMap<object, { turn: Turn; context: object; deadline: unknown }>();
function own(value: object, key: string): unknown {
  if (types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
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
function current(request: object, r: NonNullable<ReturnType<typeof requests.get>>): boolean {
  const t = r.turn;
  return (
    !t.closed &&
    t.lease.isCurrent() &&
    body(t.original) === t.json &&
    own(t.original, "context") === t.context &&
    own(t.original, "deadlineAtMs") === t.originalDeadline &&
    own(request, "context") === r.context &&
    own(request, "deadlineAtMs") === r.deadline &&
    body(request) === t.json &&
    (t.deadline === null || t.deadline > Date.now())
  );
}
export function openNobleBodyRequest(
  world: World,
  day: number,
  kind: Kind,
  request: ActionRequest,
): object {
  const actorId = nobleBodyChoiceActor(world, day, kind),
    json = body(request);
  if (actorId === null || !json || requests.has(request))
    throw Error("noble_body_request_unavailable");
  const p = JSON.parse(json) as ActionRequest,
    name = kind === "body" ? "protect_secret_body" : "choose_servant",
    stage = kind === "body" ? "secret_body" : "night_noble",
    c = p.context.turn_constraints,
    context = own(request, "context"),
    deadline = own(request, "deadlineAtMs"),
    targets = nobleBodyChoiceTargets(world, day, kind);
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
      kind === "body" ? p.context.secret_body_candidates : p.context.servant_candidates,
    ) !== JSON.stringify(targets) ||
    !context ||
    typeof context !== "object" ||
    (deadline !== undefined &&
      (typeof deadline !== "number" || !Number.isFinite(deadline) || deadline <= Date.now()))
  )
    throw Error("noble_body_request_unavailable");
  const scope = Object.freeze({}),
    lease = kind === "body" ? openSecretBodyChoice(world, day) : openServantChoice(world, day),
    turn: Turn = {
      world,
      day,
      actorId,
      kind,
      scope,
      lease,
      choice: lease,
      targets,
      original: request,
      context,
      originalDeadline: deadline,
      json,
      deadline: deadline === undefined ? null : (deadline as number),
      closed: false,
    },
    r = { turn, context, deadline };
  bindRequestDeliveryGuard(request, () => current(request, r), scope);
  turns.set(scope, turn);
  requests.set(request, r);
  registerRequestAliasPropagation(request, 80, inheritNobleBodyDeadlineRequest);
  return scope;
}
export function nobleBodyRequestScope(world: World, request: object): object | undefined {
  const r = requests.get(request);
  return r && r.turn.world === world && current(request, r) ? r.turn.scope : undefined;
}
/** Only bounded aliases retaining the original context may share a turn. All aliases
 * use the earliest deadline; replacing an original body or context revokes every alias. */
export function inheritNobleBodyDeadlineRequest(
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
  registerRequestAliasPropagation(clone, 80, inheritNobleBodyDeadlineRequest);
}
export function readNobleBodyTool(raw: unknown): ChoiceTool | null {
  try {
    const p = snapshotPlainData(raw) as ChoiceTool;
    if (
      Object.keys(p).length !== 2 ||
      !Object.hasOwn(p, "name") ||
      !Object.hasOwn(p, "args") ||
      !["choose_servant", "protect_secret_body"].includes(p.name) ||
      !p.args ||
      typeof p.args !== "object" ||
      Array.isArray(p.args) ||
      Object.keys(p.args).length !== 1 ||
      !Object.hasOwn(p.args, "target_id") ||
      !(
        p.args.target_id === null ||
        (Number.isSafeInteger(p.args.target_id) && p.args.target_id > 0)
      )
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
export function canSubmitNobleBodyChoice(
  world: World,
  actorId: number,
  phase: Phase,
  day: number,
  scope: object | undefined,
  raw: unknown,
): boolean {
  const t = scope && turns.get(scope),
    call = readNobleBodyTool(raw);
  if (
    !t ||
    t.kind === "reveal" ||
    t.world !== world ||
    t.actorId !== actorId ||
    phase !== Phase.Night ||
    day !== t.day ||
    !nobleBodyRequestScope(world, t.original) ||
    !call ||
    call.name !== (t.kind === "body" ? "protect_secret_body" : "choose_servant")
  )
    return false;
  return (
    call.args.target_id === null ||
    (t.targets.includes(call.args.target_id) &&
      nobleBodyChoiceTargets(world, day, t.kind).includes(call.args.target_id))
  );
}
export function commitNobleBodyChoice(world: World, scope: object, raw: unknown) {
  const t = turns.get(scope),
    call = readNobleBodyTool(raw);
  if (!t || !call || !canSubmitNobleBodyChoice(world, t.actorId, Phase.Night, t.day, scope, call))
    throw Error("noble_body_request_unavailable");
  const receipt = t.choice!.commit(call.args.target_id);
  t.closed = true;
  settleRequestDelivery(scope, true);
  return receipt;
}
export function closeNobleBodyRequest(scope: object): void {
  const t = turns.get(scope);
  if (t) t.closed = true;
  settleRequestDelivery(scope, false);
}

export function openNobleBodyRevealRequest(
  world: World,
  day: number,
  request: ActionRequest,
  isCurrent: () => boolean,
): object {
  const json = body(request);
  if (!json || requests.has(request)) throw Error("noble_body_request_unavailable");
  const p = JSON.parse(json) as ActionRequest,
    c = p.context.turn_constraints,
    context = own(request, "context"),
    deadline = own(request, "deadlineAtMs");
  if (
    p.phase !== Phase.Voting ||
    p.context.day !== day ||
    p.context.stage !== "awakened_idiot_reveal_speech" ||
    JSON.stringify(p.allowedTools) !== JSON.stringify(["speak"]) ||
    p.context.allow_fallback !== false ||
    p.context.action_failure_policy !== "error" ||
    c?.min_valid_actions !== 1 ||
    c.max_valid_actions !== 1 ||
    JSON.stringify(c.required_any_tools) !== JSON.stringify(["speak"]) ||
    !context ||
    typeof context !== "object" ||
    (deadline !== undefined &&
      (typeof deadline !== "number" || !Number.isFinite(deadline) || deadline <= Date.now()))
  )
    throw Error("noble_body_request_unavailable");
  if (p.actorId !== checkpointNobleBodyAuthority(world, true).bodyId)
    throw Error("noble_body_request_unavailable");
  const reveal = openSecretBodyRevealSpeech(world, day, isCurrent),
    scope = Object.freeze({});
  if (p.actorId !== reveal.actorId) throw Error("noble_body_request_unavailable");
  const turn: Turn = {
      world,
      day,
      actorId: p.actorId,
      kind: "reveal",
      scope,
      lease: reveal,
      reveal,
      targets: [],
      original: request,
      context,
      originalDeadline: deadline,
      json,
      deadline: deadline === undefined ? null : (deadline as number),
      closed: false,
    },
    r = { turn, context, deadline };
  bindRequestDeliveryGuard(request, () => current(request, r), scope);
  turns.set(scope, turn);
  requests.set(request, r);
  registerRequestAliasPropagation(request, 80, inheritNobleBodyDeadlineRequest);
  return scope;
}
export function commitNobleBodyRevealSpeech(world: World, scope: object, raw: unknown) {
  const t = turns.get(scope);
  if (
    !t ||
    t.kind !== "reveal" ||
    t.world !== world ||
    nobleBodyRequestScope(world, t.original) !== scope
  )
    throw Error("secret_body_reveal_speech_unavailable");
  const p = snapshotPlainData(raw) as { name: string; args: { text: string } };
  if (
    Object.keys(p).length !== 2 ||
    p.name !== "speak" ||
    !p.args ||
    !Object.hasOwn(p, "args") ||
    Object.keys(p.args).length !== 1 ||
    typeof p.args.text !== "string"
  )
    throw Error("secret_body_reveal_speech_unavailable");
  const receipt = t.reveal!.commit(p.args.text);
  t.closed = true;
  settleRequestDelivery(scope, true);
  return receipt;
}
