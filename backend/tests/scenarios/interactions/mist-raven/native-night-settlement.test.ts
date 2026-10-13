/**
 * 交互场景测试：验证雾鸦实际夜晚的延迟发言、单次蛇选择及原伤害时点。输入为既有公开板子字节、自爆／窗口／狼刀计划和首／次夜 provider；死亡、警徽、发言者与穿透梦的结果为字面预期，公开板子路径仍指同一来源。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../../src/runtime/config/board_definition";
import {
  ActionWindow,
  Role,
  Phase,
  COMPONENT,
  createRandom,
  type ActionRequest,
  type ToolCall,
  type AliveComponent,
  type BadgeComponent,
  type RoleComponent,
} from "../../../../src/core";

async function setup() {
  const raw = JSON.parse(
    await readFile(
      new URL("../../../../../configs.example/boards/awa_mist_raven_12_v1.json", import.meta.url),
      "utf8",
    ),
  );
  const board = parseBoardDefinition(raw);
  const game = bootstrapGame(board.config, {
    random: createRandom("mist-raven-real-runtime"),
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
  return { ...game, board };
}
test("real first night preserves all doomed speakers until one snake and never repeats damage marks", async () => {
  const game = await setup(),
    order: string[] = [];
  const provider = {
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      const stage = request.context.stage;
      order.push(`${stage}:${request.actorId}`);
      if (stage === "alchemist_mist") return { name: "cast_mist", args: { target_ids: null } };
      if (stage === "dreamer") return { name: "dream", args: { target_id: 8 } };
      if (stage === "wolf_discussion") {
        expect(request.context.wolf_kill_candidates).toEqual([
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
        ]);
        expect(request.context.wolf_targets).toBeUndefined();
        expect(request.actorId).not.toBe(9);
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      }
      if (stage === "wolf_vote")
        return { name: "kill_vote", args: { target_id: 5, abstain: false } };
      if (stage === "seer") return { name: "check_identity", args: { target_id: 9 } };
      if (stage === "sheriff_nomination") return { name: "run_for_sheriff", args: { run: false } };
      if (stage === "day_speech") {
        expect(game.world.getComponent(5, COMPONENT.Alive)!.alive).toBe(true);
        expect(game.phaseManager.getEvents().some((event) => event.type === "night_resolved")).toBe(
          false,
        );
        return { name: "speak", args: { text: "Speech" } };
      }
      if (stage === "alchemist_snake") {
        expect(request.context.snake_target).toBe(5);
        expect(request.context.snake_candidates).toEqual([5]);
        expect(order.filter((value) => value.startsWith("day_speech:")).length).toBe(12);
        expect(game.world.getAliveEntityIds()).toHaveLength(12);
        return { name: "use_snake", args: { target_id: 5 } };
      }
      if (stage === "voting")
        return {
          name: "vote",
          args: { target_id: request.actorId === 10 ? null : 10, abstain: request.actorId === 10 },
        };
      if (stage === "last_words") return { name: "speak", args: { text: "Words" } };
      return null;
    },
  };
  const result = await game.phaseManager.runSingleCycle(provider);
  expect(result).toMatchObject({ day: 2, phase: Phase.Voting, gameOver: false });
  expect(order.filter((value) => value.startsWith("alchemist_snake:")).length).toBe(1);
  expect(
    game.phaseManager.getEvents().find((event) => event.type === "night_resolved")?.payload,
  ).toEqual({ deaths: [] });
  expect(game.world.getAliveEntityIds()).toContain(5);
  expect(game.world.getAliveEntityIds()).not.toContain(10);
  expect(
    (
      game.world.getComponent(1, COMPONENT.Role)!.privateState as {
        readonly alchemist?: unknown;
      }
    ).alchemist,
  ).toMatchObject({ healRemaining: 0, healHistory: [{ day: 1, targetId: 5 }] });
});
for (const window of Object.values(ActionWindow))
  test(`real ${window} blast commits death and badge before its unique snake`, async () => {
    const game = await setup(),
      order: string[] = [],
      snake: number[] = [];
    let blasted = false;
    const result = await game.phaseManager.runSingleCycle({
      async getAction(request): Promise<ToolCall | null> {
        const stage = request.context.stage;
        order.push(stage);
        if (stage === "alchemist_mist") return { name: "cast_mist", args: { target_ids: null } };
        if (stage === "dreamer") return { name: "dream", args: { target_id: 8 } };
        if (stage === "wolf_discussion")
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (stage === "wolf_vote")
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (stage === "seer") return { name: "check_identity", args: { target_id: 9 } };
        if (stage === "sheriff_nomination")
          return { name: "run_for_sheriff", args: { run: request.actorId === 10 } };
        if (stage === window && request.actorId === 10 && !blasted) {
          blasted = true;
          return { name: "self_destruct", args: { reason: "Blast", confirm: true } };
        }
        if (stage === "sheriff_badge_choice")
          return {
            name: "choose_badge_successor",
            args: { target_id: game.world.getAliveEntityIds().includes(5) ? 5 : 6 },
          };
        if (stage === "day_speech" || stage === "last_words" || stage === "sheriff_campaign_speech")
          return { name: "speak", args: { text: "Speech" } };
        if (stage === "alchemist_snake") {
          snake.push(request.actorId);
          if (window !== ActionWindow.OnPreVote) {
            expect(game.world.getAliveEntityIds()).not.toContain(10);
            if (window !== ActionWindow.OnPreElection)
              expect(game.world.getComponent(5, COMPONENT.Badge)!.isSheriff).toBe(
                true,
              );
          }
          expect(game.world.getAliveEntityIds()).toContain(5);
          return { name: "use_snake", args: { target_id: null } };
        }
        if (stage === "sheriff_choose_direction")
          return { name: "choose_direction", args: { direction: "clockwise" } };
        return null;
      },
    });
    expect(blasted).toBe(true);
    expect(snake).toEqual([1]);
    expect(result).toMatchObject({ day: 2, phase: Phase.Night, gameOver: false });
    expect(game.world.getAliveEntityIds()).not.toContain(10);
    expect(game.world.getAliveEntityIds()).not.toContain(5);
    expect(order).not.toContain("voting");
    const events = game.phaseManager.getEvents(),
      chosen = events.findIndex((event) => event.type === "alchemist_snake_chosen"),
      blast = events.findIndex((event) => event.type === "wolf_self_destruct");
    expect(chosen >= 0 && blast >= 0).toBe(true);
    expect(window === ActionWindow.OnPreVote ? chosen < blast : blast < chosen).toBe(true);
  });

test("real all-pass mist draw binds an actual original knife and strikes inside an all-wolf circle", async () => {
  const game = await setup();
  let chosen: number | null = null;
  await game.phaseManager.runSingleCycle({
    async getAction(request): Promise<ToolCall | null> {
      const stage = request.context.stage;
      if (stage === "alchemist_mist")
        return { name: "cast_mist", args: { target_ids: [10, 11, 12] } };
      if (stage === "dreamer") return { name: "dream", args: { target_id: 8 } };
      if (stage === "wolf_discussion") {
        expect(request.context.wolf_kill_candidates).toEqual([10, 11, 12]);
        expect(request.context.wolf_targets).toBeUndefined();
        expect(request.actorId).not.toBe(9);
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      }
      if (stage === "wolf_vote") {
        expect(request.context.wolf_kill_candidates).toEqual([10, 11, 12]);
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      }
      if (stage === "seer") return { name: "check_identity", args: { target_id: 9 } };
      if (stage === "sheriff_nomination") return { name: "run_for_sheriff", args: { run: false } };
      if (stage === "alchemist_snake") {
        chosen = request.context.snake_target ?? null;
        expect(chosen).not.toBeNull();
        expect([10, 11, 12]).toContain(chosen!);
        return { name: "use_snake", args: { target_id: null } };
      }
      if (stage === "voting")
        return {
          name: "vote",
          args: { target_id: request.actorId === 9 ? null : 9, abstain: request.actorId === 9 },
        };
      if (stage === "day_speech" || stage === "last_words")
        return { name: "speak", args: { text: "Speech" } };
      return null;
    },
  });
  // Independent FNV/Mulberry hand calculation for seed+night+day:1:mist-knife:
  // draw=0.5371968341059983, index=1; fixture outcome is not read from production RNG.
  expect(chosen as number | null).toBe(11);
  expect(game.world.getAliveEntityIds()).not.toContain(chosen!);
  const draw = game.phaseManager.getEvents().filter((event) => event.type === "mist_knife_drawn");
  expect(draw).toHaveLength(1);
  expect(draw[0]?.payload).toEqual({ day: 1, candidates: [10, 11, 12], targetId: chosen });
  expect(
    game.phaseManager.getEvents().find((event) => event.type === "night_resolved")?.payload,
  ).toEqual({ deaths: [chosen!] });
});
test("real second-night Raven unseals and penetrates a dream-protected target despite Snake", async () => {
  const game = await setup();
  let ravenTurn = 0;
  const provider = {
    async getAction(request: ActionRequest): Promise<ToolCall | null> {
      const stage = request.context.stage,
        day = request.context.day;
      if (stage === "alchemist_mist") return { name: "cast_mist", args: { target_ids: null } };
      if (stage === "dreamer") return { name: "dream", args: { target_id: day === 1 ? 8 : 5 } };
      if (stage === "wolf_discussion")
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (stage === "wolf_vote")
        return { name: "kill_vote", args: { target_id: day === 1 ? 11 : 5, abstain: false } };
      if (stage === "raven_knife") {
        ravenTurn++;
        expect(request.actorId).toBe(9);
        expect(day).toBe(2);
        return { name: "raven_knife", args: { target_id: 5 } };
      }
      if (stage === "seer") return { name: "check_identity", args: { target_id: 9 } };
      if (stage === "sheriff_nomination") return { name: "run_for_sheriff", args: { run: false } };
      if (stage === "alchemist_snake")
        return { name: "use_snake", args: { target_id: day === 1 ? null : 5 } };
      if (stage === "voting") {
        const target = day === 1 ? 12 : 9;
        return {
          name: "vote",
          args: {
            target_id: request.actorId === target ? null : target,
            abstain: request.actorId === target,
          },
        };
      }
      if (stage === "day_speech" || stage === "last_words")
        return { name: "speak", args: { text: "Speech" } };
      return null;
    },
  };
  await game.phaseManager.runSingleCycle(provider);
  expect(game.world.getAliveEntityIds()).not.toContain(11);
  expect(game.world.getAliveEntityIds()).not.toContain(12);
  await game.phaseManager.runSingleCycle(provider);
  expect(ravenTurn).toBe(1);
  expect(game.world.getAliveEntityIds()).not.toContain(5);
  const events = game.phaseManager.getEvents();
  expect(
    events.filter((event) => event.type === "raven_unsealed").map((event) => event.payload),
  ).toEqual([{ actorId: 9, day: 2, awakened: true, knownTeammateIds: [10] }]);
  expect(
    (
      game.world.getComponent(1, COMPONENT.Role)!.privateState as {
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
});
