/**
 * Owns request-local delivery guards, completion receipts and alias propagation.
 * Mechanism owners register successful bindings; ordered callbacks retain their
 * own authority and deadline checks. Metadata never enters serialized requests.
 * Invalid guards fail at delivery; settlement removes its receipt before the
 * callback runs, and a throwing alias callback stops subsequent propagation.
 */
import type { ActionRequest } from "./actions";

type AliasPropagation = (original: ActionRequest, alias: ActionRequest) => void;
interface DeliveryMetadata {
  current?: () => boolean;
  completion?: object;
  aliases?: Map<AliasPropagation, number>;
}

/** Runtime capability attached to an original engine request, never model context or Tape data. */
const guards = new WeakMap<object, DeliveryMetadata>();
const settlements = new WeakMap<object, (accepted: boolean) => void>();
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
export function assertRequestDelivery(request: ActionRequest): void {
  const guard = guards.get(request);
  if (guard && "current" in guard && guard.current!() !== true)
    throw new Error("action_request_delivery_authority_revoked");
}
/** A synchronous domain commit, not provider return, settles an owned transactional request. */
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
  settlements.delete(completion);
  settle(accepted);
}

/** Records routing only after the mechanism has successfully bound this object. */
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

/** Mechanisms bind accepted aliases themselves; routing cannot grant permission. */
export function inheritRequestAlias(original: ActionRequest, alias: ActionRequest): void {
  const routes = guards.get(original)?.aliases;
  if (!routes) return;
  for (const [inherit] of [...routes].sort((left, right) => left[1] - right[1]))
    inherit(original, alias);
}

/** The caller computes its deadline first; this preserves the runner's spread order. */
export function deriveBoundedRequest(original: ActionRequest, deadlineAtMs: number): ActionRequest {
  const alias = { ...original, deadlineAtMs };
  inheritRequestAlias(original, alias);
  return alias;
}
