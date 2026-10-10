import type { World } from "../../../../core/domain/world";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role } from "../../../../core/domain/identity";
import { captureNightLife } from "../../../../core/domain/night_effects";
import type { NightStageHandler } from "../../stages/night/contracts";
import { captureEvilKnight } from "./state";
import type { NightAbility } from "../abilities";
type AbilityAuthority = {
  ability: NightAbility;
  state: NightAbility["state"];
  source: NightAbility["source"];
  identity: string;
};
function abilityIdentity(ability: NightAbility): string {
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
      const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (!role) throw new Error("evil_knight_roster_missing");
      return {
        id,
        role,
        kind: role.role,
        camp: role.camp,
        state: role.privateState,
        refs: Object.entries(role.privateState),
        abilityRefs: Object.entries(role.privateState.abilities ?? {}),
        authorities: Object.values(
          (role.privateState.abilities ?? {}) as Record<string, NightAbility>,
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
      entry.refs.some(([key, value]) => entry.state[key] !== value) ||
      entry.authorities.some(
        (a) =>
          a.ability.state !== a.state ||
          a.ability.source !== a.source ||
          abilityIdentity(a.ability) !== a.identity,
      ) ||
      Object.keys(entry.state.abilities ?? {}).length !== entry.abilityRefs.length ||
      entry.abilityRefs.some(
        ([key, value]) =>
          (entry.state.abilities as Record<string, unknown> | undefined)?.[key] !== value,
      )
    )
      throw new Error("evil_knight_roster_revoked");
  }
}
export function assertEvilKnightNativeActor(world: World, actorId: number, expected: Role): void {
  if (!isEvilKnightBoard(world)) return;
  assertEvilKnightRosterCurrent(world);
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
  if (role?.role !== expected || role.camp !== Camp.Good)
    throw new Error("evil_knight_actor_identity_revoked");
}
export const EVIL_KNIGHT_FRAME_STAGE: NightStageHandler = {
  id: "evil_knight_frame",
  priority: 50,
  async execute(ctx) {
    if (!isEvilKnightBoard(ctx.world)) return;
    assertEvilKnightRosterCurrent(ctx.world);
    if (ctx.state.evilKnightBindings) throw new Error("evil_knight_night_reentry");
    const bindings = new Map<number, NonNullable<ReturnType<typeof captureEvilKnight>>>();
    for (const id of ctx.world.getAliveEntityIds()) {
      const life = captureNightLife(ctx.world, id);
      const binding = life && captureEvilKnight(ctx.world, life);
      if (binding) bindings.set(id, binding);
    }
    ctx.state.evilKnightBindings = bindings;
    ctx.state.nightImmunities = [...bindings.values()];
  },
};
