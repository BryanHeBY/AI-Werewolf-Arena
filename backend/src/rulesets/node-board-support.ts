/**
 * Responsibility: preserve Node ingress for the finite Demon Hunter board check.
 * Input: unknown candidate data; output: the original support boolean, returning
 * false for any snapshot or predicate failure. Domain snapshotPlainData rejects
 * Proxy before reflection and keeps depth 16, array limit 256 and the original
 * error code; the inert predicate then applies its own unchanged limits.
 * This setup check never installs state, grants a lease or pays a resource.
 */
import { snapshotPlainData } from "../core/domain/plain_data";
import { isDemonHunterPreset as readPreset } from "./support";

export function isDemonHunterPreset(input: unknown): boolean {
  try {
    return readPreset(
      snapshotPlainData(input, new Set<object>(), 0, 256, "demon_hunter_data_invalid"),
    );
  } catch {
    return false;
  }
}
