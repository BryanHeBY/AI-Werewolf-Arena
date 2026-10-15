/**
 * 负责镜女的原生查验实例选择与新安装数据结构。输入为原角色对象，输出保留原实例引用
 * 或新的原始空历史数据；初始化与内建展示使用同一个选择函数。只读查询不补充库存，
 * 默认数据仍仅用于原初始化或缺失原生能力时的展示政策，不安装能力、关闭窗口或执行归档。
 */
import type { RoleInspectionState } from "@ai-werewolf-arena/game-contract";
import { Role } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../domain/components/role";
import { allNightAbilities } from "../night-abilities/abilities";
export const freshMirrorInspectionState = (): RoleInspectionState => ({
  policy: "mirror",
  lastTarget: null,
  lastDay: null,
  history: [],
});

export const nativeMirror = (role: RoleComponent) =>
  allNightAbilities(role).find(
    (ability) =>
      ability.kind === "role_check" &&
      ability.source.kind === "native" &&
      ability.source.role === Role.MirrorGirl,
  );
