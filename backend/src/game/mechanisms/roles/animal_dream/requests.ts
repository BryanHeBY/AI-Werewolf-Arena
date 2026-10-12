/**
 * Owns Animal Dream turn scopes, request envelopes and transactional completion. Receives
 * original World/choice/envelope references; writes accepted bindings and tool commits only
 * through current monotonic authority. Closed, cancelled or invalid envelopes revoke delivery
 * and all aliases; routing metadata never grants permission.
 */
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import { z } from "zod";
import type { World } from "../../../../core/domain/world";
import { Phase } from "../../../../core/domain/identity";
import type { ActionRequest, ToolCall } from "../../../../core/domain/actions";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import {
  bindRequestDeliveryGuard,
  settleRequestDelivery,
} from "../../../../core/domain/request_delivery";
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
