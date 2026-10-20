/**
 * 负责猎魔板原生女巫毒药的实际消耗证明与首波免疫来源定格。输入为原 World、能力与不透明 token；
 * 输出为当前消耗证明、毒免事实及猎杀结算，原先毒药后猎杀的冻结与拒绝顺序保持。
 * 本模块写自己的 pending／proof／spent 记录，实际库存写与原体资格仍由原女巫／authority 持有；
 * commit 只能复验已真实付款，不消费第二份库存。失效／失败保已消费前缀，不直接写 Alive 或授予新权限。
 */
import { types } from "node:util";
import { Role, WitchSelfHealRule, type World } from "../../domain";
import {
  demonNativePoisonFrame,
  demonHunterFreezeDay,
  freezeDemonHunt,
  type DemonNativePoisonFrame,
  type DemonHuntSettlement,
} from "./authority";
import {
  DEMON_HUNTER_POLICY,
  demonJson,
  demonSnapshot,
  exactDemonData,
  ownDemonData,
} from "./state-slot";
interface NativePoison {
  world: World;
  frame: Readonly<DemonNativePoisonFrame>;
  ability: object;
  state: object;
  source: object;
  expected: string;
  committed: boolean;
  frozen: boolean;
  proof: object | null;
}
const pending = new WeakMap<object, NativePoison>();
const proofs = new WeakMap<object, NativePoison>();
const spentAbilities = new WeakSet<object>();
const captures = new WeakMap<World, Map<number, object>>();
const abilityKeys = [
  "id",
  "kind",
  "state",
  "source",
  "sourceDisclosed",
  "startsOnDay",
  "maxUses",
  "uses",
  "lastUsedDay",
  "disabled",
] as const;
const stateKeys = [
  "heal",
  "poison",
  "selfHealRule",
  "canSelfHeal",
  "healUsedThisNight",
  "poisonUsedThisNight",
] as const;
/** 原生能力身份由已安装 World 提供；相等 source 元数据不能替代原对象许可。 */
export function captureDemonNativePoison(
  world: World,
  witchId: number,
  ability: object,
  targetId: number,
): object | null {
  const frame = demonNativePoisonFrame(world, witchId, ability, targetId);
  if (!frame || spentAbilities.has(ability) || captures.get(world)?.has(frame.day)) return null;
  try {
    const snapshot = demonSnapshot(ability);
    if (
      !exactDemonData(snapshot, abilityKeys) ||
      snapshot.id !== "native:potion" ||
      snapshot.kind !== "potion" ||
      !exactDemonData(snapshot.source, ["kind", "role"]) ||
      snapshot.source.kind !== "native" ||
      snapshot.source.role !== Role.Witch ||
      snapshot.sourceDisclosed !== true ||
      snapshot.startsOnDay !== 1 ||
      snapshot.maxUses !== null ||
      snapshot.disabled !== false ||
      !exactDemonData(snapshot.state, stateKeys)
    )
      return null;
    const state = snapshot.state;
    if (
      ![0, 1].includes(state.heal as number) ||
      state.poison !== 1 ||
      state.selfHealRule !== WitchSelfHealRule.Disabled ||
      state.canSelfHeal !== false ||
      state.healUsedThisNight !== false ||
      state.poisonUsedThisNight !== false ||
      snapshot.uses !== 1 - (state.heal as number) ||
      (snapshot.lastUsedDay !== null &&
        (!Number.isSafeInteger(snapshot.lastUsedDay) ||
          (snapshot.lastUsedDay as number) < 1 ||
          (snapshot.lastUsedDay as number) >= frame.day)) ||
      (snapshot.uses === 1 && snapshot.lastUsedDay === null)
    )
      return null;
    const expected = JSON.stringify({
      ...snapshot,
      state: { ...state, poison: 0, poisonUsedThisNight: true },
      uses: (snapshot.uses as number) + 1,
      lastUsedDay: frame.day,
    });
    const token = Object.freeze({});
    pending.set(token, {
      world,
      frame,
      ability,
      state: ownDemonData(ability, "state") as object,
      source: ownDemonData(ability, "source") as object,
      expected,
      committed: false,
      frozen: false,
      proof: null,
    });
    const slots = captures.get(world) ?? new Map<number, object>();
    slots.set(frame.day, token);
    captures.set(world, slots);
    return token;
  } catch {
    return null;
  }
}
/** 调用方先完成原合法库存写入；此处只复验并缓存实际消耗，不再次消费库存。 */
export function commitDemonNativePoison(token: object): object | null {
  const p = pending.get(token);
  if (
    !p ||
    p.committed ||
    p.frozen ||
    !p.frame.isCurrent() ||
    ownDemonData(p.ability, "state") !== p.state ||
    ownDemonData(p.ability, "source") !== p.source ||
    demonJson(p.ability) !== p.expected
  )
    return null;
  p.committed = true;
  spentAbilities.add(p.ability);
  p.frame.cacheConsumption();
  const proof = Object.freeze({});
  p.proof = proof;
  proofs.set(proof, p);
  return proof;
}
export interface DemonPoisonImmuneFact {
  readonly policy: typeof DEMON_HUNTER_POLICY;
  readonly actorId: number;
  readonly day: number;
  readonly witchId: number;
}
/** 必须在首波任何 Alive 写入前定格；frozen 先置位，后续拒绝仍保此前缀，成功事实才由原 Object.freeze 冻结。 */
export function freezeDemonNativePoison(proof: object): Readonly<DemonPoisonImmuneFact> | null {
  const p = proofs.get(proof);
  if (!p || p.frozen) throw new Error("demon_hunter_native_poison_proof_unavailable");
  p.frame.assertFreezeOpen();
  p.frozen = true;
  if (
    !p.committed ||
    !p.frame.isCurrent() ||
    ownDemonData(p.ability, "state") !== p.state ||
    ownDemonData(p.ability, "source") !== p.source ||
    demonJson(p.ability) !== p.expected
  )
    return null;
  return Object.freeze({
    policy: DEMON_HUNTER_POLICY,
    actorId: p.frame.actorId,
    day: p.frame.day,
    witchId: p.frame.witchId,
  });
}

