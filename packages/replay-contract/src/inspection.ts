import {
  isRoleId,
  type InspectionCamp,
  type InspectionResult,
} from "@ai-werewolf-arena/game-catalog";
import { isRecord } from "./validation";

const isCamp = (value: unknown): value is InspectionCamp =>
  value === "good" || value === "wolf" || value === "third_party";

/** Read a known result without interpreting future/malformed labels as Good. */
export function readInspectionResult(value: unknown): InspectionResult | null {
  try {
    if (!isRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Reflect.ownKeys(descriptors);
    if (names.some((name) => typeof name !== "string")) return null;
    const keys = (names as string[]).sort().join(",");
    // Never execute a foreign accessor or validate a different read than the
    // one returned. A throwing Proxy descriptor trap also fails closed.
    const data = (key: string): unknown => {
      const descriptor = descriptors[key];
      return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
    };
    const kind = data("kind"),
      camp = data("camp"),
      role = data("role");
    if (kind === "camp" && keys === "camp,kind" && isCamp(camp)) return { kind, camp };
    if (kind === "role" && keys === "kind,role" && isRoleId(role)) return { kind, role };
    if (kind === "combined" && keys === "camp,kind,role" && isCamp(camp) && isRoleId(role))
      return { kind, camp, role };
  } catch {
    /* Exotic values are not serialized inspection evidence. */
  }
  return null;
}

/** Legacy booleans apply only when no typed result was recorded. */
export function readSeerInspectionResult(
  payload: Record<string, unknown>,
): InspectionResult | null {
  try {
    const result = Object.getOwnPropertyDescriptor(payload, "result");
    if (result) return Object.hasOwn(result, "value") ? readInspectionResult(result.value) : null;
    const legacy = Object.getOwnPropertyDescriptor(payload, "isWerewolf");
    const isWerewolf = legacy && Object.hasOwn(legacy, "value") ? legacy.value : undefined;
    return typeof isWerewolf === "boolean"
      ? { kind: "camp", camp: isWerewolf ? "wolf" : "good" }
      : null;
  } catch {
    return null;
  }
}
