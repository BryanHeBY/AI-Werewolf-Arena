/**
 * 负责构造野孩子数据、按 descriptor 读取 live 槽并解析原工具选择字段。
 * 状态由原角色及野孩子 lifecycle 所有者持有；输入为角色记录或工具候选，输出保留原槽
 * 引用及既有有限字段校验。此数据边界不改变阵营、提交生命或从副本取得转换权限。
 */
import type { WildChildState, WildChildReadState } from "@ai-werewolf-arena/game-contract";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../core/domain/components/role";
export const WILD_CHILD_POLICY = "awa_lui_meme_wild_child_v1" as const;
export function freshWildChildState(): WildChildState {
  return {
    policy: WILD_CHILD_POLICY,
    remaining: 1,
    status: "pending",
    choice: null,
    eligibleNight: null,
    activeFromNight: null,
  };
}
export function getWildChildState(role: RoleComponent | undefined): WildChildReadState | undefined {
  const container = role && Object.getOwnPropertyDescriptor(role, "privateState");
  const value =
    container &&
    Object.hasOwn(container, "value") &&
    container.value &&
    Object.getOwnPropertyDescriptor(container.value, "wildChild");
  return value && Object.hasOwn(value, "value") ? (value.value as WildChildReadState) : undefined;
}
export function readWildChildTool(
  value: unknown,
): { name: "choose_wild_model"; args: { target_id: number } } | null {
  try {
    const p = copyEventData(value) as Record<string, unknown> | null;
    const args = p?.args as Record<string, unknown> | undefined;
    return p &&
      Object.keys(p).length === 2 &&
      p.name === "choose_wild_model" &&
      args &&
      Object.keys(args).length === 1 &&
      Number.isSafeInteger(args.target_id) &&
      (args.target_id as number) > 0
      ? { name: "choose_wild_model", args: { target_id: args.target_id as number } }
      : null;
  } catch {
    return null;
  }
}
