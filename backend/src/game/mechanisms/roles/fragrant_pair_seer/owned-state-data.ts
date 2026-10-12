/**
 * Provides Fragrant's existing descriptor checks, in-place data writes and JSON audit copy.
 * Inputs are this feature's captured state/ability objects and validated next data;
 * outputs preserve exact writable-field errors and property-definition order.
 * Only Fragrant's Phantom and pair-state owners use these primitives; they never
 * create a global store, run a controller, grant a lease or settle a request.
 */
import { snapshotPlainData } from "../../../../core/domain/plain_data";

export function plainJson(value: unknown): string | null {
  try {
    return JSON.stringify(snapshotPlainData(value, new Set(), 0, 65536));
  } catch {
    return null;
  }
}

export function assertWritable(value: object, next: object): void {
  if (
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== Object.keys(next).length ||
    Object.keys(next).some((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return !d || !("value" in d) || !d.writable || !d.configurable;
    })
  )
    throw Error("fragrant_state_write_revoked");
}

export function write<T extends object>(value: T, next: T): void {
  assertWritable(value, next);
  for (const key of Object.keys(next) as Array<keyof T>)
    Object.defineProperty(value, key, {
      ...Object.getOwnPropertyDescriptor(value, key),
      value: next[key],
    });
}
