/** 文件说明：警长配置规范化器。 */
import { BoardConfig } from "../../../domain/model";
import { ConfigNormalizer } from "../config/contracts";

/** 警长配置规范化：警长关闭时移除 sheriff 相关扩展配置。 */
export const SHERIFF_CONFIG_NORMALIZER: ConfigNormalizer = {
  id: "sheriff_config_normalizer",
  normalize(config: BoardConfig): BoardConfig {
    if (config.enableSheriff) {
      return config;
    }
    const { sheriff: _removedSheriff, ...rest } = config;
    if (!rest.tieBreaker?.sheriffVote) {
      return rest;
    }
    const { sheriffVote: _removedSheriffTie, ...otherTie } = rest.tieBreaker;
    return {
      ...rest,
      ...(Object.keys(otherTie).length > 0 ? { tieBreaker: otherTie } : {}),
    };
  },
};
