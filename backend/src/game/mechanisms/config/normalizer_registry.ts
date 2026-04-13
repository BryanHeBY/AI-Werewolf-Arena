/** 文件说明：板子配置规范化注册表。 */
import { BoardConfig } from "../../../core/domain/model";
import { ConfigNormalizer } from "./contracts";
import { SHERIFF_CONFIG_NORMALIZER } from "../sheriff/config_normalizer";
import { WITCH_CONFIG_NORMALIZER } from "../roles/witch/config_normalizer";
import { SELF_DESTRUCT_CONFIG_NORMALIZER } from "../self_destruct/config_normalizer";

/** 默认配置规范化器顺序（从机制/角色模块聚合）。 */
const DEFAULT_NORMALIZERS: ConfigNormalizer[] = [
  WITCH_CONFIG_NORMALIZER,
  SHERIFF_CONFIG_NORMALIZER,
  SELF_DESTRUCT_CONFIG_NORMALIZER,
];

/** 配置规范化注册表。 */
export class ConfigNormalizerRegistry {
  constructor(private readonly normalizers: ConfigNormalizer[] = DEFAULT_NORMALIZERS) {}

  /** 按注册顺序依次执行规范化。 */
  normalize(config: BoardConfig): BoardConfig {
    return this.normalizers.reduce(
      (current, normalizer) => normalizer.normalize(current),
      config,
    );
  }
}

let defaultRegistry: ConfigNormalizerRegistry | null = null;

/** 获取默认规范化注册表。 */
export function getDefaultConfigNormalizerRegistry(): ConfigNormalizerRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ConfigNormalizerRegistry();
  }
  return defaultRegistry;
}
