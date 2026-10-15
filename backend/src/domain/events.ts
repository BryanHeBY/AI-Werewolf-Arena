/**
 * 负责为引擎消费者保留序列化事件的具名兼容入口。输入来自公开契约，输出原事件映射、受众类型与狼队事件列表绑定。
 * 事件存储、发表、玩家投影及 Node 入口的危险对象拒绝各有其所有者；导入声明不验证实时许可或执行事件效果。
 */
export { WOLF_TEAM_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/events";
export type {
  EventBase,
  VoteRecord,
  SheriffVoteRecord,
  PrivatePlayerInfo,
  ExileFeedback,
  EventPayloadMap,
  WolfTeamEventType,
  WeddingEventType,
  GameEvent,
  PlayerVisibleEvent,
} from "@ai-werewolf-arena/game-contract/events";
