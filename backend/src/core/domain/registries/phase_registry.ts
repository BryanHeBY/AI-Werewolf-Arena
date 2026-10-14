/**
 * 负责阶段顺序数组的保存与替换；输入阶段列表，输出当前顺序的独立浅副本。
 * 构造、登记与读取都复制数组，阶段值保持原顺序，不去重或校验支持范围。
 * 本表只持有配置，不推进阶段、执行 hook 或关闭对局。
 */
import { Phase } from "../model";

/**
 * 阶段顺序注册表：支持按板子动态替换默认 phase 顺序。
 */
export class PhaseRegistry {
  private order: Phase[];

  constructor(order: Phase[] = [Phase.Night, Phase.Day, Phase.Voting]) {
    this.order = [...order];
  }

  /**
   * 返回新数组，调用方修改列表不改写 registry 的当前顺序。
   */
  getOrder(): Phase[] {
    return [...this.order];
  }

  /**
   * 用新副本覆盖全部顺序；传入数组之后的修改不影响保存值。
   */
  registerOrder(order: Phase[]): void {
    this.order = [...order];
  }
}
