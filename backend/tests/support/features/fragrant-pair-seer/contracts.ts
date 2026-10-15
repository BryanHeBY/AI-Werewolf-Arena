/**
 * 定义公开测试支持使用的原计划数据契约；输入为明确编写的回合、行动者及场景数据，类型保留原可空选择、来源字段与精确回调签名。此模块不分配或计算游戏、模型、文件系统资源、实时许可或结果预期。
 */


export interface FragrantRuntimePlan {
  bind?: readonly [number, number] | null;
  knife?: number | null;
  poison?: number | null;
  exile?: number | null;
  sheriff?: number | null;
  shoot?: number | null;
  badge?: number | null;
}
