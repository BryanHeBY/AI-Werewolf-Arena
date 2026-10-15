/**
 * 负责按实际板子角色配置规范女巫扩展。输入为原 BoardConfig；输出为同一配置或去掉 witch 的浅副本。
 * 存在正数量女巫或无真值 witch 时保原对象，不克隆嵌套值、不安装角色，也不替代配置 schema 校验。
 */
import { BoardConfig, Role } from "../../../../domain/model";
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
