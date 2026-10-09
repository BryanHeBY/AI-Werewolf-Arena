import { copyEventData, LONELY_GIRL_POLICY } from "@ai-werewolf-arena/game-text";
import type { RoleComponent } from "../../../../core/domain";
export {
  LONELY_GIRL_POLICY,
  readLonelyGirlChoiceTool as readLonelyGirlTool,
} from "@ai-werewolf-arena/game-text";
export interface LonelyGirlState {
  policy: typeof LONELY_GIRL_POLICY;
  remaining: 0 | 1;
  choice: { day: 1; targetId: number } | null;
}
export function freshLonelyGirlState(): LonelyGirlState {
  return { policy: LONELY_GIRL_POLICY, remaining: 1, choice: null };
}
export function lonelyData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
export function getLonelyGirlState(role: RoleComponent | undefined): LonelyGirlState | undefined {
  const value = lonelyData(lonelyData(role, "privateState"), "lonelyGirl");
  try {
    const p = copyEventData(value) as LonelyGirlState;
    if (
      !p ||
      Array.isArray(p) ||
      Object.keys(p).length !== 3 ||
      p.policy !== LONELY_GIRL_POLICY ||
      ![0, 1].includes(p.remaining) ||
      (p.choice !== null &&
        (typeof p.choice !== "object" ||
          Array.isArray(p.choice) ||
          Object.keys(p.choice).length !== 2 ||
          p.choice.day !== 1 ||
          !Number.isSafeInteger(p.choice.targetId) ||
          p.choice.targetId < 1 ||
          p.remaining !== 0))
    )
      return undefined;
    return value as LonelyGirlState;
  } catch {
    return undefined;
  }
}
