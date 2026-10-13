/**
 * 定义角色组件与不透明只读私有容器的数据结构。输入为角色与阵营；输出保持原组件和
 * 空记录引用。领域不查询语言、格式化提示、初始化机制槽或冻结演员；实际展示由游戏侧
 * 创建／Catalog 装配，读方不取得私有容器写权，原 role/camp 写权限仍由具体所有者负责。
 */
import { Camp, Role } from "@ai-werewolf-arena/game-contract";

export interface RoleComponent {
  role: Role;
  camp: Camp;
  readonly privateState: object;
}

/** 仅创建领域数据；机制初始化与展示绑定在实际游戏装配处执行。 */
export function createRoleComponent(role: Role, camp: Camp): RoleComponent {
  return { role, camp, privateState: {} };
}
