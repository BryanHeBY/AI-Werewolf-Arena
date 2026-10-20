/**
 * 负责一次经理执行的阶段修订号。输入为原 debug 撤销或真实阶段变化时点；
 * 输出为同一递增序号，供夜晚、白天和投票的当前性检查读取。
 * 只拥有原 revision 数值，不存 World、日期或阶段，不创建第二份运行状态。
 * 同阶段正常切换不推进；debug 跳转仍先推进，随后真实阶段变化可以再次推进。
 */
export class PhaseRevisionClock {
  private value = 0;

  /** 读取当前修订号，不推进业务时间或撤销资源。 */
  get current(): number {
    return this.value;
  }

  /** 调用者仍在原 ++ 时点推进；阶段写入、窗口关闭和事件的失败顺序归经理。 */
  advance(): void {
    this.value++;
  }
}
