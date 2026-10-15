/**
 * 负责板子配置规范化器的数据与调用契约；输入和输出都是原 BoardConfig 结构。
 * 具体机制拥有删改规则，registry 只按顺序串接结果；返回值可以保原引用，也可以是新对象。
 * 该接口不承诺纯函数、深复制、冻结或回滚，不能把规范化当作完整配置校验或运行权限。
 */
import { BoardConfig } from "../../../domain/model";

/** 同一 normalizer 对象作为方法 receiver；输入是上一规范化器实际返回的配置。 */
export interface ConfigNormalizer {
  /** 机制提供的标识；当前 registry 不按 id 去重、排序或授予写权。 */
  id: string;
  /** 方法可读写原配置或抛错；失败传播且后续规范化器不再运行，此前副作用不回滚。 */
  normalize(config: BoardConfig): BoardConfig;
}
