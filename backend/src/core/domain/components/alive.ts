import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { PromptRenderable } from "../model";

/**
 * 存活状态组件：标记玩家是否仍在场。
 */
export interface AliveComponent extends PromptRenderable {
  alive: boolean;
}

const lifeVersions = new WeakMap<AliveComponent, number>();
export function aliveLifeVersion(component: AliveComponent): number | undefined {
  return lifeVersions.get(component);
}

/**
 * 创建存活状态组件。
 */
export function createAliveComponent(
  alive: boolean = true,
  locale: Locale = "zh-CN",
): AliveComponent {
  const component: AliveComponent = {
    get alive() {
      return alive;
    },
    set alive(value: boolean) {
      if (typeof value !== "boolean") throw new Error("alive_state_invalid");
      if (value !== alive) {
        alive = value;
        lifeVersions.set(component, lifeVersions.get(component)! + 1);
      }
    },
    renderPrompt(displayLocale: Locale = locale): string {
      return text(displayLocale, this.alive ? "component.alive" : "component.dead");
    },
  };
  lifeVersions.set(component, 0);
  return component;
}
