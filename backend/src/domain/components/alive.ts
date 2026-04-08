import { PromptRenderable } from "../model";

export interface AliveComponent extends PromptRenderable {
  alive: boolean;
}

export function createAliveComponent(alive: boolean = true): AliveComponent {
  return {
    alive,
    renderPrompt(): string {
      return this.alive ? "你当前仍存活。" : "你当前已出局。";
    },
  };
}
