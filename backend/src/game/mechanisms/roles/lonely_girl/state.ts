/**
 * Owns Lonely Girl state construction and validated live slot reads. Inputs are the
 * original role record; outputs preserve the stored reference after the existing copied
 * validation. This boundary never resolves a relationship, reveals truth or commits stock.
 */
import type { LonelyGirlState, LonelyGirlReadState } from "@ai-werewolf-arena/game-contract";
import { copyEventData, LONELY_GIRL_POLICY } from "@ai-werewolf-arena/game-text";
import type { RoleComponent } from "../../../../core/domain";
export {
  LONELY_GIRL_POLICY,
  readLonelyGirlChoiceTool as readLonelyGirlTool,
} from "@ai-werewolf-arena/game-text";
export function freshLonelyGirlState(): LonelyGirlState {
  return { policy: LONELY_GIRL_POLICY, remaining: 1, choice: null };
}
export function lonelyData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
export function getLonelyGirlState(
  role: RoleComponent | undefined,
): LonelyGirlReadState | undefined {
  const value = lonelyData(lonelyData(role, "privateState"), "lonelyGirl");
  try {
    const p = copyEventData(value) as LonelyGirlReadState;
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
    return value as LonelyGirlReadState;
  } catch {
    return undefined;
  }
}
