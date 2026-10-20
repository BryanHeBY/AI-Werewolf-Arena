/**
 * 负责本机制原生角色提示的逐片段捕获及既有公开政策／请求展示贡献。输入为原角色组件、语言、原 World 引用和未执行的当前阵营 source；输出仍由共享展示包格式化。
 * 只读取本机制已授权的原生状态，不用赠予／借用能力替换原文，不复制库存或缓存结果；字段、callee／receiver、格式化及异常的先后保持原查询点。
 * 公开政策与请求贡献保留各自原输入，捕获不授予行动权限、扩大受众或替代状态 owner。
 */
import { type Locale } from "@ai-werewolf-arena/game-contract";
import { type RoleComponent } from "../../domain/components/role";
import { type World } from "../../domain/world";
import { COMPONENT } from "../../domain/components/names";
import { isAnimalDreamBoard, animalBeautyKnowledge } from "../animal-dream/ports";
import { getWolfBeautyState } from "./ports";
import { formatNativeRoleMessage as nativeText } from "@ai-werewolf-arena/game-presentation";

export const captureWolfBeautyPresentation = (
  role: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => {
  const state =
    world && isAnimalDreamBoard(world)
      ? animalBeautyKnowledge(
          world,
          world.entityIds().find((id) => world.getComponent(id, COMPONENT.Role) === role)!,
        )
      : getWolfBeautyState(role);
  return (
    nativeText(locale, "role.wolf_beauty.state") +
    " " +
    nativeText(
      locale,
      state &&
        "deathLinkPolicy" in state &&
        state.deathLinkPolicy === "heroes_s7_2017_exile_hunter_v1"
        ? "role.wolf_beauty.link_s7"
        : "role.wolf_beauty.link_awa",
    ) +
    " " +
    nativeText(locale, "role.wolf_beauty.latest", {
      target: state?.targetId ?? nativeText(locale, "common.none"),
      day: state?.lastActedDay ?? nativeText(locale, "common.none"),
    })
  );
};
