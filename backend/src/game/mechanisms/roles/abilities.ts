/**
 * 负责普通夜能力的实例映射、只读查询、状态判定、数据复制与玩家投影。
 * 输入为原实例引用、明确日期和数据字段；输出保留深只读 live 引用或独立玩家 DTO。
 * 原生安装、起效日与次数提交已归 ability_changes；本模块不写实际实例槽、库存或阶段。
 * Pair 纯数据规范化由同一实际函数供安装及投影使用，不从真实阵营推断玩家知识。
 * 共同元数据与玩家 DTO 类型归公共契约；status 标签不代替原许可或提交前复验。
 */

import type {
  PairSeerState,
  RoleInspectionReadState,
  NightAbilityStates,
  RoleInspectionPolicy,
  NightAbilityKind,
  AbilitySource,
  NightAbilityReadStates,
} from "@ai-werewolf-arena/game-contract";
import { readPairSeerState } from "./fragrant_pair_seer/state";
import { projectShelterState } from "./radiant_eclipse/shelter-state";
import { INSPECTION_POLICIES } from "../../../core/domain/board";
import { nativePotionSecondTurn } from "./witch/policies";
import { Role, type EventPayloadMap } from "../../../core/domain/model";
import type { RoleComponent } from "../../../core/domain/components/role";
import { COMPONENT } from "../../../core/domain/components/names";
import {
  projectDreamerState,
  projectGuardState,
  projectRoleInspectionState,
  projectSeerState,
  projectWitchState,
} from "./player_state";
import type {
  NightAbilityMetadata,
  AbilityStatus,
  PlayerNightAbilityStates,
  PlayerNightAbility,
} from "@ai-werewolf-arena/game-contract/night-ability-views";
export { projectRoleInspectionState, projectSeerState, projectWitchState } from "./player_state";


export const ROLE_INSPECTION_POLICY_ROLES: Readonly<Record<RoleInspectionPolicy, Role>> = {
  gargoyle: Role.Gargoyle,
  psychic: Role.Psychic,
  mirror: Role.MirrorGirl,
  pure_white: Role.PureWhiteGirl,
  wolf_witch: Role.WolfWitch,
};


/** Pair 初始化和玩家投影共享此原纯数据校验；不读实例、World 或授予能力权限。 */
export function projectPairState(value: unknown): PairSeerState {
  const state = readPairSeerState(value);
  if (!state) throw Error("fragrant_pair_state_invalid");
  return state;
}
/** 仅投影当前来源 kind 明确授权的字段，不公开未披露源的真实身份。 */
export function projectAbilitySource(
  origin: EventPayloadMap["ability_changed"]["source"],
  disclosed: boolean,
): EventPayloadMap["ability_changed"]["source"] | { kind: AbilitySource["kind"] } {
  return !disclosed
    ? { kind: origin.kind }
    : origin.kind === "native"
      ? { kind: origin.kind, role: origin.role }
      : origin.kind === "gift"
        ? { kind: origin.kind, actorId: origin.actorId }
        : { kind: origin.kind, actorId: origin.actorId, abilityId: origin.abilityId };
}
type NightAbilityUnion = {
  [P in NightAbilityKind]: NightAbilityMetadata & {
    kind: P;
    state: NightAbilityStates[P];
  };
}[NightAbilityKind];
export type NightAbility<K extends NightAbilityKind = NightAbilityKind> = Extract<
  NightAbilityUnion,
  { kind: K }
>;
type NightAbilityReadUnion = {
  [K in NightAbilityKind]: Readonly<
    Omit<NightAbility<K>, "state" | "source" | "nightSuppression">
  > & {
    readonly state: NightAbilityReadStates[K];
    readonly source: Readonly<AbilitySource>;
    readonly nightSuppression?: Readonly<
      import("@ai-werewolf-arena/game-contract").EclipseSuppression
    >;
  };
}[NightAbilityKind];
export type NightAbilityReadView<K extends NightAbilityKind = NightAbilityKind> = Extract<
  NightAbilityReadUnion,
  { kind: K }
>;
/** 玩家 DTO 对应显式投影，包含已知梦历史，不继承内部状态的其他字段。 */
export function projectNightState(
  ability: NightAbilityReadView,
): PlayerNightAbilityStates[NightAbilityKind] {
  switch (ability.kind) {
    case "pair_check":
      return projectPairState(ability.state);
    case "shelter":
      return projectShelterState(ability.state);
    case "seer_check":
      return projectSeerState(ability.state);
    case "potion":
      return projectWitchState(ability.state);
    case "role_check":
      return projectRoleInspectionState(ability.state);
    case "guard":
      return projectGuardState(ability.state);
    case "dream":
      return projectDreamerState(ability.state);
  }
}

