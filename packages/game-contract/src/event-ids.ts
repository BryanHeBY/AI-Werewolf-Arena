/**
 * 负责维护公共配置使用的事件包、事件与物品 ID。输入为既定协议值，输出原有的单项列表与类型。
 * 列表只提供机器标识，具体目录元数据、组合支持和事件实现另有所有者；as const 不执行注册、冻结或授权。
 */
export const EVENT_PACK_IDS = ["awa_wall_notes_once_v1"] as const;
export const EVENT_IDS = ["awa_wall_notes_v1"] as const;
export const ITEM_IDS = ["anonymous_note"] as const;
