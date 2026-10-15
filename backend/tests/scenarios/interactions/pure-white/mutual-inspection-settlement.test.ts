/**
 * 交互场景测试：验证纯白／狼巫真实夜晚的查验优先级、互相死亡及终局猎人时点。输入为原语言／清边政策矩阵、配对行动及受控重入／失败回复；私有结果、整夜／公告次序及永久拒绝重入为字面预期，不重新生成行动或结果。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { pureWhiteTwelveConfig } from "../../../../src/runtime/scenarios/pure_white_twelve";
import {
  Camp,
  Role,
  Phase,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "../../../../src/domain/model";
import { COMPONENT } from "../../../../src/domain/components/names";
import type { RoleComponent } from "../../../../src/domain/components/role";
import type { AliveComponent } from "../../../../src/domain/components/alive";
import { getRoleInspectionState } from "../../../../src/game/mechanisms/roles/role_inspection/ports";

function fixture(
  locale: "zh-CN" | "en",
  priority: "awa_good_priority_v1" | "awa_wolf_priority_v1" = "awa_wolf_priority_v1",
) {
  const config = structuredClone(pureWhiteTwelveConfig);
  config.pureWhite!.eliminationPriority = priority;
  const game = bootstrapGame(config, { locale });
  const id = (role: Role) =>
    game.world
      .entityIds()
      .find((id) => game.world.getComponent(id, COMPONENT.Role)?.role === role)!;
  return { ...game, id, pure: id(Role.PureWhiteGirl), wolf: id(Role.WolfWitch) };
}
function provider(
  f: ReturnType<typeof fixture>,
  options: { inspectFirst?: boolean; knife?: number; wolfInspect?: number; shot?: number } = {},
  seen: ActionRequest[] = [],
) {
  return {
    getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
      seen.push(r);
      if (r.allowedTools.includes("inspect_night_identity")) {
        if (r.context.day === 1 && !options.inspectFirst)
          return { name: "inspect_night_identity", args: { target_id: null, abstain: true } };
        return {
          name: "inspect_night_identity",
          args: {
            target_id: r.actorId === f.pure ? f.wolf : (options.wolfInspect ?? f.pure),
            abstain: false,
          },
        };
      }
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
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: PotionType.None } };
      if (r.allowedTools.includes("run_for_sheriff"))
        return { name: "run_for_sheriff", args: { run: false } };
      if (r.allowedTools.includes("vote_for_sheriff"))
        return { name: "vote_for_sheriff", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: null, abstain: true } };
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
function nightDeaths(f: ReturnType<typeof fixture>): number[] {
  return f.phaseManager
    .getEvents()
    .filter((e) => e.type === "night_resolved")
    .at(-1)!.payload.deaths;
}
for (const locale of ["zh-CN", "en"] as const) {
  for (const priority of ["awa_wolf_priority_v1", "awa_good_priority_v1"] as const) {
    test(`actual paired mutual kill seals one complete night with ${priority}/${locale}`, async () => {
      const f = fixture(locale, priority);
      await f.phaseManager.runSingleCycle(provider(f), 10);
      for (const id of f.world.entityIds()) {
        const role = f.world.getComponent(id, COMPONENT.Role)!.role;
        if ([Role.Wolf, Role.Witch, Role.Hunter, Role.Guard].includes(role))
          f.world.getComponent(id, COMPONENT.Alive)!.alive = false;
      }
      const seen: ActionRequest[] = [];
      await f.phaseManager.runSingleCycle(provider(f, {}, seen), 10);
      expect([...nightDeaths(f)].sort((a, b) => a - b)).toEqual(
        [f.pure, f.wolf].sort((a, b) => a - b),
      );
      const snapshot = f.phaseManager.getSnapshot();
      expect(snapshot.gameOver).toBe(true);
      expect(snapshot.result?.winner).toBe(
        priority === "awa_wolf_priority_v1" ? Camp.Wolf : Camp.Good,
      );
      if (snapshot.result?.outcome.kind !== "victory") throw new Error("expected_victory");
      expect(snapshot.result.outcome.winningPlayerIds).toContain(
        priority === "awa_wolf_priority_v1" ? f.wolf : f.pure,
      );
      expect(seen.every((r) => r.phase === Phase.Night)).toBe(true);
      const events = f.phaseManager.getEvents();
      expect(events.findLastIndex((e) => e.type === "game_over")).toBeGreaterThan(
        events.findLastIndex((e) => e.type === "night_resolved"),
      );
    });
  }
  test(`pending first-night knife does not suppress either inspection ${locale}`, async () => {
    const f = fixture(locale),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(
      provider(f, { inspectFirst: true, knife: f.pure }, seen),
      10,
    );
    expect(nightDeaths(f)).toEqual([f.pure]);
    for (const id of [f.pure, f.wolf])
      expect(
        getRoleInspectionState(f.world.getComponent(id, COMPONENT.Role)!)?.history,
      ).toHaveLength(1);
    expect(f.world.getComponent(f.wolf, COMPONENT.Alive)?.alive).toBe(true);
    expect(
      seen
        .filter((r) => r.context.stage === "sheriff_nomination")
        .every((r) => r.actorId !== f.pure),
    ).toBe(true);
  });
  test(`terminal wolf inspection still completes hunter shot before death announcement ${locale}`, async () => {
    const f = fixture(locale);
    await f.phaseManager.runSingleCycle(provider(f), 10);
    for (const id of f.world.entityIds())
      if (f.world.getComponent(id, COMPONENT.Role)?.role === Role.Wolf)
        f.world.getComponent(id, COMPONENT.Alive)!.alive = false;
    const hunter = f.id(Role.Hunter),
      victim = f.id(Role.Villager),
      seen: ActionRequest[] = [];
    await f.phaseManager.runSingleCycle(
      provider(f, { knife: hunter, wolfInspect: hunter, shot: victim }, seen),
      10,
    );
    expect([...nightDeaths(f)].sort((a, b) => a - b)).toEqual(
      [f.wolf, hunter, victim].sort((a, b) => a - b),
    );
    expect(f.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
    expect(seen.some((r) => r.allowedTools.includes("shoot") && r.actorId === hunter)).toBe(true);
    expect(f.world.getComponent(f.pure, COMPONENT.Alive)?.alive).toBe(true);
  });
}

test("a pure-white cycle cannot reenter during an awaited choice or restart a failed night", async () => {
  const f = fixture("en");
  const base = provider(f);
  let checked = false;
  const wrapped = {
    getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
      if (!checked && r.allowedTools.includes("inspect_night_identity")) {
        checked = true;
        await expect(f.phaseManager.runSingleCycle(base, 10)).rejects.toThrow(
          "pure_white_cycle_reentry",
        );
        return null;
      }
      return base.getAction(r);
    },
  };
  await expect(f.phaseManager.runSingleCycle(wrapped, 10)).rejects.toThrow(
    "pure_white_inspection_action_missing",
  );
  expect(checked).toBe(true);
  await expect(f.phaseManager.runSingleCycle(base, 10)).rejects.toThrow("pure_white_cycle_reentry");
});
