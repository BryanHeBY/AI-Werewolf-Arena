/**
 * 负责构造孤独少女 policy／remaining／choice 数据并验证原角色状态槽。
 * 槽由原角色及关系 lifecycle 所有者持有，输入为角色记录，输出为复制校验通过后的原引用。
 * choice 的首夜字段与库存关系沿用原接受集合；查询不结算关系、公开底牌或提交库存。
 */
import type { LonelyGirlState, LonelyGirlReadState } from "@ai-werewolf-arena/game-contract";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { LONELY_GIRL_POLICY } from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
import type { RoleComponent } from "../../../../core/domain";
export {
  LONELY_GIRL_POLICY,
  readLonelyGirlChoiceTool as readLonelyGirlTool,
} from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
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
