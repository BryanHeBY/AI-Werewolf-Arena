/**
 * 负责规范自爆窗口配置的缺省表示。输入为原 BoardConfig；输出为原对象或去掉 selfDestruct 的浅副本。
 * enabledWindows 明确存在（包括空数组）即保原配置，缺失才删扩展；不打开窗口、校验行动或退款。
 */
import { BoardConfig } from "../../domain/model";
import { ConfigNormalizer } from "../../rulesets/configuration/contracts";

/** 显式空窗口保留禁用表达；字段缺失则删除该扩展，让默认机制按原 owner 决定。 */
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
