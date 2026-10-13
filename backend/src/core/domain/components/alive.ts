/**
 * 负责原生命的存活值、版本及工厂描述符。输入为初始存活值和展示语言；
 * 输出保留同一组件对象，只有存活值发生变化时推进版本，以识别复活后的新生命。
 * 身份表与描述符留在运行时；机制可记录版本数字快照（如 debatePenalty.lifeVersion），
 * 该数字不携带原组件或授权，描述符查询不执行访问器。
 * 展示方法暂保原兼容接口，后续组件退出 PromptRenderable 时由展示贡献接替。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { PromptRenderable } from "../model";

/**
 * 存活状态组件：标记玩家是否仍在场。
 */
export interface AliveComponent extends PromptRenderable {
  alive: boolean;
}

// 身份表只关联原组件；相同席位替换组件不会继承旧生命版本。
const lifeVersions = new WeakMap<AliveComponent, number>();
const originalDescriptors = new WeakMap<AliveComponent, PropertyDescriptor>();
/** 返回工厂访问器描述符的脱离副本；检查身份不会调用 alive getter。 */
export function aliveLifeDescriptor(component: AliveComponent): PropertyDescriptor | undefined {
  const descriptor = originalDescriptors.get(component);
  return descriptor && { ...descriptor };
}
/** 查询原版本；非工厂组件返回 undefined，不能据席位号伪造原体身份。 */
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
      // 死亡和复活都会推进版本；重复写同一值不制造新的死亡资格。
      if (value !== alive) {
        alive = value;
        lifeVersions.set(component, lifeVersions.get(component)! + 1);
      }
    },
    renderPrompt(displayLocale: Locale = locale): string {
      return text(displayLocale, this.alive ? "component.alive" : "component.dead");
    },
  };
  originalDescriptors.set(component, Object.getOwnPropertyDescriptor(component, "alive")!);
  lifeVersions.set(component, 0);
  return component;
}
