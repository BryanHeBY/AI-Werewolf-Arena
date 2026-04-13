/** 文件说明：自爆机制配置规范化器。 */
import { BoardConfig } from "../../../domain/model";
import { ConfigNormalizer } from "../config/contracts";

/** 自爆配置规范化：无窗口时移除 `selfDestruct` 配置节点。 */
export const SELF_DESTRUCT_CONFIG_NORMALIZER: ConfigNormalizer = {
  id: "self_destruct_config_normalizer",
  normalize(config: BoardConfig): BoardConfig {
    if (config.selfDestruct?.enabledWindows?.length) {
      return config;
    }
    const { selfDestruct: _removedSelfDestruct, ...rest } = config;
    return rest;
  },
};
