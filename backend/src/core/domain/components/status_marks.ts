import { text, type Locale, type MessageKey } from "@ai-werewolf-arena/game-text";
import { PromptRenderable, StatusMark } from "../model";

/**
 * 状态印记组件：
 * 用于承载当回合临时效果（守护、狼刀、解药、毒药），由结算系统统一消费。
 */
export class StatusMarksComponent implements PromptRenderable {
  private marks: Set<StatusMark>;

  constructor(initialMarks: StatusMark[] = [], private readonly locale: Locale = "zh-CN") {
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
  renderPrompt(locale: Locale = this.locale): string {
    if (this.marks.size === 0) return text(locale, "component.marks_none");
    return text(locale, "component.marks", { marks: this.values().map(mark => text(locale, `component.mark.${mark}` as MessageKey)).join(" ") });
  }
}

/**
 * 创建状态印记组件。
 */
export function createStatusMarksComponent(locale: Locale = "zh-CN"): StatusMarksComponent {
  return new StatusMarksComponent([], locale);
}
