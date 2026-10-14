/**
 * 负责熊的原私有状态槽直接读写及普通历史追加；输入为原角色／状态／报告，安装和读取返回原引用，历史追加无返回值。
 * 状态安装先赋原槽再返回，读取只是类型断言，不执行 schema／Proxy／当前性检查或深冻结。
 * 数据契约属于共享包，名单、生命、实际吼叫判定、玩家知识和检查点编码仍归各实际所有者。
 * 普通发布取原 history.push 追加；黎明政策保留 frame 自己的受控 writer，本叶不合并两种写入。
 * 原写入或 getter／push 失败直接传播，不保存镜像、退款或授予请求权限。
 */
import type { BearState, BearReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";

/** 保留 privateState 的原 LHS 读取和同对象赋值；允许的状态形状仍由安装调用方负责。 */
export function setBearState(role: RoleComponent, state: BearState): BearReadState {
  (role.privateState as { bear: BearState })["bear"] = state;
  return state;
}

/** 返回原 live 引用；BearReadState 的 readonly 约束不代表运行时冻结或合法性验证。 */
export function getBearState(role: RoleComponent): BearReadState | undefined {
  return (role.privateState as { readonly bear?: unknown })["bear"] as BearReadState | undefined;
}

/** 普通发布先读取 history／push，再追加原报告对象；后错不回滚，黎明独立 writer 不经此命令。 */
export function recordBearRoar(state: BearReadState, report: BearState["history"][number]): void {
  (state.history as BearState["history"]).push(report);
}
