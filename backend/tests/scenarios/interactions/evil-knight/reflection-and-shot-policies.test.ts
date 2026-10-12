/**
 * Interaction scenarios verify Evil Knight reflection and Hunter shot policies preserve actual inspection, death and winner order.
 * Input: Original locale/policy matrices, controlled night/day replies and in-flight role/ability/currentness mutations.
 * Output and oracle: Literal reflected results, death announcements, stock and failed/reentry prefixes remain tied to real phase cycles; no detached unit expectation replaces the interaction.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { evilKnightTwelveConfig } from "../../../../src/runtime/scenarios/evil_knight_twelve";
import {
  Camp,
  Role,
  Phase,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/core/domain/model";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import type { AliveComponent } from "../../../../src/core/domain/components/alive";
import { getHunterState, getSeerState } from "../../../../src/game/mechanisms/roles/private_state";
function fixture(
  locale: "zh-CN" | "en",
  shotPolicy: "night_shot_immune" | "hunter_shot_bypasses" = "night_shot_immune",
) {
  const config = structuredClone(evilKnightTwelveConfig);
  config.evilKnight!.shotPolicy = shotPolicy;
  const game = bootstrapGame(config, { locale });
  const id = (role: Role) =>
    game.world
      .entityIds()
      .find((id) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === role)!;
  return {
    ...game,
    id,
    knight: id(Role.EvilKnight),
    hunter: id(Role.Hunter),
    seer: id(Role.Seer),
    witch: id(Role.Witch),
  };
}
function provider(
  f: ReturnType<typeof fixture>,
  options: {
    knife?: number;
    shot?: number;
    exile?: number;
    inspect?: number;
    poison?: number;
  } = {},
  seen: ActionRequest[] = [],
) {
  return {
    getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
      seen.push(r);
      if (r.allowedTools.includes("check_identity"))
        return {
          name: "check_identity",
          args: { target_id: options.inspect ?? f.id(Role.Villager) },
        };
      if (r.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "...", end_chat: true } };
      if (r.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote",
          args: { target_id: options.knife ?? null, abstain: options.knife === undefined },
        };
      if (r.allowedTools.includes("guard"))
        return { name: "guard", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("use_potion"))
        return {
          name: "use_potion",
          args: {
            target_id: options.poison ?? r.actorId,
            potion_type: options.poison === undefined ? PotionType.None : PotionType.Poison,
          },
        };
      if (r.allowedTools.includes("run_for_sheriff"))
        return { name: "run_for_sheriff", args: { run: false } };
      if (r.allowedTools.includes("vote_for_sheriff"))
        return { name: "vote_for_sheriff", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("vote"))
        return {
          name: "vote",
          args: {
            target_id: options.exile !== r.actorId ? (options.exile ?? null) : null,
            abstain: options.exile === undefined || options.exile === r.actorId,
          },
        };
      if (r.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: options.shot ?? null } };
      if (r.allowedTools.includes("choose_badge_successor"))
        return { name: "choose_badge_successor", args: { target_id: null } };
      if (r.allowedTools.includes("choose_direction"))
        return { name: "choose_direction", args: { direction: "clockwise" } };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "..." } };
      return null;
    },
  };
}
const alive = (f: ReturnType<typeof fixture>, id: number) =>
  f.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive;
function nightDeaths(f: ReturnType<typeof fixture>) {
  return f.phaseManager
    .getEvents()
    .filter((e) => e.type === "night_resolved")
    .at(-1)!.payload.deaths;
}
for (const locale of ["zh-CN", "en"] as const) {
  for (const policy of ["night_shot_immune", "hunter_shot_bypasses"] as const) {
    test(`night Hunter shot observes ${policy}/${locale} before winner and announcement`, async () => {
      const f = fixture(locale, policy),
        seen: ActionRequest[] = [];
      for (const id of f.world.entityIds())
        if (f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Wolf)
          f.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
      await f.phaseManager.runSingleCycle(
        provider(f, { knife: f.hunter, shot: f.knight }, seen),
        10,
      );
      expect(alive(f, f.knight)).toBe(policy === "night_shot_immune");
      expect(alive(f, f.hunter)).toBe(false);
      expect(
        getHunterState(f.world.getComponent<RoleComponent>(f.hunter, COMPONENT.Role)!)!.canShoot,
      ).toBe(false);
      expect([...nightDeaths(f)].sort((a, b) => a - b)).toEqual(
        (policy === "night_shot_immune" ? [f.hunter] : [f.hunter, f.knight]).sort((a, b) => a - b),
      );
      const events = f.phaseManager.getEvents();
      if (policy === "night_shot_immune")
        expect(events.some((e) => e.type === "death_shot_blocked")).toBe(true);
      else {
        expect(f.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
        expect(events.findIndex((e) => e.type === "hunter_shot")).toBeLessThan(
          events.findIndex((e) => e.type === "night_resolved"),
        );
      }
      expect(seen.filter((r) => r.allowedTools.includes("shoot"))).toHaveLength(1);
    });
    test(`daytime exile Hunter shot bypasses night immunity ${policy}/${locale}`, async () => {
      const f = fixture(locale, policy);
      await f.phaseManager.runSingleCycle(provider(f, { exile: f.hunter, shot: f.knight }), 10);
      expect(alive(f, f.hunter)).toBe(false);
      expect(alive(f, f.knight)).toBe(false);
      expect(nightDeaths(f)).toEqual([]);
      expect(f.phaseManager.getEvents().some((e) => e.type === "hunter_shot")).toBe(true);
    });
  }
  test(`pending knife does not cancel the reflected Seer report ${locale}`, async () => {
    const f = fixture(locale),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(
      provider(f, { knife: f.seer, inspect: f.knight }, seen),
      10,
    );
    expect(nightDeaths(f)).toEqual([f.seer]);
    expect(
      getSeerState(f.world.getComponent<RoleComponent>(f.seer, COMPONENT.Role)!)!.lastIsWerewolf,
    ).toBe(true);
    expect(
      seen
        .filter((r) => r.context.stage === "sheriff_nomination")
        .every((r) => r.actorId !== f.seer),
    ).toBe(true);
  });
  test(`Witch-first ordering preserves simultaneous Seer result ${locale}`, async () => {
    const f = fixture(locale);
    await f.phaseManager.runSingleCycle(provider(f, { poison: f.knight, inspect: f.knight }), 10);
    expect(nightDeaths(f)).toEqual([f.witch]);
    expect(alive(f, f.knight)).toBe(true);
    expect(alive(f, f.seer)).toBe(true);
    expect(
      getSeerState(f.world.getComponent<RoleComponent>(f.seer, COMPONENT.Role)!)!.lastIsWerewolf,
    ).toBe(true);
  });
}
test("evil knight cycle rejects reentry and cannot resume an incomplete required night", async () => {
  const f = fixture("en"),
    base = provider(f);
  let checked = false;
  const wrapped = {
    getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
      if (!checked && r.allowedTools.includes("check_identity")) {
        checked = true;
        await expect(f.phaseManager.runSingleCycle(base, 10)).rejects.toThrow(
          "evil_knight_cycle_reentry",
        );
        return null;
      }
      return base.getAction(r);
    },
  };
  await expect(f.phaseManager.runSingleCycle(wrapped, 10)).rejects.toThrow(
    "evil_knight_seer_action_missing",
  );
  expect(checked).toBe(true);
  expect(
    f.phaseManager.getEvents().some((e) => e.type === "night_resolved" || e.type === "game_over"),
  ).toBe(false);
  await expect(f.phaseManager.runSingleCycle(base, 10)).rejects.toThrow(
    "evil_knight_cycle_reentry",
  );
});

for (const stage of ["guard", "wolf_discussion"] as const) {
  for (const invalid of [false, true]) {
    test(`required ${stage} response cannot silently skip: invalid=${invalid}`, async () => {
      const f = fixture("en"),
        base = provider(f);
      const wrapped = {
        getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
          if (r.context.stage === stage)
            return invalid
              ? stage === "guard"
                ? { name: "guard", args: { target_id: 99999, abstain: false } }
                : ({
                    name: "speak_to_wolves",
                    args: { text: 42, end_chat: true },
                  } as unknown as ToolCall)
              : null;
          return base.getAction(r);
        },
      };
      await expect(f.phaseManager.runSingleCycle(wrapped, 10)).rejects.toThrow(
        `evil_knight_${stage === "guard" ? "guard" : "wolf_chat"}_action_${invalid ? "invalid" : "missing"}`,
      );
      expect(
        f.phaseManager
          .getEvents()
          .some((e) => e.type === "night_resolved" || e.type === "game_over"),
      ).toBe(false);
    });
  }
}
for (const former of [Role.Seer, Role.Witch, Role.Guard]) {
  test(`original ${former} cannot carry native authority into a replacement role`, async () => {
    const f = fixture("en"),
      base = provider(f),
      actor = f.id(former);
    const role = f.world.getComponent<RoleComponent>(actor, COMPONENT.Role)!;
    const abilities = Object.values(
      role.privateState.abilities as Record<string, { uses: number; state: { poison?: number } }>,
    );
    let changed = false;
    const wrapped = {
      getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
        if (!changed && r.context.stage === "wolf_discussion") {
          role.role = Role.Villager;
          changed = true;
        }
        return base.getAction(r);
      },
    };
    await expect(f.phaseManager.runSingleCycle(wrapped, 10)).rejects.toThrow(
      "evil_knight_roster_revoked",
    );
    expect(changed).toBe(true);
    expect(abilities.every((a) => a.uses === 0)).toBe(true);
    if (former === Role.Witch) expect(abilities.some((a) => a.state.poison === 1)).toBe(true);
    expect(
      f.phaseManager.getEvents().some((e) => e.type === "night_resolved" || e.type === "game_over"),
    ).toBe(false);
  });
}

test("witch target role replacement aborts before potion consumption", async () => {
  const f = fixture("en"),
    base = provider(f, { poison: f.knight });
  const target = f.world.getComponent<RoleComponent>(f.knight, COMPONENT.Role)!;
  const witch = f.world.getComponent<RoleComponent>(f.witch, COMPONENT.Role)!;
  const abilities = Object.values(
    witch.privateState.abilities as Record<string, { uses: number; state: { poison?: number } }>,
  );
  let changed = false;
  const wrapped = {
    getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
      const action = await base.getAction(r);
      if (r.context.stage === "witch") {
        target.role = Role.Villager;
        changed = true;
      }
      return action;
    },
  };
  await expect(f.phaseManager.runSingleCycle(wrapped, 10)).rejects.toThrow(
    "evil_knight_roster_revoked",
  );
  expect(changed).toBe(true);
  expect(abilities.every((a) => a.uses === 0)).toBe(true);
  expect(abilities.some((a) => a.state.poison === 1)).toBe(true);
  expect(
    f.phaseManager
      .getEvents()
      .some((e) => e.type === "witch_potion_used" || e.type === "night_resolved"),
  ).toBe(false);
});
for (const stage of ["wolf_discussion", "seer"] as const) {
  test(`seer ability replacement during ${stage} cannot skip required inspection`, async () => {
    const f = fixture("en"),
      base = provider(f);
    const role = f.world.getComponent<RoleComponent>(f.seer, COMPONENT.Role)!;
    const abilities = role.privateState.abilities as Record<string, { uses: number }>;
    const key = Object.keys(abilities)[0]!,
      original = abilities[key]!;
    let changed = false;
    const wrapped = {
      getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
        const action = await base.getAction(r);
        if (!changed && r.context.stage === stage) {
          abilities[key] = structuredClone(original);
          changed = true;
        }
        return action;
      },
    };
    await expect(f.phaseManager.runSingleCycle(wrapped, 10)).rejects.toThrow(
      "evil_knight_roster_revoked",
    );
    expect(changed).toBe(true);
    expect(original.uses).toBe(0);
    expect(abilities[key]!.uses).toBe(0);
    expect(
      f.phaseManager
        .getEvents()
        .some((e) => e.type === "seer_checked" || e.type === "night_resolved"),
    ).toBe(false);
  });
}

for (const mutation of [
  "state",
  "source",
  "source_role",
  "kind",
  "id",
  "activation",
  "starts",
  "expires",
  "max_uses",
  "disclosed",
  "policy",
] as const) {
  test(`seer authority edit ${mutation} during await fails before commitment`, async () => {
    const f = fixture("en"),
      base = provider(f);
    const role = f.world.getComponent<RoleComponent>(f.seer, COMPONENT.Role)!;
    const ability = Object.values(
      role.privateState.abilities as Record<string, Record<string, unknown>>,
    )[0]!;
    let changed = false;
    const wrapped = {
      getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
        const action = await base.getAction(r);
        if (r.context.stage === "seer") {
          changed = true;
          switch (mutation) {
            case "state":
              ability.state = structuredClone(ability.state);
              break;
            case "source":
              ability.source = structuredClone(ability.source);
              break;
            case "source_role":
              (ability.source as Record<string, unknown>).role = Role.Villager;
              break;
            case "kind":
              ability.kind = "guard";
              break;
            case "id":
              ability.id = "replacement";
              break;
            case "activation":
              ability.activation = "lucky";
              break;
            case "starts":
              ability.startsOnDay = 99;
              break;
            case "expires":
              ability.expiresAfterDay = 0;
              break;
            case "max_uses":
              ability.maxUses = 0;
              break;
            case "disclosed":
              ability.sourceDisclosed = !ability.sourceDisclosed;
              break;
            case "policy":
              (ability.state as Record<string, unknown>).actionPolicy = "awa_optional_v1";
              break;
          }
        }
        return action;
      },
    };
    await expect(f.phaseManager.runSingleCycle(wrapped, 10)).rejects.toThrow(
      "evil_knight_roster_revoked",
    );
    expect(changed).toBe(true);
    expect(ability.uses).toBe(0);
    expect(
      f.phaseManager
        .getEvents()
        .some((e) => e.type === "seer_checked" || e.type === "night_resolved"),
    ).toBe(false);
  });
}
