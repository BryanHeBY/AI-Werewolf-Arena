import { PromptRenderable } from "../model";

/**
 * 存活状态组件：标记玩家是否仍在场。
 */
export interface AliveComponent extends PromptRenderable {
  alive: boolean;
}

/**
 * 创建存活状态组件。
 */
export function createAliveComponent(alive: boolean = true): AliveComponent {
  return {
    alive,
    renderPrompt(): string {
      return this.alive ? "你当前仍存活。" : "你当前已出局。";
    },
  };
}
