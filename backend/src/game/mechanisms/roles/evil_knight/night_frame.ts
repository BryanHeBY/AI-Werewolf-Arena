/**
 * 负责恶夜骑士固定名单的原体复验及本夜绑定捕获阶段。输入为原玩家、能力身份与当前夜状态；
 * 输出为原名单拒绝、同一 binding Map 与免疫提案。名单不在角色替换后重建，失效保原错误前缀。
 * 每次状态读取和原 capture／Map.set 顺序保持；本族登记 Map 后才展开免疫数组，后续失败不退款或撤销安装。
 * 捕获与反射资格归 reflection，实际余量写入归 state-slot；运行回调／生命引用不进入玩家观察或归档，也不授权行动。
 */
import type { World } from "../../../../core/domain/world";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role } from "../../../../core/domain/identity";
import { captureNightLife } from "../../../../core/domain/night_effects";
import type { NightStageHandler } from "../../stages/night/contracts";
import { captureEvilKnight } from "./reflection";
import { hasEvilKnightNightBindings, installEvilKnightNightBindings } from "./night-bindings";
import type { NightAbilityReadView } from "../abilities";
type AbilityAuthority = {
  ability: NightAbilityReadView;
  state: NightAbilityReadView["state"];
  source: NightAbilityReadView["source"];
  identity: string;
};
function abilityIdentity(ability: NightAbilityReadView): string {
  const state = ability.state as unknown as Record<string, unknown>;
  return JSON.stringify([
    ability.id,
    ability.kind,
    ability.activation,
    ability.source,
    ability.sourceDisclosed,
    ability.startsOnDay,
    ability.expiresAfterDay,
    ability.maxUses,
    state.targetPolicy,
    state.actionPolicy,
    state.selfHealRule,
    state.knifeVisibility,
    state.potionPolicy,
    state.repeatPolicy,
    state.policy,
    state.inspectionPolicy,
    state.protectionPolicy,
  ]);
}
type RosterBinding = {
  id: number;
  role: RoleComponent;
  kind: Role;
  camp: Camp;
  state: RoleComponent["privateState"];
  refs: [string, unknown][];
  abilityRefs: [string, unknown][];
  authorities: AbilityAuthority[];
};
const installed = new WeakMap<World, RosterBinding[]>();
export function installEvilKnightBoard(world: World): void {
  if (installed.has(world)) throw new Error("evil_knight_board_reinstall");
  installed.set(
    world,
    world.entityIds().map((id) => {
      const role = world.getComponent(id, COMPONENT.Role);
      if (!role) throw new Error("evil_knight_roster_missing");
      return {
        id,
        role,
        kind: role.role,
        camp: role.camp,
        state: role.privateState,
        refs: Object.entries(role.privateState),
        abilityRefs: Object.entries(
          (role.privateState as { readonly abilities?: unknown }).abilities ?? {},
        ),
        authorities: Object.values(
          ((role.privateState as { readonly abilities?: unknown }).abilities ?? {}) as Record<
            string,
            NightAbilityReadView
          >,
        ).map((ability) => ({
          ability,
          state: ability.state,
          source: ability.source,
          identity: abilityIdentity(ability),
        })),
      };
    }),
  );
}
export function isEvilKnightBoard(world: World): boolean {
  return installed.has(world);
}
export function assertEvilKnightRosterCurrent(world: World): void {
  for (const entry of installed.get(world) ?? []) {
    if (
      world.getComponent(entry.id, COMPONENT.Role) !== entry.role ||
      entry.role.role !== entry.kind ||
      entry.role.camp !== entry.camp ||
      entry.role.privateState !== entry.state ||
      entry.refs.some(
        ([key, value]) => (entry.state as Readonly<Record<string, unknown>>)[key] !== value,
      ) ||
      entry.authorities.some(
        (a) =>
          a.ability.state !== a.state ||
          a.ability.source !== a.source ||
          abilityIdentity(a.ability) !== a.identity,
      ) ||
      Object.keys((entry.state as { readonly abilities?: unknown }).abilities ?? {}).length !==
        entry.abilityRefs.length ||
      entry.abilityRefs.some(
        ([key, value]) =>
          (
            (entry.state as { readonly abilities?: unknown }).abilities as
              Record<string, unknown> | undefined
          )?.[key] !== value,
      )
    )
      throw new Error("evil_knight_roster_revoked");
  }
}
export function assertEvilKnightNativeActor(world: World, actorId: number, expected: Role): void {
  if (!isEvilKnightBoard(world)) return;
  assertEvilKnightRosterCurrent(world);
  const role = world.getComponent(actorId, COMPONENT.Role);
  if (role?.role !== expected || role.camp !== Camp.Good)
    throw new Error("evil_knight_actor_identity_revoked");
}
export const EVIL_KNIGHT_FRAME_STAGE: NightStageHandler = {
  id: "evil_knight_frame",
  priority: 50,
  async execute(ctx) {
    if (!isEvilKnightBoard(ctx.world)) return;
    assertEvilKnightRosterCurrent(ctx.world);
    if (hasEvilKnightNightBindings(ctx.state)) throw new Error("evil_knight_night_reentry");
    const bindings = new Map<number, NonNullable<ReturnType<typeof captureEvilKnight>>>();
    for (const id of ctx.world.getAliveEntityIds()) {
      const life = captureNightLife(ctx.world, id);
      const binding = life && captureEvilKnight(ctx.world, life);
      if (binding) bindings.set(id, binding);
    }
    installEvilKnightNightBindings(ctx.state, bindings);
    ctx.state.nightImmunities = [...bindings.values()];
  },
};
