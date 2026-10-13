/**
 * 提供馥郁双生具体夜间单元、死亡预约与事实发布的公开入口。
 * 输入是实际开启/关闭时点的原运行端口、receipt 和已提交死亡波；输出保留权威事实和清理顺序。
 * 准备、提交、取消与披露权限由原权威所有者验证，事实先于可失败记录，失败不退还已付资源。
 * publication 只拥有具体事实构造与发布边界；本入口不修改 Alive、不扩展关系或切换阶段。
 * 玩家投影与请求 scope 查询沿原调用位置执行，不缓存当前性或授予额外行动许可。
 */
export { FragrantNightUnit } from "./night-lifecycle";
export type { FragrantNightRuntime } from "./night-lifecycle";
export { isFragrantPairBoard, fragrantAuthoritySnapshot } from "./authority";
export { FRAGRANT_PAIR_POLICY } from "./state";

export { FragrantDeathWavePublication } from "./death-wave";
export {
  prepareFragrantDeathWave,
  commitFragrantDeathWave,
  publishFragrantDeathWave,
  cancelFragrantDeathWave,
} from "./authority";

export { fragrantPairRequestScope } from "./requests";
