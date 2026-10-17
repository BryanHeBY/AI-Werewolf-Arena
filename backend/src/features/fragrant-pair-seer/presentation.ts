/**
 * 负责本机制的公开政策和当前请求提示；输入只读配置、已授权请求及语言查询，输出双语说明。
 * 不读取 World 或重新推导目标，保持原字段读取顺序；提示不授予技能或行动权限。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderFragrantPairStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  const pairCandidates =
    request.context.fragrant_pair_candidates ?? request.context.pair_check_candidates;
  if (pairCandidates)
    return text(queries.locale(), "prompt.stage.fragrant_pair_candidates", {
      ids: pairCandidates.join(", "),
    });
}
