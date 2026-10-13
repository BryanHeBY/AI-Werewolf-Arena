/**
 * 提供狼美人状态及具体关系触发的公开入口。输入为原角色、安装数据或未领取牵连 proposal；
 * 输出保留原引用、初始化契约及 claimed／blocked／applied 回执。字段写权、原体和来源政策
 * 由实际 state／relation owner 持有，engine 仍标死及发布事件；本入口仅具名导出真实函数，
 * 领取发生于原死亡 hook 之后、追加死因之前，原体标死之后才提交 applied。
 * 阻断／失效是该次触发的终态，不恢复已付领取；本入口不增加查询或第二份状态。
 * 规则见 docs/expansion/rules/awa-wolf-beauty-v1.md。
 */
export { getWolfBeautyState, setWolfBeautyState } from "./state";
export { attemptCharmTrigger, commitCharmDeath } from "./relation";
export type {
  CharmBinding,
  CharmClaimReceipt,
  CharmBlockedReceipt,
  CharmAppliedReceipt,
  CharmProtectionReceipt,
} from "./relation";
