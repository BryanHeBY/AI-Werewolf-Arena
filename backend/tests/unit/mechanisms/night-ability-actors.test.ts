/**
 * Unit tests for narrow night eligibility ports and eager actor enumeration.
 * Inputs are literal live instances, instrumented read ports and owned contexts
 * with replaced World getters; independent traces assert complete filter order,
 * failure prefixes, reference identity and zero binding reads. No full-game
 * driver, model or production-generated expected result is used.
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import type { NightAbility } from "../../../src/game/mechanisms/roles/abilities";
import {
  bindNightAbilityActorQuery,
  createNightAbilityActorQuery,
  createNightActorEligibilityQuery,
  type NightActorEligibilityQuery,
  type NightAbilityActorQuery,
  type NightAbilityRosterPort,
} from "../../../src/game/mechanisms/roles/night-ability-actors";
import { bindNightmareNightEligibility } from "../../../src/game/mechanisms/roles/nightmare_shadow/ports";
import { bindScholarMentorNightEligibility } from "../../../src/game/mechanisms/roles/scholar_mentor/ports";
import { SEER_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/seer/night_stages";
import { GUARD_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/guard/night_stages";
import { WITCH_NIGHT_STAGES } from "../../../src/game/mechanisms/roles/witch/night_stages";
import { nightStageContext } from "../../engine/night_stage_fixture";

const ability = (id: string): NightAbility<"seer_check"> => ({
  id,
  kind: "seer_check",
  state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
  source: { kind: "gift", actorId: 9 },
  sourceDisclosed: false,
  startsOnDay: 1,
  maxUses: null,
  uses: 0,
  lastUsedDay: null,
  disabled: false,
});

function worldWithAbility(selected: NightAbility<"seer_check">) {
  const world = new World("en"),
    id = world.createEntity(),
    role = createRoleComponent(Role.Villager, Camp.Good, "en");
  (role.privateState as Record<string, unknown>).abilities = { [selected.id]: selected };
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Alive, createAliveComponent(true, "en"));
  return { world, role, id };
}

test("binding all concrete and composed queries never reads a World or actor property", () => {
  const reads: string[] = [];
  const world = new Proxy(new World("en"), {
    get(_target, key) {
      reads.push(String(key));
      throw new Error("unexpected_binding_read");
    },
  });
  const fear = bindNightmareNightEligibility(world),
    modifier = bindScholarMentorNightEligibility(world),
    query = bindNightAbilityActorQuery(world);
  expect(reads).toEqual([]);
  expect(Object.keys(fear)).toEqual(["blocks"]);
  expect(Object.keys(modifier)).toEqual(["blocks"]);
  expect(Object.keys(query)).toEqual(["actors"]);
  expect(Object.isFrozen(query)).toBe(true);
});

test("fear completes its roster pass before modifier and stored ability reads", () => {
  const trace: string[] = [],
    first = ability("first"),
    second = ability("second");
  const eligibility = createNightActorEligibilityQuery(
    {
      blocks(id, day) {
        trace.push(`fear:${id}:${day}`);
        return id === 2;
      },
    },
    {
      blocks(id, day, kind) {
        trace.push(`modifier:${id}:${day}:${kind}`);
        return false;
      },
    },
  );
  const query = createNightAbilityActorQuery(
    {
      aliveIds() {
        trace.push("alive");
        return [1, 2, 3];
      },
      abilitiesFor(id) {
        trace.push(`abilities:${id}`);
        return id === 1 ? [first] : [second];
      },
    },
    eligibility,
  );
  expect(trace).toEqual([]);
  const actors = query.actors("seer_check", 7);
  expect(trace).toEqual([
    "alive",
    "fear:1:7",
    "fear:2:7",
    "fear:3:7",
    "modifier:1:7:check",
    "modifier:3:7:check",
    "abilities:1",
    "abilities:3",
  ]);
  expect(actors.map((row) => row.actorId)).toEqual([1, 3]);
  expect(actors[0]!.ability).toBe(first);
  expect(actors[1]!.ability).toBe(second);
  expect(Object.isFrozen(first)).toBe(false);
});

test("a fear failure preserves its eager prefix without modifier or ability reads", () => {
  const trace: string[] = [];
  const query = createNightAbilityActorQuery(
    {
      aliveIds: () => [1, 2, 3],
      abilitiesFor(id) {
        trace.push(`abilities:${id}`);
        return [];
      },
    },
    createNightActorEligibilityQuery(
      {
        blocks(id) {
          trace.push(`fear:${id}`);
          if (id === 2) throw new Error("original_fear_failure");
          return false;
        },
      },
      {
        blocks(id) {
          trace.push(`modifier:${id}`);
          return false;
        },
      },
    ),
  );
  expect(() => query.actors("guard", 1)).toThrow("original_fear_failure");
  expect(trace).toEqual(["fear:1", "fear:2"]);
});

test("only guard and camp-check qualification invokes the modifier port", () => {
  const trace: string[] = [];
  const query = createNightActorEligibilityQuery(
    { blocks: () => false },
    {
      blocks(id, day, kind) {
        trace.push(`${id}:${day}:${kind}`);
        return id === 2;
      },
    },
  );
  for (const kind of ["pair_check", "shelter", "role_check", "potion", "dream"] as const)
    expect(query.filterAliveActors([1, 2], kind, 4)).toEqual([1, 2]);
  expect(trace).toEqual([]);
  expect(query.filterAliveActors([1, 2], "guard", 4)).toEqual([1]);
  expect(query.filterAliveActors([1, 2], "seer_check", 4)).toEqual([1]);
  expect(trace).toEqual(["1:4:guard", "2:4:guard", "1:4:check", "2:4:check"]);
});

test("the real roster port retains sorted stored references and queries status live", () => {
  const z = ability("z"),
    a = ability("a"),
    f = worldWithAbility(z);
  (f.role.privateState as Record<string, unknown>).abilities = { z, a };
  const query = bindNightAbilityActorQuery(f.world);
  const rows = query.actors("seer_check", 1);
  expect(rows.map((row) => row.ability.id)).toEqual(["a", "z"]);
  expect(rows[0]!.ability).toBe(a);
  expect(rows[1]!.ability).toBe(z);
  a.disabled = true;
  expect(query.actors("seer_check", 1).map((row) => row.ability)).toEqual([z]);
  z.lastUsedDay = 1;
  expect(query.actors("seer_check", 1)).toEqual([]);
});

test("actual base stages keep a custom World getter before currentDay without binding reads", async () => {
  const stages = [
    SEER_NIGHT_STAGES[0]!,
    GUARD_NIGHT_STAGES[0]!,
    WITCH_NIGHT_STAGES.find((stage) => stage.id === "witch_action")!,
  ];
  for (const stage of stages) {
    const world = new World("en"),
      trace: string[] = [],
      ctx = nightStageContext({
        world,
        currentDay() {
          trace.push("day");
          throw new Error("stop_at_original_day_boundary");
        },
      });
    Object.defineProperty(ctx, "world", {
      get() {
        trace.push("world");
        return world;
      },
    });
    await expect(stage.execute(ctx)).rejects.toThrow("stop_at_original_day_boundary");
    expect(trace).toEqual(["world", "world", "day"]);
  }
});

test("the owned context query follows the current World reference without replacing instances", () => {
  const first = ability("first"),
    second = ability("second"),
    a = worldWithAbility(first),
    b = worldWithAbility(second),
    ctx = nightStageContext({ world: a.world });
  expect(ctx.nightActors.actors("seer_check", 1)[0]!.ability).toBe(first);
  ctx.world = b.world;
  expect(ctx.nightActors.actors("seer_check", 1)[0]!.ability).toBe(second);
});

/** Compile-only negative capabilities: no World, clock, RNG or commit in query interfaces. */
function rejectedQueryCapabilities(
  eligibility: NightActorEligibilityQuery,
  actors: NightAbilityActorQuery,
  world: World,
  roster: NightAbilityRosterPort,
) {
  // @ts-expect-error Query calls have no World argument.
  eligibility.filterAliveActors([], "guard", 1, world);
  // @ts-expect-error Query views have no mutation method.
  eligibility.commit();
  // @ts-expect-error Actor query has no arbitrary World access.
  actors.world;
  // @ts-expect-error No injected clock enters the actor query.
  actors.actors("guard", () => 1);
  // @ts-expect-error No random source enters eligibility.
  eligibility.random;
  // @ts-expect-error Roster elements expose no metadata write rights.
  roster.abilitiesFor(1)[0]!.uses++;
  const potion = roster.abilitiesFor(1).find((ability) => ability.kind === "potion");
  if (potion?.kind === "potion") {
    // @ts-expect-error Read-port potion state is read-only below the instance level.
    potion.state.poison = 0;
  }
  const check = roster.abilitiesFor(1).find((ability) => ability.kind === "seer_check");
  if (check?.kind === "seer_check") {
    // @ts-expect-error Read-port history cannot be appended or used as a mutation route.
    check.state.history.push({ targetId: 1, isWerewolf: false });
  }
  const pair = roster.abilitiesFor(1).find((ability) => ability.kind === "pair_check");
  if (pair?.kind === "pair_check") {
    // @ts-expect-error Nested pair tuples in read-port history also have no write rights.
    pair.state.history[0]!.targetIds[0] = 2;
  }
  // Captured actor output keeps the same reference with no ordinary write permission.
  // @ts-expect-error Metadata writes belong to the concrete ability owner.
  actors.actors("potion", 1)[0]!.ability.uses++;
  // @ts-expect-error Potion stock writes belong to the concrete payload owner.
  actors.actors("potion", 1)[0]!.ability.state.poison = 0;
}
void rejectedQueryCapabilities;
