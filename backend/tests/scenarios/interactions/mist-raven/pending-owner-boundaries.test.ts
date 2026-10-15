/**
 * 交互场景验证雾鸦待处理所有者在失败后保留原生命、已付款效果与唯一蛇能力权限。输入为既有
 * 公开板子字节、受控当前性／重入／生命／目标修改及真实阶段周期回复；原错误、库存、关闭窗口
 * 和未发表／排队死亡前缀验证所有者顺序，来源板子与行动矩阵保持原样。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/app/config/board-definition";
import {
  ActionWindow,
  Role,
  Phase,
  COMPONENT,
  type ActionRequest,
  type ToolCall,
  type AliveComponent,
  type RoleComponent,
} from "../../../../src/domain";
import {
  beginMistNight,
  snakeWindowTargets,
} from "../../../../src/features/mist-raven/night-frame";
async function setup() {
  const raw = JSON.parse(
    await readFile(
      new URL("../../../../../configs.example/boards/awa_mist_raven_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  return bootstrapGame(parseBoardDefinition(raw).config, {
    fixedRoles: [
      Role.Alchemist,
      Role.Seer,
      Role.Dreamer,
      Role.Idiot,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.RavenClawWolf,
      Role.Wolf,
      Role.Wolf,
      Role.Wolf,
    ],
  });
}
function normal(q: ActionRequest): ToolCall | null {
  const s = q.context.stage;
  if (s === "alchemist_mist") return { name: "cast_mist", args: { target_ids: null } };
  if (s === "dreamer") return { name: "dream", args: { target_id: 8 } };
  if (s === "wolf_discussion")
    return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
  if (s === "wolf_vote") return { name: "kill_vote", args: { target_id: 5, abstain: false } };
  if (s === "seer") return { name: "check_identity", args: { target_id: 9 } };
  if (s === "sheriff_nomination") return { name: "run_for_sheriff", args: { run: false } };
  if (s === "day_speech" || s === "last_words" || s === "sheriff_campaign_speech")
    return { name: "speak", args: { text: "Review" } };
  if (s === "alchemist_snake") return { name: "use_snake", args: { target_id: null } };
  if (s === "voting")
    return {
      name: "vote",
      args: { target_id: q.actorId === 10 ? null : 10, abstain: q.actorId === 10 },
    };
  if (s === "sheriff_choose_direction")
    return { name: "choose_direction", args: { direction: "clockwise" } };
  if (s === "raven_knife") return { name: "raven_knife", args: { target_id: null } };
  return null;
}
function has(g: any, type: string) {
  return g.phaseManager.getEvents().filter((e: any) => e.type === type);
}
for (const [stage, id, revive] of [
  ["seer", 5, false],
  ["day_speech", 5, false],
  ["alchemist_snake", 1, false],
  ["alchemist_snake", 5, true],
] as const)
  test(`real ${stage} ${id} original life revoked (${revive}) closes pending`, async () => {
    const g = await setup();
    let changed = false;
    await expect(
      g.phaseManager.runSingleCycle({
        async getAction(q) {
          if (q.context.stage === stage && !changed) {
            changed = true;
            const life = g.world.getComponent(id, COMPONENT.Alive)!;
            if (revive) {
              life.alive = false;
              life.alive = true;
            } else g.world.addComponent(id, COMPONENT.Alive, createAliveComponent());
          }
          return normal(q);
        },
      }),
    ).rejects.toThrow("mist_original_roster_revoked");
    expect(changed).toBe(true);
    expect(has(g, "alchemist_snake_chosen")).toHaveLength(0);
    expect(has(g, "night_resolved")).toHaveLength(0);
    expect(
      (
        g.world.getComponent(1, COMPONENT.Role)!.privateState as {
          readonly alchemist?: unknown;
        }
      ).alchemist,
    ).toMatchObject({ healRemaining: 1 });
    expect(g.world.activeDeathActionCount).toBe(0);
    await expect(
      g.phaseManager.runSingleCycle({
        async getAction(q) {
          return normal(q);
        },
      }),
    ).rejects.toThrow("mist_cycle_reentry");
  });
test("real pipeline handoff cannot authorize a replacement body", async () => {
  const g = await setup(),
    p = (g.phaseManager as any).nightPipeline,
    execute = p.execute.bind(p);
  p.execute = async (...args: any[]) => {
    const result = await execute(...args);
    g.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
    return result;
  };
  await expect(
    g.phaseManager.runSingleCycle({
      async getAction(q) {
        return normal(q);
      },
    }),
  ).rejects.toThrow("mist_original_roster_revoked");
  expect(has(g, "night_resolved")).toHaveLength(0);
  expect(g.world.getAliveEntityIds()).toHaveLength(12);
});
test("real snake owns pending before await; rejected reentry does not abort original owner", async () => {
  const g = await setup();
  let checked = false;
  await g.phaseManager.runSingleCycle({
    async getAction(q) {
      if (q.context.stage === "alchemist_snake") {
        checked = true;
        expect((g.phaseManager as any).mistPending.status).toBe("committing");
        expect(() => g.phaseManager.jumpTo(Phase.Voting)).toThrow("mist_phase_reentry");
        await expect(
          g.phaseManager.runSingleCycle({
            async getAction(q) {
              return normal(q);
            },
          }),
        ).rejects.toThrow("mist_cycle_reentry");
        expect((g.phaseManager as any).mistPending.status).toBe("committing");
      }
      return normal(q);
    },
  });
  expect(checked).toBe(true);
  expect((g.phaseManager as any).mistPending.status).toBe("committed");
  expect(has(g, "alchemist_snake_chosen")).toHaveLength(1);
  expect(has(g, "night_resolved")).toHaveLength(1);
});
test("real provider failure aborts pending and unique snake window without refund or reopening", async () => {
  const g = await setup();
  const error = new Error("review_snake_failed");
  await expect(
    g.phaseManager.runSingleCycle({
      async getAction(q) {
        if (q.context.stage === "alchemist_snake") throw error;
        return normal(q);
      },
    }),
  ).rejects.toBe(error);
  expect((g.phaseManager as any).mistPending.status).toBe("aborted");
  expect(() => snakeWindowTargets(g.world, 1, 1)).toThrow("mist_night_unavailable");
  expect(() => beginMistNight(g.world, 1)).toThrow("mist_night_reentry");
  expect(has(g, "night_resolved")).toHaveLength(0);
  expect(g.world.activeDeathActionCount).toBe(0);
});
test("real death-await failure keeps the snake decision committed while aborting owner and closing tokens", async () => {
  const g = await setup();
  const error = new Error("review_last_words_failed");
  await expect(
    g.phaseManager.runSingleCycle({
      async getAction(q) {
        if (q.context.stage === "last_words") throw error;
        return normal(q);
      },
    }),
  ).rejects.toBe(error);
  expect((g.phaseManager as any).mistPending.status).toBe("aborted");
  expect(() => snakeWindowTargets(g.world, 1, 1)).toThrow("mist_night_unavailable");
  expect(g.world.getAliveEntityIds()).not.toContain(5);
  expect(g.world.activeDeathActionCount).toBe(0);
  expect(has(g, "night_resolved")).toHaveLength(1);
});
for (const heal of [true, false])
  test(`real Dreamer root healing ${heal} recomputes linked damage only afterward`, async () => {
    const g = await setup();
    await g.phaseManager.runSingleCycle({
      async getAction(q) {
        if (q.context.stage === "wolf_vote")
          return { name: "kill_vote", args: { target_id: 3, abstain: false } };
        if (q.context.stage === "alchemist_snake") {
          expect(g.world.getAliveEntityIds()).toContain(3);
          expect(g.world.getAliveEntityIds()).toContain(8);
          expect(has(g, "dream_death")).toHaveLength(0);
          return { name: "use_snake", args: { target_id: heal ? 3 : null } };
        }
        return normal(q);
      },
    });
    expect(has(g, "night_resolved")[0].payload.deaths).toEqual(heal ? [] : [3, 8]);
    expect(has(g, "dream_death").map((e: any) => e.payload)).toEqual(
      heal ? [] : [{ actorId: 3, targetId: 8, day: 1, reason: "linked" }],
    );
  });

test("real spent Snake returns later nights to ordinary death-before-speech without reopening", async () => {
  const g = await setup();
  let snakes = 0;
  const provider = {
    async getAction(q: ActionRequest): Promise<ToolCall | null> {
      if (q.context.stage === "dreamer")
        return { name: "dream", args: { target_id: q.context.day === 1 ? 8 : 7 } };
      if (q.context.stage === "wolf_vote")
        return {
          name: "kill_vote",
          args: { target_id: q.context.day === 1 ? 5 : 3, abstain: false },
        };
      if (q.context.stage === "alchemist_snake") {
        snakes++;
        return { name: "use_snake", args: { target_id: 5 } };
      }
      if (q.context.stage === "day_speech" && q.context.day === 2) {
        expect(g.world.getAliveEntityIds()).not.toContain(3);
        expect(g.world.getAliveEntityIds()).not.toContain(7);
      }
      if (q.context.stage === "voting") {
        const target = q.context.day === 1 ? 10 : 11;
        return {
          name: "vote",
          args: { target_id: q.actorId === target ? null : target, abstain: q.actorId === target },
        };
      }
      return normal(q);
    },
  };
  await g.phaseManager.runSingleCycle(provider);
  await g.phaseManager.runSingleCycle(provider);
  expect(snakes).toBe(1);
  expect(has(g, "night_resolved").map((e: any) => e.payload.deaths)).toEqual([[], [3, 7]]);
});
test("real dead Alchemist does not request Mist or Snake on the next night", async () => {
  const g = await setup();
  let requests: string[] = [];
  const provider = {
    async getAction(q: ActionRequest): Promise<ToolCall | null> {
      if (q.context.day === 2) requests.push(q.context.stage);
      if (q.context.stage === "dreamer")
        return { name: "dream", args: { target_id: q.context.day === 1 ? 8 : 7 } };
      if (q.context.stage === "wolf_vote")
        return {
          name: "kill_vote",
          args: { target_id: q.context.day === 1 ? 1 : 5, abstain: false },
        };
      if (q.context.stage === "voting") {
        const target = q.context.day === 1 ? 10 : 11;
        return {
          name: "vote",
          args: { target_id: q.actorId === target ? null : target, abstain: q.actorId === target },
        };
      }
      return normal(q);
    },
  };
  await g.phaseManager.runSingleCycle(provider);
  await g.phaseManager.runSingleCycle(provider);
  expect(requests).not.toContain("alchemist_mist");
  expect(requests).not.toContain("alchemist_snake");
  expect(has(g, "night_resolved").map((e: any) => e.payload.deaths)).toEqual([[1], [5]]);
});
test("real last wolf blast remains nonterminal until the original Snake resolves once", async () => {
  const g = await setup();
  let lastSnake = 0;
  const provider = {
    async getAction(q: ActionRequest): Promise<ToolCall | null> {
      const day = q.context.day,
        s = q.context.stage;
      if (s === "dreamer") return { name: "dream", args: { target_id: 9 - day } };
      if (s === "seer") return { name: "check_identity", args: { target_id: 10 } };
      if (s === "wolf_vote")
        return {
          name: "kill_vote",
          args: { target_id: day === 1 ? 11 : day === 2 ? 9 : 2, abstain: false },
        };
      if (s === "voting") {
        if (day === 1)
          return {
            name: "vote",
            args: { target_id: q.actorId === 12 ? null : 12, abstain: q.actorId === 12 },
          };
        return { name: "vote", args: { target_id: null, abstain: true } };
      }
      if (s === ActionWindow.OnDaybreak && day === 3 && q.actorId === 10)
        return { name: "self_destruct", args: { confirm: true, reason: "Last wolf" } };
      if (s === "alchemist_snake") {
        if (day === 3) {
          lastSnake++;
          expect(g.world.getAliveEntityIds()).not.toContain(10);
          expect(g.phaseManager.getSnapshot().gameOver).toBe(false);
          expect(q.context.snake_candidates).toEqual([2]);
          return { name: "use_snake", args: { target_id: 2 } };
        }
        return { name: "use_snake", args: { target_id: null } };
      }
      return normal(q);
    },
  };
  await g.phaseManager.runSingleCycle(provider);
  await g.phaseManager.runSingleCycle(provider);
  const out = await g.phaseManager.runSingleCycle(provider);
  expect(lastSnake).toBe(1);
  expect(out.gameOver).toBe(true);
  expect(g.world.getAliveEntityIds()).toContain(2);
  expect(has(g, "night_resolved").map((e: any) => e.payload.deaths)).toEqual([[11], [9], []]);
  expect((g.phaseManager as any).mistPending.status).toBe("committed");
  expect(g.world.activeDeathActionCount).toBe(0);
});
test("real Raven badge-await failure preserves spent healing stock and aborted pending owner", async () => {
  const g = await setup();
  const error = new Error("review_paid_last_words_failed");
  const provider = {
    async getAction(q: ActionRequest): Promise<ToolCall | null> {
      const day = q.context.day,
        s = q.context.stage;
      if (s === "dreamer") return { name: "dream", args: { target_id: day === 1 ? 8 : 7 } };
      if (s === "wolf_vote")
        return { name: "kill_vote", args: { target_id: day === 1 ? 11 : 5, abstain: false } };
      if (s === "raven_knife") return { name: "raven_knife", args: { target_id: 6 } };
      if (s === "alchemist_snake")
        return { name: "use_snake", args: { target_id: day === 1 ? null : 5 } };
      if (s === "sheriff_nomination")
        return { name: "run_for_sheriff", args: { run: q.actorId === 6 } };
      if (s === "sheriff_badge_choice" && day === 2) throw error;
      if (s === "voting")
        return {
          name: "vote",
          args: { target_id: q.actorId === 12 ? null : 12, abstain: q.actorId === 12 },
        };
      return normal(q);
    },
  };
  await g.phaseManager.runSingleCycle(provider);
  await expect(g.phaseManager.runSingleCycle(provider)).rejects.toBe(error);
  expect((g.phaseManager as any).mistPending.status).toBe("aborted");
  expect(g.world.activeDeathActionCount).toBe(0);
  expect(g.world.getAliveEntityIds()).toContain(5);
  expect(g.world.getAliveEntityIds()).not.toContain(6);
  expect(
    (
      g.world.getComponent(1, COMPONENT.Role)!.privateState as {
        readonly alchemist?: unknown;
      }
    ).alchemist,
  ).toMatchObject({
    healRemaining: 0,
    healHistory: [
      { day: 1, targetId: null },
      { day: 2, targetId: 5 },
    ],
  });
  expect(() => snakeWindowTargets(g.world, 2, 1)).toThrow("mist_night_unavailable");
});
test("real blast badge failure aborts an already-claimed owner without opening Snake", async () => {
  const g = await setup();
  const error = new Error("review_badge_failed");
  let sawClaim = false;
  await expect(
    g.phaseManager.runSingleCycle({
      async getAction(q) {
        const s = q.context.stage;
        if (s === "sheriff_nomination")
          return { name: "run_for_sheriff", args: { run: q.actorId === 10 } };
        if (s === ActionWindow.OnDaybreak && q.actorId === 10)
          return { name: "self_destruct", args: { confirm: true, reason: "Blast" } };
        if (s === "sheriff_badge_choice") {
          sawClaim = true;
          expect((g.phaseManager as any).mistPending.status).toBe("committing");
          expect(g.world.getAliveEntityIds()).not.toContain(10);
          throw error;
        }
        if (s === "alchemist_snake") throw new Error("review_snake_must_not_open");
        return normal(q);
      },
    }),
  ).rejects.toBe(error);
  expect(sawClaim).toBe(true);
  expect((g.phaseManager as any).mistPending.status).toBe("aborted");
  expect(g.world.activeDeathActionCount).toBe(0);
  expect(has(g, "night_resolved")).toHaveLength(0);
  expect(has(g, "alchemist_snake_chosen")).toHaveLength(0);
});

for (const stale of ["target", "voter"] as const)
  test(`non-pass target / original voter revocation (${stale}) never becomes random knife`, async () => {
    const g = await setup();
    let votes = 0;
    await expect(
      g.phaseManager.runSingleCycle({
        async getAction(q) {
          if (q.context.stage === "alchemist_mist")
            return { name: "cast_mist", args: { target_ids: [5, 6, 7] } };
          if (q.context.stage === "wolf_vote") {
            votes++;
            if (votes === 2)
              g.world.getComponent(stale === "target" ? 5 : 10, COMPONENT.Alive)!.alive = false;
            return {
              name: "kill_vote",
              args: {
                target_id: stale === "target" && votes === 1 ? 5 : null,
                abstain: !(stale === "target" && votes === 1),
              },
            };
          }
          return normal(q);
        },
      }),
    ).rejects.toThrow(stale === "target" ? "mist_wolf_target_stale" : "mist_wolf_actor_stale");
    expect(has(g, "mist_knife_drawn")).toHaveLength(0);
    expect(has(g, "night_resolved")).toHaveLength(0);
    expect(has(g, "game_over")).toHaveLength(0);
    expect(g.world.getAliveEntityIds()).toEqual(
      stale === "target"
        ? [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12],
    );
  });
for (const stage of ["alchemist_mist", "wolf_discussion", "wolf_vote", "alchemist_snake"] as const)
  test(`required ${stage} missing action preserves strict failure prefix`, async () => {
    const g = await setup();
    let failed = false;
    await expect(
      g.phaseManager.runSingleCycle({
        async getAction(q) {
          if (q.context.stage === stage) {
            failed = true;
            expect(q.context.allow_fallback).toBe(false);
            expect(q.context.action_failure_policy).toBe("error");
            expect(q.context.turn_constraints).toMatchObject({
              min_valid_actions: 1,
              max_valid_actions: 1,
            });
            return null;
          }
          return normal(q);
        },
      }),
    ).rejects.toThrow(
      stage === "alchemist_mist"
        ? "mist_choice_action_missing"
        : stage === "alchemist_snake"
          ? "snake_action_missing"
          : stage === "wolf_discussion"
            ? "mist_wolf_chat_action_missing"
            : "mist_wolf_action_missing",
    );
    expect(failed).toBe(true);
    expect(has(g, "night_resolved")).toHaveLength(0);
    expect(has(g, "game_over")).toHaveLength(0);
    expect(
      (
        g.world.getComponent(1, COMPONENT.Role)!.privateState as {
          readonly alchemist?: unknown;
        }
      ).alchemist,
    ).toMatchObject({ mistRemaining: 1, healRemaining: 1 });
    expect(g.world.activeDeathActionCount).toBe(0);
  });
