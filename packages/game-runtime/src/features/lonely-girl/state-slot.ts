/**
 * 负责孤独少女三字段槽的创建／安装、原复制校验、同引用读取、消费／取消数据写入及知识结构投影。
 * 输入为原角色、数据绑定与已核选择；输出为原状态引用、逐字段提交前缀或脱离的玩家知识副本。
 * 复制校验只保原 policy／库存／首夜 choice 接受集合，不扩大 schema，也不把玩家投影当作实际阵营或许可。
 * 生命周期继续拥有参与者／生命、复制成员关系、Victory 安装和关闭；数据失败不会补回库存或吞异常。
 */
import type { LonelyGirlState, LonelyGirlReadState } from "@ai-werewolf-arena/game-contract";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { LONELY_GIRL_POLICY } from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
import type { RoleComponent } from "../../domain";
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

import type { RoleInitializationComponent } from "../../rulesets/roles/contracts";

/** 保原同引用查询、LHS 与 fresh callee 的先后；初始化不建立新的 World 或许可记录。 */
export function initializeLonelyGirlState(role: RoleInitializationComponent): void {
  if (!getLonelyGirlState(role)) role.privateState.lonelyGirl = freshLonelyGirlState();
}

/** 两项原资源写先于 lifecycle 的 Victory 安装；后者失败不回滚已消费槽。 */
export function consumeLonelyGirlState(
  b: { state: LonelyGirlReadState },
  choice: NonNullable<LonelyGirlReadState["choice"]>,
): void {
  (b.state as Pick<LonelyGirlState, "remaining">).remaining = 0;
  (b.state as Pick<LonelyGirlState, "choice">).choice = choice;
}

/** 原关闭状态先写；只沿各自可写 data descriptor 逐项改值，第二项失败保留第一项。 */
export function cancelLonelyGirlState(b: { state: LonelyGirlReadState }): void {
  for (const [key, value] of [
    ["remaining", 0],
    ["choice", null],
  ] as const) {
    const d = Object.getOwnPropertyDescriptor(b.state, key);
    if (d && Object.hasOwn(d, "value") && d.writable)
      Object.defineProperty(b.state, key, { ...d, value });
  }
}

/** 投影只消费 lifecycle 的原状态／选择和当前性查询；不复制实际阵营或授予原窗口资格。 */
export function projectLonelyGirlData(
  b: {
    status: "pending" | "active" | "complete" | "failed" | "cancelled";
    choice: LonelyGirlReadState["choice"];
  },
  pendingOwner: () => boolean,
): LonelyGirlReadState {
  return b.status === "complete"
    ? { ...freshLonelyGirlState(), remaining: 0, choice: b.choice && { ...b.choice } }
    : {
        ...freshLonelyGirlState(),
        remaining: (b.status === "pending" || b.status === "active") && pendingOwner() ? 1 : 0,
      };
}
