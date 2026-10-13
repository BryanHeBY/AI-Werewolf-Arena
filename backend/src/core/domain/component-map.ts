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
import type { VotingRightComponent } from "./components/voting_right";
import type { StatusMarksComponent } from "./components/status_marks";
import type { BadgeComponent } from "./components/badge";
import type { VictoryComponent } from "./components/victory";
import type { LoversComponent } from "./components/lovers";
import type { WallNoteComponent } from "./components/wall_note";
import type { DebatePenaltyComponent } from "./components/debate_penalty";

export interface ComponentMap {
  [COMPONENT.Identity]: IdentityComponent;
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

type ComponentFields = {
  [K in ComponentName]: keyof ComponentMap[K];
}[ComponentName];

/**
 * 保留自定义扩展字段，同时拒绝另一槽的独有公开字段。Role 在结构上包含 Camp，
 * 但 role／privateState 不能装入 Camp 槽；展示方法已退出组件结构。此关系只属于类型，
 * 不执行运行时 shape 检查，也不把扩展对象限制为精确字段集合。
 */
export type ComponentWrite<K extends ComponentName> = K extends ComponentName
  ? ComponentMap[K] & {
      [P in Exclude<ComponentFields, keyof ComponentMap[K]>]?: never;
    }
  : never;
