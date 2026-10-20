/**
 * 负责按警长开关规范 sheriff 配置及平票扩展。输入为原 BoardConfig；输出为原对象或原分支的浅展开结果。
 * 只按原真值条件处理字段，不深克隆、安装警徽或配置投票权；枚举／读取抛错仍传播，已执行转换不回滚。
 */
import { BoardConfig } from "../../domain/model";
import { ConfigNormalizer } from "../../rulesets/configuration/contracts";

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
    // 仅otherTie非空才覆写tieBreaker；空时展开仍保rest原字段，不在注释中扩称完整深清理。
    return {
      ...rest,
      ...(Object.keys(otherTie).length > 0 ? { tieBreaker: otherTie } : {}),
    };
  },
};
