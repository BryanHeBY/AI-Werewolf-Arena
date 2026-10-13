/**
 * Interaction scenarios verify Nightmare fear suppresses original native requests without extending stock or changing later death timing.
 * Input: Original locale/target/policy matrices and controlled multi-night fear, pass, knife, dream and Hunter replies.
 * Output and oracle: Literal request absence, consecutive-target rules, resource/history and night-versus-day shot assertions retain actual cycles; no World execution manufactures the expected state.
 */
import { getDreamerState } from "../../../../src/game/mechanisms/roles/dreamer/ports";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { nightmareTwelveConfig } from "../../../../src/runtime/scenarios/nightmare_twelve";
import {
  Role,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/core/domain/model";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import type { AliveComponent } from "../../../../src/core/domain/components/alive";
function fixture(locale: "zh-CN" | "en") {
  const game = bootstrapGame(structuredClone(nightmareTwelveConfig), { locale });
  const id = (role: Role) =>
    game.world
      .entityIds()
      .find((id) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === role)!;
  return {
    ...game,
    id,
    nightmare: id(Role.NightmareShadow),
    hunter: id(Role.Hunter),
    seer: id(Role.Seer),
    witch: id(Role.Witch),
    dreamer: id(Role.Dreamer),
  };
}
function provider(
  f: ReturnType<typeof fixture>,
  options: {
    fear?: number;
    knife?: number;
    exile?: number;
    shot?: number;
    missingFear?: boolean;
  } = {},
  seen: ActionRequest[] = [],
) {
  return {
    getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
      seen.push(r);
      if (r.allowedTools.includes("fear"))
        return options.missingFear
          ? null
          : {
              name: "fear",
              args: { target_id: options.fear ?? null, abstain: options.fear === undefined },
            };
      if (r.allowedTools.includes("dream"))
        return {
          name: "dream",
          args: {
            target_id: f.world
              .getAliveEntityIds()
              .filter(
                (id) =>
                  f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Villager,
              )[(r.context.day - 1) % 4]!,
          },
        };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: f.id(Role.Villager) } };
      if (r.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "...", end_chat: true } };
      if (r.allowedTools.includes("kill_vote"))
        return {
          name: "kill_vote",
          args: { target_id: options.knife ?? null, abstain: options.knife === undefined },
        };
      if (r.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: PotionType.None } };
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
for (const locale of ["zh-CN", "en"] as const) {
  for (const [role, tool] of [
    [Role.Seer, "check_identity"],
    [Role.Witch, "use_potion"],
    [Role.Dreamer, "dream"],
  ] as const) {
    test(`nightmare suppresses native ${role} action/${locale}`, async () => {
      const f = fixture(locale),
        seen: ActionRequest[] = [];
      await f.phaseManager.runSingleCycle(provider(f, { fear: f.id(role) }, seen), 10);
      expect(
        seen.filter((r) => r.actorId === f.id(role) && r.allowedTools.includes(tool)),
      ).toHaveLength(0);
      expect(
        f.phaseManager.getEvents().filter((e) => e.type === "nightmare_fear_committed"),
      ).toHaveLength(1);
    });
  }
  test(`first night wolf fear blocks every knife request/${locale}`, async () => {
    const f = fixture(locale),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(
      provider(f, { fear: f.id(Role.Wolf), knife: f.hunter }, seen),
      10,
    );
    expect(seen.filter((r) => r.allowedTools.includes("kill_vote"))).toHaveLength(0);
    expect(seen.some((r) => r.allowedTools.includes("speak_to_wolves"))).toBe(true);
    expect(alive(f, f.hunter)).toBe(true);
  });
  test(`feared Hunter cannot shoot on night death/${locale}`, async () => {
    const f = fixture(locale),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(
      provider(f, { fear: f.hunter, knife: f.hunter, shot: f.nightmare }, seen),
      10,
    );
    expect(alive(f, f.hunter)).toBe(false);
    expect(alive(f, f.nightmare)).toBe(true);
    expect(seen.filter((r) => r.allowedTools.includes("shoot"))).toHaveLength(0);
  });
  test(`feared Hunter can shoot after daytime exile/${locale}`, async () => {
    const f = fixture(locale),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(
      provider(f, { fear: f.hunter, exile: f.hunter, shot: f.nightmare }, seen),
      10,
    );
    expect(alive(f, f.hunter)).toBe(false);
    expect(alive(f, f.nightmare)).toBe(false);
    expect(seen.filter((r) => r.allowedTools.includes("shoot"))).toHaveLength(1);
  });
  test(`missing fear response cannot silently become pass/${locale}`, async () => {
    const f = fixture(locale);
    await expect(
      f.phaseManager.runSingleCycle(provider(f, { missingFear: true }), 10),
    ).rejects.toThrow();
    expect(
      f.phaseManager.getEvents().filter((e) => e.type === "nightmare_fear_committed"),
    ).toHaveLength(0);
  });
}

