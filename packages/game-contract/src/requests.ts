/**
 * 负责行动请求及公共 context 的纯数据契约；输入为机器身份、玩家可见历史与中立消息引用，
 * 输出保留必填日次／阶段／事件／约束和可选机制附加字段，不包含 Provider 执行接口。
 * 字段、ID 和期限不创建租约或授予行动许可；实际请求原体由运行 owner 绑定、取消、关闭和撤权。
 * 本声明仅描述数据，不写库存或复活终态，不声明未知输入已解析，也不复制／冻结数组及嵌套数据。
 */
import type { MessageRef } from "./message-refs";
import type { EntityId, Phase, ActionWindow, KnightDuelWindow } from "./identity";
import type { ActionStage, ToolName, TurnConstraints } from "./actions";
import type { PlayerVisibleEvent } from "./events";
import type { DeathCause } from "./death-facts";

/** 可选附加字段由具体机制形成；工厂另供必填公共 context，候选名单／实例 ID 不是运行许可。 */
export interface ActionRequestExtras {
  crow_candidates?: readonly EntityId[];
  fox_candidates?: readonly EntityId[];
  fragrant_pair_candidates?: readonly EntityId[];
  pair_check_candidates?: readonly EntityId[];
  servant_candidates?: readonly EntityId[];
  secret_body_candidates?: readonly EntityId[];
  shelter_candidates?: readonly EntityId[];
  swallow_candidates?: readonly EntityId[];
  mist_candidates?: readonly EntityId[];
  wolf_kill_candidates?: readonly EntityId[];
  snake_target?: EntityId | null;
  snake_candidates?: readonly EntityId[];
  raven_candidates?: readonly EntityId[];
  modifier_poison_blocked?: boolean;
  modifier_modes?: readonly ("enhance" | "weaken")[];
  modifier_candidates?: readonly EntityId[];
  modifier_bonus_kind?: "check" | "guard" | "poison" | "kill";
  modifier_bonus_candidates?: readonly EntityId[];
  wolf_targets?: readonly EntityId[];
  consort_candidates?: readonly EntityId[];
  sorcerer_candidates?: readonly EntityId[];
  trickster_candidates?: readonly EntityId[];
  trickster_may_pass?: boolean;
  /** 原魔术师自己的未使用存活选择，属于该次私有请求知识，不向其他玩家自动公开。 */
  swap_candidates?: readonly EntityId[];
  proposedWitnessId?: EntityId;
  /** 显式严格回合区分合法可选等待与提交／传输失败；本字段不自行执行失败处理。 */
  action_failure_policy?: "error";
  /** 供调用方决定是否允许回退；有些必选动作要求明确失败，类型不生成替代行动。 */
  allow_fallback?: boolean;
  ability_id?: string;
  duel_window?: KnightDuelWindow;
  wall_id?: string;
  item_instance_id?: string;
  debate_id?: string;
  debate_target_id?: EntityId;
  debate_actor_id?: EntityId;
  wolf_target?: EntityId | null;
  trigger?: string;
  death_phase?: Phase;
  /** 原生狼王政策使用的来源阶段；death_phase 仍保原死亡波注记，两字段不合并。 */
  death_origin_phase?: Phase;
  death_sources?: DeathCause[];
  death_action_id?: number;
  /** 本次死亡行动的私有合法目标信息；名单不是公开死亡公告，也不替代提交前生命复验。 */
  shoot_candidates?: readonly EntityId[];
  sheriff_candidates?: EntityId[];
  badge_candidates?: readonly EntityId[];
  exile_candidates?: EntityId[];
  round?: number;
  max_rounds?: number;
  retry_attempt?: number;
  retry_max?: number;
  retry_reason?: string;
  retry_notice?: string;
  retry_notice_message?: MessageRef;
}

/** 正式请求的四项公共 context 必填；类型只声明存在，实际工厂填入并由各运行入口复验。 */
export interface ActionRequestContext extends ActionRequestExtras {
  day: number;
  stage: ActionStage;
  visible_events: PlayerVisibleEvent[];
  turn_constraints: TurnConstraints;
}

/** 原字段形状保持：工具／可见历史数组可写，复制数据不复制原 envelope 的身份或完成通知。 */
export interface ActionRequest {
  phase: Phase;
  actionWindow?: ActionWindow;
  actorId: EntityId;
  allowedTools: ToolName[];
  context: ActionRequestContext;
  /** 可选绝对期限数据；接受数值、最早预算和观察到期后的撤权由实际请求 owner 决定。 */
  deadlineAtMs?: number;
}
