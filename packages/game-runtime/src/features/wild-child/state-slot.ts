/**
 * 负责野孩子原槽创建／安装、宽只读查询、工具解析、选择／取消与转换数据写入和预期内容编码。
 * 输入为原数据绑定及生命周期已核参数；输出保持同一 raw 槽和原 expectedState 字符串，投影另作副本。
 * get 原本只取自有 data descriptor，不是完整 payload schema；不得借迁槽新增拒绝、冻结或复制 live 状态。
 * 榜样生命、阵营／Victory、时钟和已发布死亡事实仍归生命周期；槽数据和知识不是当前许可或档案协议。
 */
import type { WildChildState, WildChildReadState } from "@ai-werewolf-arena/game-contract";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../domain/components/role";
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

import type { RoleInitializationComponent } from "../../rulesets/roles/contracts";

/** 保原同引用查询、LHS 与 fresh callee 的先后；初始化不建立新的 World 或许可记录。 */
export function initializeWildChildState(role: RoleInitializationComponent): void {
  if (!getWildChildState(role)) role.privateState.wildChild = freshWildChildState();
}

/** 原内部内容证据编码：复制或 stringify 失败仍只返回 invalid，不是归档 schema 或授权。 */
export function encodeWildChildData(value: unknown): string {
  try {
    return JSON.stringify(copyEventData(value));
  } catch {
    return "invalid";
  }
}

import type { NightLifeScope } from "../../domain/night-effects";
/** 直接使用原 lifecycle 绑定字段，不新增 store、镜像或绑定类；model 仍是原捕获生命引用。 */
interface WildChildDataBinding {
  state: WildChildReadState;
  expectedState: string;
  model: NightLifeScope | null;
}

/** 先核原可写字段，再消费与写 choice；model 的延迟读取夹在写槽与编码之间。 */
export function commitWildChildState(
  b: WildChildDataBinding,
  choice: NonNullable<WildChildReadState["choice"]>,
  model: () => NightLifeScope,
): boolean {
  if (
    !["remaining", "status", "choice"].every(
      (k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable,
    )
  )
    return false;
  (b.state as Pick<WildChildState, "remaining">).remaining = 0;
  (b.state as Pick<WildChildState, "status">).status = "chosen";
  (b.state as Pick<WildChildState, "choice">).choice = choice;
  b.model = model();
  b.expectedState = encodeWildChildData(b.state);
  return true;
}

/** lifecycle 先关闭原窗口；这里只执行原两字段可写短路及已写内容证据更新。 */
export function cancelWildChildState(
  b: Pick<WildChildDataBinding, "state" | "expectedState">,
): void {
  if (["remaining", "status"].every((k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable)) {
    (b.state as Pick<WildChildState, "remaining">).remaining = 0;
    (b.state as Pick<WildChildState, "status">).status = "closed";
    b.expectedState = encodeWildChildData(b.state);
  }
}

/** 原榜样事实、阵营和 Victory 已经提交后才写转换数据；错误保留那些已发布前缀。 */
export function transformWildChildState(
  b: Pick<WildChildDataBinding, "state" | "expectedState">,
  day: number,
): void {
  (b.state as Pick<WildChildState, "status">).status = "transformed";
  (b.state as Pick<WildChildState, "eligibleNight">).eligibleNight = day + 1;
  b.expectedState = encodeWildChildData(b.state);
}

/** 原夜资格与活跃标记先由 lifecycle 处理；编码失败仍按原 invalid 结果继续，不补新的清理。 */
export function activateWildChildState(
  b: Pick<WildChildDataBinding, "state" | "expectedState">,
  day: number,
): void {
  (b.state as Pick<WildChildState, "status">).status = "active";
  (b.state as Pick<WildChildState, "activeFromNight">).activeFromNight = day;
  b.expectedState = encodeWildChildData(b.state);
}

/** 先在原点查询 owner；不当前只显示关闭副本，正常状态仍完整克隆原槽。 */
export function projectWildChildData(
  b: Pick<WildChildDataBinding, "state">,
  current: () => boolean,
): WildChildReadState {
  if (!current()) return { ...freshWildChildState(), remaining: 0, status: "closed" };
  return structuredClone(b.state);
}
