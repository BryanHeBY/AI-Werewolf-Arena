/**
 * 负责定义领域组件名称与存储对象之间的类型关系。输入为既有十一种槽 ID 和组件接口；
 * 输出使 World 按具名槽返回原可写组件引用，调用方不再以任意泛型覆盖槽结构；不复制值或存储。工厂与生命周期所有者
 * 仍负责各自校验，此关系不授予资源权限或序列化运行句柄。
 */
import type { COMPONENT, ComponentName } from "./components/names";
import type { IdentityComponent } from "./entities/player";
import type { RoleComponent } from "./components/role";
import type { CampComponent } from "./components/camp";
import type { AliveComponent } from "./components/alive";
import type { VotingRightComponent } from "./components/voting-right";
import type { StatusMarksComponent } from "./components/status-marks";
import type { BadgeComponent } from "./components/badge";
import type { VictoryComponent } from "./components/victory";
import type { LoversComponent } from "./components/lovers";
import type { WallNoteComponent } from "./components/wall-note";
import type { DebatePenaltyComponent } from "./components/debate-penalty";

/** 十一具名槽分别关联其原组件类型；该映射不创建实例，也不把两个槽的字段合成一个对象。 */
export interface ComponentMap {
  [COMPONENT.Identity]: IdentityComponent;
  // 角色身份／私有容器与实际阵营是两个独立槽；当前阵营不再镜像到 Role。
  [COMPONENT.Role]: RoleComponent;
  [COMPONENT.Camp]: CampComponent;
  [COMPONENT.Alive]: AliveComponent;
  [COMPONENT.VotingRight]: VotingRightComponent;
  [COMPONENT.StatusMarks]: StatusMarksComponent;
  [COMPONENT.Badge]: BadgeComponent;
  [COMPONENT.Victory]: VictoryComponent;
  [COMPONENT.Lovers]: LoversComponent;
  [COMPONENT.WallNote]: WallNoteComponent;
  [COMPONENT.DebatePenalty]: DebatePenaltyComponent;
}

/** 汇总既有槽的公开字段名，供写入类型排除其它槽字段；自定义扩展名仍可由具体输入保留。 */
type ComponentFields = {
  [K in ComponentName]: keyof ComponentMap[K];
}[ComponentName];

/**
 * 保留自定义扩展字段，同时在类型上排除其它槽的公开字段。Role 与 Camp 分属独立槽，
 * role／privateState 不能装入 Camp 槽，camp 不能装入 Role 槽；展示方法已退出组件结构。
 * optional never 与最终 never 分支仅约束编译期槽关系，不执行运行 shape 检查、冻结或授权，
 * 也不把扩展对象限制为精确字段集合。
 */
export type ComponentWrite<K extends ComponentName> = K extends ComponentName
  ? ComponentMap[K] & {
      [P in Exclude<ComponentFields, keyof ComponentMap[K]>]?: never;
    }
  : never;
