/**
 * 负责定义警徽持有、销毁、票重与转交政策的数据结构。输入为持徽和销毁标记，输出为原可写组件，工厂保留字段顺序与默认值，
 * 警徽规则仍由具体机制持有；本领域组件不绑定语言、不格式化提示或授予投票权。
 */

/**
 * 警徽组件：记录当前是否持有警徽以及是否已销毁。
 */
export interface BadgeComponent {
  isSheriff: boolean;
  destroyed: boolean;
  /** 票重属于警徽，转交后仍保留板子配置的权重。 */
  voteWeight: number;
  handoffPolicy?: import("../board").SheriffBadgePolicy;
}

/**
 * 创建警徽组件。
 */
export function createBadgeComponent(
  isSheriff: boolean = false,
  destroyed: boolean = false,
): BadgeComponent {
  return {
    isSheriff,
    destroyed,
    voteWeight: 1.5,
  };
}
