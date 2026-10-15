/**
 * 负责白昼学者／寂夜导师原十二人有限板的修饰结算规则。输入为原玩家数据与已提交选择；
 * 输出为冲突死亡、好人技能修饰、额外狼刀和禁刀数据，不拥有 World、库存、生命或提交许可。
 * 不变量：原列牌、阵营和双施法者约束不变，免疫先于碰撞，遍历／首失败及结果字段顺序保留。
 * 此纯规则不追加历史、写 bonus 记录、付款或关闭；frame 在原时点校验原体并采纳结果。
 */
import type {
  ModifierCaster,
  ModifierPlayer,
  CommittedModifier,
  ModifierResolution,
} from "@ai-werewolf-arena/game-contract";

/** 有限板规则：先排除两位施法者免疫目标，再按原 selection 顺序处理碰撞；不读 World 或付款。 */
export function resolveModifiers(
  players: readonly ModifierPlayer[],
  selections: readonly CommittedModifier[],
): ModifierResolution {
  const roster = new Map(players.map((player) => [player.id, player]));
  if (
    roster.size !== players.length ||
    players.some((p) => !Number.isSafeInteger(p.id) || p.id < 1)
  )
    throw new Error("modifier_roster_invalid");
  const deck: Record<string, { count: number; camp: "good" | "wolf" }> = {
    wolf: { count: 3, camp: "wolf" },
    night_mentor: { count: 1, camp: "wolf" },
    villager: { count: 4, camp: "good" },
    day_scholar: { count: 1, camp: "good" },
    seer: { count: 1, camp: "good" },
    guard: { count: 1, camp: "good" },
    witch: { count: 1, camp: "good" },
  };
  if (
    players.length !== 12 ||
    players.some((p) => !Object.hasOwn(deck, p.role) || deck[p.role]!.camp !== p.camp) ||
    Object.entries(deck).some(
      ([role, spec]) => players.filter((p) => p.role === role).length !== spec.count,
    )
  )
    throw new Error("modifier_roster_invalid");
  const actors = new Set<number>(),
    casters = new Set<ModifierCaster>();
  const effective: CommittedModifier[] = [];
  for (const selection of selections) {
    const actor = roster.get(selection.actorId),
      target = roster.get(selection.targetId);
    if (
      !actor?.alive ||
      !target?.alive ||
      actor.role !== selection.caster ||
      (selection.caster !== "day_scholar" && selection.caster !== "night_mentor") ||
      actor.camp !== (selection.caster === "day_scholar" ? "good" : "wolf") ||
      (selection.mode !== "enhance" && selection.mode !== "weaken") ||
      actors.has(actor.id) ||
      casters.has(selection.caster)
    )
      throw new Error("modifier_selection_invalid");
    actors.add(actor.id);
    casters.add(selection.caster);
    // 免疫先于碰撞；只复制仍有效的选择，原 selections／roster 不写。
    if (target.role !== "day_scholar" && target.role !== "night_mentor")
      effective.push({ ...selection });
  }
  const out: ModifierResolution = {
    pendingDeaths: [],
    conflict: null,
    goodEffects: [],
    bonusKnifeActorId: null,
    blockWolfKnife: false,
  };
  // 同一好人优先；两项有效选择的目标均为狼时，不论同一或不同目标均按原导师死亡分支。
  if (effective.length === 2) {
    const [a, b] = effective as [CommittedModifier, CommittedModifier];
    const first = roster.get(a.targetId)!,
      second = roster.get(b.targetId)!;
    if (first.camp === "good" && first.id === second.id) {
      out.pendingDeaths = [first.id];
      out.conflict = "same_good";
      return out;
    }
    if (first.camp === "wolf" && second.camp === "wolf") {
      out.pendingDeaths = [effective.find((s) => s.caster === "night_mentor")!.actorId];
      out.conflict = "both_wolves";
      return out;
    }
  }
  for (const selection of effective) {
    const target = roster.get(selection.targetId)!;
    if (target.camp === "wolf") {
      if (selection.mode === "weaken") out.blockWolfKnife = true;
      else out.bonusKnifeActorId = target.id;
    } else if (target.role === "seer" || target.role === "guard" || target.role === "witch") {
      out.goodEffects.push({ targetId: target.id, role: target.role, mode: selection.mode });
    }
  }
  return out;
}
