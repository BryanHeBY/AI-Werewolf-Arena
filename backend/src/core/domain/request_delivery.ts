import type { ActionRequest } from "./actions";

/** Runtime capability attached to an original engine request, never model context or Tape data. */
const guards = new WeakMap<object, { current: () => boolean; completion?: object }>();
const settlements = new WeakMap<object, (accepted: boolean) => void>();
export function bindRequestDeliveryGuard(
  request: object,
  isCurrent: () => boolean,
  completion?: object,
): void {
  if (guards.has(request)) throw new Error("action_request_delivery_guard_already_bound");
  guards.set(request, { current: isCurrent, completion });
}
export function assertRequestDelivery(request: ActionRequest): void {
  const guard = guards.get(request);
  if (guard && guard.current() !== true)
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
