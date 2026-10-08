/** 文件说明：自爆机制配置规范化器。 */
import { BoardConfig } from "../../../core/domain/model";
import { ConfigNormalizer } from "../config/contracts";

/** Explicit empty windows disable the mechanism; absence keeps the default. */
export const SELF_DESTRUCT_CONFIG_NORMALIZER: ConfigNormalizer = {
  id: "self_destruct_config_normalizer",
  normalize(config: BoardConfig): BoardConfig {
    if (config.selfDestruct?.enabledWindows !== undefined) {
      return config;
    }
    const { selfDestruct: _removedSelfDestruct, ...rest } = config;
    return rest;
  },
};
