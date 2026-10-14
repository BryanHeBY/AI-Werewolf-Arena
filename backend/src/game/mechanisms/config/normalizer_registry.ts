/**
 * 负责有序串接板子配置规范化；输入原配置与规范化器数组，输出最后一个实际返回值。
 * 默认依次执行女巫、警长、自爆规则；每次调用保 normalizer 方法 receiver 和前一步配置引用。
 * 抛错即停止后续处理，已发生的读取／写入不回滚；此 registry 不替具体机制重写规则或校验权限。
 */
import { BoardConfig } from "../../../core/domain/model";
import { ConfigNormalizer } from "./contracts";
import { SHERIFF_CONFIG_NORMALIZER } from "../sheriff/config_normalizer";
import { WITCH_CONFIG_NORMALIZER } from "../roles/witch/config_normalizer";
import { SELF_DESTRUCT_CONFIG_NORMALIZER } from "../self_destruct/config_normalizer";

/** 顺序固定为 Witch → Sheriff → SelfDestruct；规则对象是原模块引用，不在此复制其字段。 */
const DEFAULT_NORMALIZERS: ConfigNormalizer[] = [
  WITCH_CONFIG_NORMALIZER,
  SHERIFF_CONFIG_NORMALIZER,
  SELF_DESTRUCT_CONFIG_NORMALIZER,
];

/** 实例保传入数组同引用；readonly 仅限制字段重新赋值，不冻结数组或处理器。 */
export class ConfigNormalizerRegistry {
  constructor(private readonly normalizers: ConfigNormalizer[] = DEFAULT_NORMALIZERS) {}

  /**
   * 原 config 作为 reduce 初值；空数组原样返回。每次读取 normalize 后以该对象为 receiver 调用，
   * 参数是前一实际结果；getter／处理函数抛错原样传播，不运行后续项或做补偿。
   */
  normalize(config: BoardConfig): BoardConfig {
    return this.normalizers.reduce((current, normalizer) => normalizer.normalize(current), config);
  }
}

let defaultRegistry: ConfigNormalizerRegistry | null = null;

/** 首次调用才创建并缓存默认 registry；获取实例不执行规范化，失败时不会预先写入默认缓存。 */
export function getDefaultConfigNormalizerRegistry(): ConfigNormalizerRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ConfigNormalizerRegistry();
  }
  return defaultRegistry;
}