export interface DemonNightSources {
  readonly hunt: Readonly<DemonHuntSettlement>;
  readonly poisonImmunities: readonly Readonly<DemonPoisonImmuneFact>[];
}
/** 原顺序先校验全部输入与完整性，再定格原生毒药来源、猎杀来源，调用方随后才写 Alive。 */
export function freezeDemonNightSources(
  world: World,
  sourceProofs: readonly object[],
  faultId: string | null = null,
): Readonly<DemonNightSources> {
  const day = demonHunterFreezeDay(world);
  if (types.isProxy(sourceProofs) || !Array.isArray(sourceProofs) || sourceProofs.length > 1)
    throw new Error("demon_hunter_source_proofs_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(sourceProofs);
  if (
    Reflect.ownKeys(descriptors).some((key) => typeof key !== "string") ||
    Object.keys(descriptors).length !== sourceProofs.length + 1
  )
    throw new Error("demon_hunter_source_proofs_invalid");
  const inputs: object[] = [];
  for (let i = 0; i < sourceProofs.length; i++) {
    const d = descriptors[i],
      value = d && "value" in d ? d.value : null;
    const p =
      value && typeof value === "object" && !types.isProxy(value) ? proofs.get(value) : undefined;
    if (!p || p.world !== world || p.frame.day !== day || p.frozen || !p.committed)
      throw new Error("demon_hunter_source_proofs_invalid");
    inputs.push(value);
  }
  const token = captures.get(world)?.get(day),
    registered = token ? pending.get(token) : undefined;
  const complete = registered?.committed ? [registered.proof] : [];
  if (inputs.length !== complete.length || !inputs.every((proof, i) => proof === complete[i]))
    throw new Error("demon_hunter_source_proofs_incomplete");
  const poisonImmunities = inputs
    .map(freezeDemonNativePoison)
    .filter((fact): fact is Readonly<DemonPoisonImmuneFact> => fact !== null);
  const hunt = freezeDemonHunt(world, faultId);
  return Object.freeze({ hunt, poisonImmunities: Object.freeze(poisonImmunities) });
}