/** 复制有效 JSON 数据；可选 undefined 字段在落盘形状中保持缺失，不改 live 实例。 */
export function copyAbilityData<T>(value: T): T {
  const result = structuredClone(value),
    ancestors = new WeakSet<object>();
  const visit = (item: unknown): void => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || !item || ancestors.has(item))
      throw new Error("ability_state_not_json");
    ancestors.add(item);
    if (Array.isArray(item)) {
      for (let index = 0; index < item.length; index++) {
        if (!Object.hasOwn(item, index)) throw new Error("ability_state_not_json");
        visit(item[index]);
      }
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null)
        throw new Error("ability_state_not_json");
      for (const [key, entry] of Object.entries(item)) {
        if (entry === undefined) delete (item as Record<string, unknown>)[key];
        else visit(entry);
      }
    }
    ancestors.delete(item);
  };
  visit(result);
  return result;
}

/** 资源只归该玩家实际库存中的实例，不另建并行角色状态。 */
export function allNightAbilities(role: RoleComponent | undefined): NightAbilityReadView[] {
  const stored = (role as { readonly privateState: { readonly abilities?: unknown } } | undefined)
    ?.privateState.abilities as Readonly<Record<string, NightAbilityReadView>> | undefined;
  return stored
    ? Object.values(stored).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    : [];
}

/** 检查原 nightSuppression 描述符，畸形或访问器保持 blocked，不调用该字段 getter。 */
function nightAbilityDisabled(ability: NightAbilityReadView): boolean {
  const blocker = Object.getOwnPropertyDescriptor(ability, "nightSuppression");
  return ability.disabled || (!!blocker && (!("value" in blocker) || blocker.value !== undefined));
}

export function abilityStatus(ability: NightAbilityReadView, day: number): AbilityStatus {
  if (nightAbilityDisabled(ability) || ability.deathExpired) return "disabled";
  if (day < ability.startsOnDay) return "pending";
  if (ability.expiresAfterDay !== undefined && day > ability.expiresAfterDay) return "expired";
  if (ability.maxUses !== null && ability.uses >= ability.maxUses) return "spent";
  if (
    ability.lastUsedDay === day &&
    !(ability.kind === "potion" && nativePotionSecondTurn(ability, day))
  )
    return "used_this_night";
  if (
    ability.kind === "potion" &&
    ability.source.kind === "native" &&
    ability.source.role === Role.Witch &&
    ability.state.potionPolicy === "awa_both_native_experimental_v1" &&
    ability.state.potionTurnClosedDay === day
  )
    return "used_this_night";
  return "active";
}

export function findNightAbility<K extends NightAbilityKind>(
  role: RoleComponent | undefined,
  kind: K,
  id?: string,
): NightAbilityReadView<K> | undefined {
  const candidates = allNightAbilities(role).filter(
    (ability): ability is NightAbilityReadView<K> => ability.kind === kind,
  );
  if (id !== undefined) return candidates.find((ability) => ability.id === id);
  // 原调用者优先选原生实例；仅有一份明确受赠实例时才采用该实例。
  return (
    candidates.find((ability) => ability.source.kind === "native") ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

export function activeNightAbility<K extends NightAbilityKind>(
  role: RoleComponent | undefined,
  kind: K,
  day: number,
  id?: string,
): NightAbilityReadView<K> | undefined {
  const ability = findNightAbility(role, kind, id);
  return ability && abilityStatus(ability, day) === "active" ? ability : undefined;
}

export function projectNightAbility(
  ability: NightAbilityReadView,
  day: number,
): PlayerNightAbility {
  const metadata = {
    id: ability.id,
    source: projectAbilitySource(ability.source, ability.sourceDisclosed),
    startsOnDay: ability.startsOnDay,
    ...(ability.expiresAfterDay === undefined ? {} : { expiresAfterDay: ability.expiresAfterDay }),
    maxUses: ability.maxUses,
    uses: ability.uses,
    lastUsedDay: ability.lastUsedDay,
    disabled: nightAbilityDisabled(ability),
    ...(ability.activation === undefined ? {} : { activation: ability.activation }),
    ...(ability.deathExpired === undefined ? {} : { deathExpired: ability.deathExpired }),
    status: abilityStatus(ability, day),
  };
  switch (ability.kind) {
    case "pair_check":
      return { ...metadata, kind: "pair_check", state: projectPairState(ability.state) };
    case "shelter":
      return { ...metadata, kind: "shelter", state: projectShelterState(ability.state) };
    case "seer_check":
      return { ...metadata, kind: "seer_check", state: projectSeerState(ability.state) };
    case "potion":
      return { ...metadata, kind: "potion", state: projectWitchState(ability.state) };
    case "role_check":
      return { ...metadata, kind: "role_check", state: projectRoleInspectionState(ability.state) };
    case "guard":
      return { ...metadata, kind: "guard", state: projectGuardState(ability.state) };
    case "dream":
      return { ...metadata, kind: "dream", state: projectDreamerState(ability.state) };
  }
}

/** 读取原退休 ID 列表，不授予库存写权限。 */
export function retiredNightAbilityIds(role: RoleComponent): readonly string[] {
  return ((role.privateState as { readonly retiredAbilityIds?: unknown }).retiredAbilityIds ??
    []) as readonly string[];
}
