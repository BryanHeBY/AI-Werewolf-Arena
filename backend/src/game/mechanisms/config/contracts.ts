/** 文件说明：板子配置规范化器契约。 */
import { BoardConfig } from "../../../core/domain/model";

/** 单个规范化器定义。 */
export interface ConfigNormalizer {
  id: string;
  normalize(config: BoardConfig): BoardConfig;
}
