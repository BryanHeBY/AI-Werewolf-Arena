/**
 * 负责女巫原生双药组合、刀口可见性与第二回合的纯政策查询。输入为原药实例及实际夜数；
 * 输出保留原字段读取顺序的布尔值。复制／赠与实例仍按自己的契约；这些查询不付款、关回合、写来源或授提交能力。
 */
import { Role } from "../../domain/model";
import type { NightAbilityReadView } from "../night-abilities/abilities";
/** 只有原生来源使用这项产品政策；复制／赠与瓶仍保自己的契约，不在此补成原生。 */
export function nativePotionsCanCombine(ability: NightAbilityReadView<"potion">): boolean {
  return (
    ability.source.kind === "native" &&
    ability.state.potionPolicy === "awa_both_native_experimental_v1"
  );
}
export function witchKnifeVisible(ability: NightAbilityReadView<"potion">): boolean {
  const policy =
    ability.source.kind === "native" && ability.source.role === Role.Witch
      ? ability.state.knifeVisibility
      : undefined;
  if (policy === "awa_always_v1") return true;
  return (
    ability.state.heal > 0 &&
    !ability.state.healUsedThisNight &&
    (nativePotionsCanCombine(ability) || !ability.state.poisonUsedThisNight)
  );
}
export function nativePotionSecondTurn(
  ability: NightAbilityReadView<"potion">,
  day: number,
): boolean {
  return (
    nativePotionsCanCombine(ability) &&
    ability.state.potionTurnClosedDay !== day &&
    ((ability.state.healUsedThisNight &&
      !ability.state.poisonUsedThisNight &&
      ability.state.poison > 0) ||
      (ability.state.poisonUsedThisNight &&
        !ability.state.healUsedThisNight &&
        ability.state.heal > 0))
  );
}
