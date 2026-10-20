/**
 * 负责本机制原生角色提示的逐片段捕获及既有公开政策／请求展示贡献。输入为原角色组件、语言、原 World 引用和未执行的当前阵营 source；输出仍由共享展示包格式化。
 * 只读取本机制已授权的原生状态，不用赠予／借用能力替换原文，不复制库存或缓存结果；字段、callee／receiver、格式化及异常的先后保持原查询点。
 * 公开政策与请求贡献保留各自原输入，捕获不授予行动权限、扩大受众或替代状态 owner。
 */
import { type Locale } from "@ai-werewolf-arena/game-contract";
import { type RoleComponent } from "../../domain/components/role";
import { type World } from "../../domain/world";
import { type CurrentCampSource } from "../../domain/components/camp";
import { projectWildChild } from "./ports";
import { formatNativeRoleMessage as nativeText } from "@ai-werewolf-arena/game-presentation";

export const captureWildChildPresentation = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world: World | undefined,
  currentCamp: CurrentCampSource,
): string =>
  nativeText(locale, "role.wild_child.state", {
    camp: (() => {
      // 只在此实际显示字段晚查；缺少必需组件不能把初始化元数据伪装成当前阵营。
      const camp = currentCamp();
      if (!camp) throw new Error("role_current_camp_missing");
      return camp.camp;
    })(),
    state: JSON.stringify(world ? projectWildChild(world, role) : undefined),
  });
