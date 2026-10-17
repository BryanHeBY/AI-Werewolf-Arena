/**
 * 负责本机制的公开政策和当前请求提示；输入只读配置、已授权请求及语言查询，输出双语说明。
 * 不读取 World 或重新推导目标，保持原字段读取顺序；提示不授予技能或行动权限。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderAnimalDreamStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  if (request.context.fox_candidates)
    return text(queries.locale(), "prompt.stage.fox_candidates", {
      ids: request.context.fox_candidates.join(", "),
    });
}

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderAnimalDreamBoardRules(config: ReadonlyBoardConfig, locale: Locale): string[] {
  return config.animalDream
    ? [
        text(locale, "rules.animal_dream", {
          catPolicy: text(
            locale,
            config.whiteCat!.skippedVotePolicy === "awa_wait_for_actual_exile_v1"
              ? "animal.policy.cat_wait"
              : "animal.policy.cat_skip",
          ),
          ballotPolicy: text(
            locale,
            config.pufferfish!.ballotPolicy === "awa_first_ballot_v1"
              ? "animal.policy.puffer_first"
              : "animal.policy.puffer_final",
          ),
        }),
      ]
    : [];
}
