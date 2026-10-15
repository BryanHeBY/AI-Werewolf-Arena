/**
 * 负责猎魔人有限板子检查的 Node 输入边界。输入为未知候选值，
 * 输出为原支持布尔值；数据快照或判定抛错均转换为 false。
 * snapshotPlainData 在反射前拒绝 Proxy，保留深度 16、数组上限 256 与原错误码；
 * 之后的纯数据判定仍应用自身原有限边界，不安装状态、授予租约或支付资源。
 */
import { snapshotPlainData } from "../core/domain/plain_data";
import { isDemonHunterPreset as readPreset } from "./support";

export function isDemonHunterPreset(input: unknown): boolean {
  try {
    return readPreset(
      snapshotPlainData(input, new Set<object>(), 0, 256, "demon_hunter_data_invalid"),
    );
  } catch {
    return false;
  }
}
