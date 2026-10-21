/**
 * 负责本机制原生角色提示的逐片段捕获及既有公开政策／请求展示贡献。输入为原角色组件、语言、原 World 引用和未执行的当前阵营 source；输出仍由共享展示包格式化。
 * 只读取本机制已授权的原生状态，不用赠予／借用能力替换原文，不复制库存或缓存结果；字段、callee／receiver、格式化及异常的先后保持原查询点。
 * 公开政策与请求贡献保留各自原输入，捕获不授予行动权限、扩大受众或替代状态 owner。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderWolfStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  if (request.context.wolf_kill_candidates !== undefined)
    return text(queries.locale(), "prompt.stage.wolf_kill_candidates", {
      candidates:
        request.context.wolf_kill_candidates.join(", ") || text(queries.locale(), "common.none"),
    });
  if (
    request.context.stage === "wolf_discussion" &&
    request.allowedTools.includes("speak_to_wolves")
  ) {
    const { round, max_rounds: maxRounds } = request.context;
    // 只呈现请求实际给出的有效轮次；旧请求缺少轮次时不猜测，也不据此改变阶段上限。
    if (
      typeof round === "number" &&
      typeof maxRounds === "number" &&
      Number.isSafeInteger(round) &&
      Number.isSafeInteger(maxRounds) &&
      round >= 1 &&
      round <= maxRounds
    )
      return text(queries.locale(), "prompt.stage.wolf_discussion_round", { round, maxRounds });
  }
}
import { type RoleComponent } from "../../domain/components/role";
import { type World } from "../../domain/world";
import { formatNativeRoleMessage as nativeText } from "@ai-werewolf-arena/game-presentation";

export const captureWolfPresentation = (
  _roleComp: RoleComponent,
  locale: Locale = "zh-CN",
  world?: World,
): string => nativeText(locale, "role.wolf.state");
