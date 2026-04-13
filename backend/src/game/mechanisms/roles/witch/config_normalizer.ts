/** 文件说明：女巫配置规范化器（仅当板子包含女巫时保留角色配置）。 */
import { BoardConfig, Role } from "../../../../core/domain/model";
import { ConfigNormalizer } from "../../config/contracts";

/** 女巫配置规范化：仅当板子存在女巫时保留 `config.witch`。 */
export const WITCH_CONFIG_NORMALIZER: ConfigNormalizer = {
  id: "witch_config_normalizer",
  normalize(config: BoardConfig): BoardConfig {
    const hasWitch = config.roleSetups.some(
      (setup) => setup.role === Role.Witch && setup.count > 0,
    );
    if (hasWitch || !config.witch) {
      return config;
    }
    const { witch: _removedWitch, ...rest } = config;
    return rest;
  },
};
