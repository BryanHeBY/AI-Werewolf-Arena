import { PromptRenderable, StatusMark } from "../model";

/**
 * 状态印记组件：
 * 用于承载当回合临时效果（守护、狼刀、解药、毒药），由结算系统统一消费。
 */
export class StatusMarksComponent implements PromptRenderable {
  private marks: Set<StatusMark>;

  constructor(initialMarks: StatusMark[] = []) {
    this.marks = new Set(initialMarks);
  }

  /**
   * 添加指定状态印记。
   */
  add(mark: StatusMark): void {
    this.marks.add(mark);
  }

  /**
   * 判断是否存在指定状态印记。
   */
  has(mark: StatusMark): boolean {
    return this.marks.has(mark);
  }

  /**
   * 移除指定状态印记。
   */
  remove(mark: StatusMark): void {
    this.marks.delete(mark);
  }

  /**
   * 清空当前全部状态印记。
   */
  clear(): void {
    this.marks.clear();
  }

  /**
   * 返回当前全部状态印记列表。
   */
  values(): StatusMark[] {
    return [...this.marks];
  }

  /**
   * 将状态印记渲染为可读文本片段。
   */
  renderPrompt(): string {
    if (this.marks.size === 0) {
      return "你当前没有状态印记。";
    }

    const map: Record<StatusMark, string> = {
      [StatusMark.GuardMark]: "[守护印记]",
      [StatusMark.WolfKillMark]: "[狼刀印记]",
      [StatusMark.HealMark]: "[解药印记]",
      [StatusMark.PoisonMark]: "[毒药印记]",
    };

    return `你当前持有状态：${this.values()
      .map((mark) => map[mark])
      .join(" ")}`;
  }
}

/**
 * 创建状态印记组件。
 */
export function createStatusMarksComponent(): StatusMarksComponent {
  return new StatusMarksComponent();
}
