/**
 * 负责本族加成效果运行记录的唯一数组，按原 NightStageState 对象身份保存。
 * 输入是夜间状态、原种类／领取回执／可选印记；输出是同一记录与数组引用，不复制、冻结或序列化运行句柄。
 * 记录字段保持原可写性，receipt／marks 保留原引用与各自写权；具体回执的冻结仍归 frame，只读数组视图不额外深冻结。
 * 追加口仅取得数组，不提交回执或授予库存／行动权限。
 * 首次追加才建立数组；换状态对象不会继续旧夜记录，不读取或采纳旧 modifierBonusEffects 属性及其 getter。
 * 付款、原生命与当前性重验仍归本族阶段／frame；记录存在不代表已付、有效或已经造成死亡。
 */
import type { StatusMarksComponent } from "../../domain/components/status-marks";
import type { NightStageState } from "../../engine/night/contracts";
import type { ModifierBonusKind, ModifierBonusReceipt } from "./night-frame";

/** 三个原字段保持原类型与可变性；receipt／marks 是运行引用，不能移入玩家 DTO。 */
export interface ScholarMentorBonusEffectRecord {
  kind: ModifierBonusKind;
  receipt: ModifierBonusReceipt;
  marks?: StatusMarksComponent;
}

// 同一实际状态只有这一份数组；不在通用 NightStageState 字段上挂镜像或第二份索引。
const recordsByState = new WeakMap<NightStageState, ScholarMentorBonusEffectRecord[]>();

/** 未追加时返回原语义的临时空视图；查询不为状态预建记录，也不调用回执。 */
export function readScholarMentorBonusEffectRecords(
  state: NightStageState,
): readonly ScholarMentorBonusEffectRecord[] {
  return recordsByState.get(state) ?? [];
}

/** 原追加点先取得数组和 push callee，再创建效果条目；不提前捕获状态、回执或 marks。 */
export function scholarMentorBonusEffectRecordsForAppend(
  state: NightStageState,
): ScholarMentorBonusEffectRecord[] {
  let records = recordsByState.get(state);
  if (!records) {
    records = [];
    recordsByState.set(state, records);
  }
  return records;
}