for (const locale of ["zh-CN", "en"] as const) {
  test(`nightmare rejects consecutive fear across actual nights/${locale}`, async () => {
    const f = fixture(locale);
    await f.phaseManager.runSingleCycle(provider(f, { fear: f.witch }), 10);
    await expect(
      f.phaseManager.runSingleCycle(provider(f, { fear: f.witch }), 10),
    ).rejects.toThrow();
    expect(
      f.phaseManager.getEvents().filter((e) => e.type === "nightmare_fear_committed"),
    ).toHaveLength(1);
  });
  test(`explicit pass breaks consecutive fear restriction across three nights/${locale}`, async () => {
    const f = fixture(locale);
    await f.phaseManager.runSingleCycle(provider(f, { fear: f.witch }), 10);
    await f.phaseManager.runSingleCycle(provider(f), 10);
    await f.phaseManager.runSingleCycle(provider(f, { fear: f.witch }), 10);
    const facts = f.phaseManager.getEvents().filter((e) => e.type === "nightmare_fear_committed");
    expect(facts.map((e) => e.payload.targetId)).toEqual([f.witch, null, f.witch]);
    expect(facts.map((e) => e.payload.day)).toEqual([1, 2, 3]);
  });
}

for (const wolfActionPolicy of ["standard", "no_blast_no_self_knife"] as const)
  test(`nightmare actual blast requests respect ${wolfActionPolicy}`, async () => {
    const config = structuredClone(nightmareTwelveConfig);
    config.nightmareShadow!.wolfActionPolicy = wolfActionPolicy;
    const f = bootstrapGame(config);
    const seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(
      provider(
        {
          ...f,
          id: (role: Role) =>
            f.world
              .entityIds()
              .find(
                (id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === role,
              )!,
          nightmare: 0,
          hunter: 0,
          seer: 0,
          witch: 0,
          dreamer: 0,
        },
        {},
        seen,
      ),
      10,
    );
    const blasts = seen.filter((r) => r.allowedTools.includes("self_destruct"));
    const roleOf = (id: number) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)!.role;
    expect(blasts.some((r) => roleOf(r.actorId) === Role.Wolf)).toBe(true);
    expect(blasts.some((r) => roleOf(r.actorId) === Role.NightmareShadow)).toBe(
      wolfActionPolicy === "standard",
    );
  });

for (const locale of ["zh-CN", "en"] as const) {
  test(`fear skips Dreamer without extending protection or consuming history/${locale}`, async () => {
    const f = fixture(locale),
      target = f.id(Role.Villager);
    const base1 = provider(f, { fear: f.witch });
    await f.phaseManager.runSingleCycle(
      {
        getAction: async (r: ActionRequest) =>
          r.allowedTools.includes("dream")
            ? { name: "dream", args: { target_id: target } }
            : base1.getAction(r),
      },
      10,
    );
    const state = getDreamerState(f.world.getComponent<RoleComponent>(f.dreamer, COMPONENT.Role)!)!;
    expect(state.lastDay).toBe(1);
    await f.phaseManager.runSingleCycle(provider(f, { fear: f.dreamer, knife: target }), 10);
    expect(alive(f, target)).toBe(false);
    expect(state.lastDay).toBe(1);
    expect(state.history).toHaveLength(1);
  });
  test(`fear gap prevents same-target Dreamer consecutive death/${locale}`, async () => {
    const f = fixture(locale),
      target = f.id(Role.Villager);
    for (let day = 1; day <= 3; day++) {
      const base = provider(f, { fear: day === 2 ? f.dreamer : f.witch });
      await f.phaseManager.runSingleCycle(
        {
          getAction: async (r: ActionRequest) =>
            r.allowedTools.includes("dream")
              ? { name: "dream", args: { target_id: target } }
              : base.getAction(r),
        },
        10,
      );
    }
    const state = getDreamerState(f.world.getComponent<RoleComponent>(f.dreamer, COMPONENT.Role)!)!;
    expect(state.history.map((row) => row.day)).toEqual([1, 3]);
    expect(alive(f, target)).toBe(true);
  });
}
