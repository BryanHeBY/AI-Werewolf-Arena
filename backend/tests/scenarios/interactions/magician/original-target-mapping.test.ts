/**
 * Interaction scenarios verify Magician original requested targets map through actual knife, potion, inspection and death-gun cycles.
 * Input: Original exchange/shot policy plans, controlled role actions and required or stale replies.
 * Output and oracle: Explicit mapped effects, requested-number privacy and paid/failure assertions retain original night-origin scope; expected target/action tables are unchanged.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  PotionType,
  Role,
  type RoleComponent,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/core";
import type { AliveComponent } from "../../../../src/core/domain/components/alive";
import { magicianTwelveConfig } from "../../../../src/runtime/scenarios/magician_twelve";
import { getWitchState } from "../../../../src/game/mechanisms/roles/witch/ports";
import {
  isMagicianBoard,
  resolveMagicianNightTarget,
} from "../../../../src/game/mechanisms/roles/magician/night_frame";
function fixture(shot: "original" | "exchanged" = "original") {
  const config = structuredClone(magicianTwelveConfig);
  config.magician!.deathShotTargetPolicy = shot;
  const f = bootstrapGame(config, {
    fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
  });
  const id = (role: Role) =>
    f.world
      .entityIds()
      .find((id) => f.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === role)!;
  const alive = (id: number) => f.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive;
  return { ...f, config, id, alive };
}
function provider(
  _f: ReturnType<typeof fixture>,
  pair: [number, number],
  knife: number,
  potion: "heal" | "poison" | "none" = "none",
  potionTarget = knife,
  shots: Record<number, number> = {},
) {
  const seen: ActionRequest[] = [];
  return {
    seen,
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      seen.push(r);
      if (r.allowedTools.includes("swap_targets"))
        return {
          name: "swap_targets",
          args: { first_id: pair[0], second_id: pair[1], abstain: false },
        };
      if (r.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "pass", end_chat: true } };
      if (r.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: knife, abstain: false } };
      if (r.allowedTools.includes("use_potion"))
        return {
          name: "use_potion",
          args: { target_id: potionTarget, potion_type: potion as PotionType },
        };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: pair[1] } };
      if (r.allowedTools.includes("shoot"))
        return { name: "shoot", args: { target_id: shots[r.actorId] ?? null } };
      if (r.allowedTools.includes("run_for_sheriff"))
        return { name: "run_for_sheriff", args: { run: false } };
      if (r.allowedTools.includes("vote_for_sheriff"))
        return { name: "vote_for_sheriff", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("choose_badge_successor"))
        return { name: "choose_badge_successor", args: { target_id: null } };
      if (r.allowedTools.includes("choose_direction"))
        return { name: "choose_direction", args: { direction: "clockwise" } };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "pass" } };
      if (r.allowedTools.includes("self_destruct"))
        return { name: "self_destruct", args: { reason: "pass", confirm: false } };
      throw new Error("unexpected_magician_tool:" + r.allowedTools.join(","));
    },
  };
}
test("Magician actual World maps knife and camp check while retaining original requested number", async () => {
  const f = fixture(),
    wolf = f.id(Role.Wolf),
    v = f.id(Role.Villager);
  const p = provider(f, [wolf, v], v);
  await f.phaseManager.runSingleCycle(p);
  expect(isMagicianBoard(f.world)).toBe(true);
  expect(f.alive(wolf)).toBe(false);
  expect(f.alive(v)).toBe(true);
  const checks = f.phaseManager.getEvents().filter((e) => e.type === "seer_checked");
  expect(checks.length).toBe(1);
  expect(checks[0]!.payload).toMatchObject({ targetId: v, isWerewolf: true });
  expect(p.seen.find((r) => r.allowedTools.includes("use_potion"))?.context.wolf_target).toBe(v);
  expect(() => resolveMagicianNightTarget(f.world, 1, v)).toThrow("magician_night_unsettled");
});
test("Magician allows an original other-player heal to land on the Witch herself", async () => {
  const f = fixture(),
    w = f.id(Role.Witch),
    v = f.id(Role.Villager);
  const p = provider(f, [w, v], v, "heal", v);
  await f.phaseManager.runSingleCycle(p);
  expect(f.alive(w)).toBe(true);
  expect(f.alive(v)).toBe(true);
  expect(getWitchState(f.world.getComponent<RoleComponent>(w, COMPONENT.Role)!)!.heal).toBe(0);
  expect(p.seen.find((r) => r.allowedTools.includes("use_potion"))?.context.wolf_target).toBe(v);
});
test("Magician rejects healing an original self knife before spending a potion", async () => {
  const f = fixture(),
    w = f.id(Role.Witch),
    v = f.id(Role.Villager);
  await expect(f.phaseManager.runSingleCycle(provider(f, [w, v], w, "heal", w))).rejects.toThrow(
    "magician_witch_action_invalid",
  );
  expect(getWitchState(f.world.getComponent<RoleComponent>(w, COMPONENT.Role)!)!.heal).toBe(1);
  expect(() => resolveMagicianNightTarget(f.world, 1, v)).toThrow("magician_night_unsettled");
});
test("Magician maps poison onto the Witch without changing her requested target", async () => {
  const f = fixture(),
    w = f.id(Role.Witch),
    v = f.id(Role.Villager),
    knife = f.id(Role.Wolf);
  await f.phaseManager.runSingleCycle(provider(f, [w, v], knife, "poison", v));
  expect(f.alive(w)).toBe(false);
  expect(f.alive(v)).toBe(true);
  const events = f.phaseManager.getEvents().filter((e) => e.type === "witch_potion_used");
  expect(events.some((e) => e.payload.targetId === v && e.payload.potionType === "poison")).toBe(
    true,
  );
});
for (const policy of ["original", "exchanged"] as const)
  test("Magician delayed first-day night gun resolves explicit policy/" + policy, async () => {
    const f = fixture(policy),
      h = f.id(Role.Hunter),
      v = f.id(Role.Villager);
    const p = provider(f, [h, v], v, "none", v, { [h]: v });
    await f.phaseManager.runSingleCycle(p);
    expect(f.alive(h)).toBe(false);
    expect(f.alive(v)).toBe(policy === "exchanged");
    const misses = f.phaseManager.getEvents().filter((e) => e.type === "death_shot_missed");
    expect(misses.length).toBe(policy === "exchanged" ? 1 : 0);
    if (policy === "exchanged")
      expect(misses[0]!.payload).toEqual({ actorId: h, reason: "no_effect" });
  });
test("Magician keeps night-origin mapping through the subsequent Wolf King gun wave", async () => {
  const f = fixture("exchanged"),
    h = f.id(Role.Hunter),
    k = f.id(Role.WolfKing),
    v = f.id(Role.Villager),
    s = f.id(Role.Seer);
  await f.phaseManager.runSingleCycle(provider(f, [k, v], h, "none", h, { [h]: v, [k]: s }));
  expect(f.alive(h)).toBe(false);
  expect(f.alive(k)).toBe(false);
  expect(f.alive(s)).toBe(false);
  expect(f.alive(v)).toBe(true);
  const gun = f.phaseManager.getEvents().filter((e) => e.type === "wolf_king_shot");
  expect(gun.length).toBe(1);
});

for (const [tool, error] of [
  ["swap_targets", "magician_exchange_action_missing"],
  ["speak_to_wolves", "magician_wolf_chat_action_missing"],
  ["kill_vote", "magician_wolf_action_missing"],
  ["use_potion", "magician_witch_action_missing"],
  ["check_identity", "magician_seer_action_missing"],
  ["shoot", "magician_shot_action_missing"],
] as const) {
  test("Magician required action fails explicitly and closes its frame/" + tool, async () => {
    const f = fixture("exchanged"),
      h = f.id(Role.Hunter),
      v = f.id(Role.Villager);
    const base = provider(f, [h, v], v);
    await expect(
      f.phaseManager.runSingleCycle({
        async getAction(r: ActionRequest) {
          return r.allowedTools.includes(tool) ? null : base.getAction(r);
        },
      }),
    ).rejects.toThrow(error);
    expect(() => resolveMagicianNightTarget(f.world, 1, v)).toThrow("magician_night_unsettled");
  });
}
test("Magician refuses a late reply after in-place original identity mutation", async () => {
  const f = fixture(),
    v = f.id(Role.Villager),
    w = f.id(Role.Wolf);
  const base = provider(f, [w, v], v);
  await expect(
    f.phaseManager.runSingleCycle({
      async getAction(r: ActionRequest) {
        const action = await base.getAction(r);
        if (r.allowedTools.includes("check_identity")) {
          const role = f.world.getComponent<RoleComponent>(v, COMPONENT.Role)!;
          (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
            ...role.privateState,
          };
        }
        return action;
      },
    }),
  ).rejects.toThrow("magician_original_state_revoked");
});
