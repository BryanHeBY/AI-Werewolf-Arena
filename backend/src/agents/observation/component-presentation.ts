/**
 * 负责公开组件展示的实际工厂装配与读取。输入为原工厂参数、组件和显示语言；输出
 * 保持原组件引用、原默认语言及 getter／方法的顺序。唯一 WeakMap 只保存语言绑定，
 * 不复制库存；领域不携带文案方法。原生印记先计数，非空才调用原 values 并逐项格式化，
 * 所有失败保留已读取前缀。提示不授予行动或修改状态。
 */
import type { Camp, Locale } from "@ai-werewolf-arena/game-contract";
import { formatComponentPart } from "@ai-werewolf-arena/game-presentation";
import { createAliveComponent as createAliveData, type AliveComponent } from "../../domain/components/alive";
import { createBadgeComponent as createBadgeData, type BadgeComponent } from "../../domain/components/badge";
import { createCampComponent as createCampData, type CampComponent } from "../../domain/components/camp";
import { createVotingRightComponent as createVotingData, type VotingRightComponent } from "../../domain/components/voting-right";
import { createStatusMarksComponent as createMarksData, statusMarksSize, type StatusMarksComponent } from "../../domain/components/status-marks";

const displayLocales = new WeakMap<object, Locale>();
function bindLocale<T extends object>(component: T, locale: Locale): T {
  displayLocales.set(component, locale);
  return component;
}
function localeOf(component: object, locale: Locale | undefined): Locale {
  return locale === undefined
    ? (displayLocales.has(component) ? displayLocales.get(component)! : "zh-CN")
    : locale;
}

export function createAliveComponent(alive: boolean = true, locale: Locale = "zh-CN"): AliveComponent {
  return bindLocale(createAliveData(alive), locale);
}
export function createBadgeComponent(isSheriff: boolean = false, destroyed: boolean = false, locale: Locale = "zh-CN"): BadgeComponent {
  return bindLocale(createBadgeData(isSheriff, destroyed), locale);
}
export function createCampComponent(camp: Camp, locale: Locale = "zh-CN"): CampComponent {
  return bindLocale(createCampData(camp), locale);
}
export function createVotingRightComponent(weight: number = 1, canVote: boolean = true, locale: Locale = "zh-CN"): VotingRightComponent {
  return bindLocale(createVotingData(weight, canVote), locale);
}
export function createStatusMarksComponent(locale: Locale = "zh-CN"): StatusMarksComponent {
  return bindLocale(createMarksData(), locale);
}

export function renderAlivePrompt(component: AliveComponent, locale?: Locale): string {
  const currentLocale = localeOf(component, locale);
  return formatComponentPart({ kind: "alive", alive: component.alive }, currentLocale);
}
export function renderCampPrompt(component: CampComponent, locale?: Locale): string {
  const currentLocale = localeOf(component, locale);
  return formatComponentPart({ kind: "camp", camp: component.camp }, currentLocale);
}
export function renderBadgePrompt(component: BadgeComponent, locale?: Locale): string {
  const currentLocale = localeOf(component, locale);
  if (component.destroyed) return formatComponentPart({ kind: "badge-destroyed" }, currentLocale);
  if (component.isSheriff)
    return formatComponentPart({ kind: "badge-held", weight: component.voteWeight }, currentLocale);
  return formatComponentPart({ kind: "badge-none" }, currentLocale);
}
export function renderVotingRightPrompt(component: VotingRightComponent, locale?: Locale): string {
  const currentLocale = localeOf(component, locale);
  if (!component.canVote) return formatComponentPart({ kind: "vote-none" }, currentLocale);
  return formatComponentPart({ kind: "vote-weight", weight: component.weight }, currentLocale);
}
export function renderStatusMarksPrompt(component: StatusMarksComponent, locale?: Locale): string {
  const currentLocale = localeOf(component, locale);
  if (statusMarksSize(component) === 0)
    return formatComponentPart({ kind: "marks-none" }, currentLocale);
  return formatComponentPart({
    kind: "marks",
    marks: component.values()
      .map((mark) => formatComponentPart({ kind: "mark", mark }, currentLocale))
      .join(" "),
  }, currentLocale);
}
