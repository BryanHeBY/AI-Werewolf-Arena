/**
 * 负责定义投票资格与票重数据结构。输入为原权重与资格，输出为原可写组件，工厂保留默认值及字段顺序；
 * 投票结算仍归具体机制，展示语言及文案由游戏观察层绑定，组件不格式化或授权。
 */

/**
 * 投票权组件：记录是否可投票与票重。
 */
export interface VotingRightComponent {
  weight: number;
  canVote: boolean;
}

/**
 * 创建投票权组件。
 */
export function createVotingRightComponent(
  weight: number = 1,
  canVote: boolean = true,
): VotingRightComponent {
  return {
    weight,
    canVote,

  };
}
