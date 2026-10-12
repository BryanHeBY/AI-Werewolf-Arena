/**
 * Gifted gun scenarios verify actual PM/whole-night activation, ordered native/gift deaths and final judgment with real recording.
 * Input: Original fixed role plans, controlled stage providers and existing temporary session files where the original case records.
 * Output and oracle: Handwritten gun/death/order, exact recorded assertions and reentry behavior remain unchanged; source/fixture bytes and expected data are not regenerated.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Phase, Role, type ActionRequest, type GameEvent, type RoleComponent } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { allDeathGuns, grantDeathGun } from "../../../src/game/mechanisms/roles/death_abilities";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { NightPipeline } from "../../../src/game/engine/phase_pipeline/night_pipeline";
import { DamageResolutionSystem } from "../../../src/core/domain/systems/damage_resolution_system";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { NightStageRegistry } from "../../../src/game/mechanisms/stages/night/night_stage_registry";

const roles = [Role.Wolf, Role.Hunter, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

function fixture(locale: "en" | "zh-CN" = "en", target = 2) {
  const config = {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((r) => r === role).length,
      })),
    },
    game = bootstrapGame(config, { fixedRoles: roles, locale }),
    events: GameEvent[] = [];
  const gun = grantDeathGun(game.world, 3, target, 1, events);
  return {
    ...game,
    config,
    events,
    gun,
    state: { day: 1, phase: Phase.Day, gameOver: false, result: null },
  };
}

type Game = ReturnType<typeof fixture>;

const role = (game: Game, id = 2) => game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

for (const first of [1, 3])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${first}/${locale}: a complete PhaseManager night finishes both guns and deaths before judging last Wolf or last God`, async () => {
      const deck = [Role.Wolf, Role.Hunter, Role.Seer, Role.Villager, Role.Villager, Role.Villager],
        config = {
          ...sixPlayerMvpConfig,
          roleSetups: [...new Set(deck)].map((role) => ({
            role,
            count: deck.filter((r) => r === role).length,
          })),
        },
        game = bootstrapGame(config, {
          fixedRoles: deck,
          locale,
          playerNames: Object.fromEntries(deck.map((_, i) => [String(i + 1), `Seat ${i + 1}`])),
        });
      const initial: GameEvent[] = [],
        gun = grantDeathGun(game.world, 3, 2, 1, initial);
      const shoots: ActionRequest[] = [];
      const root = await createTestTempDirectory("awa-gift-gun-controlled-"),
        sessionId = `controlled-gift-${first}-${locale}`,
        opening = [...game.phaseManager.getEvents()],
        manager = await SessionRecordManager.create(
          {
            sessionId,
            board: "controlled_gift_gun",
            locale,
            startedAtIso: new Date(
              Math.min(...opening.map((e) => e.timestamp), ...initial.map((e) => e.timestamp)),
            ).toISOString(),
          },
          root,
        ),
        recorder = new GameEventRecorder({ world: game.world, replayManager: manager }, "night");
      recorder.flush([...opening, ...initial]);
      await runWithSessionRecorder(manager, () =>
        game.phaseManager.runSingleCycle({
          async getAction(request) {
            if (request.allowedTools.includes("speak_to_wolves"))
              return { name: "speak_to_wolves", args: { text: "Raw", end_chat: true } };
            if (request.allowedTools.includes("kill_vote"))
              return { name: "kill_vote", args: { target_id: 2, abstain: false } };
            if (request.allowedTools.includes("check_identity"))
              return { name: "check_identity", args: { target_id: 1 } };
            if (request.allowedTools.includes("speak"))
              return { name: "speak", args: { text: "Raw" } };
            if (request.allowedTools.includes("shoot")) {
              shoots.push(request);
              expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
              return {
                name: "shoot",
                args: { target_id: shoots.length === 1 ? first : first === 1 ? 3 : 1 },
              };
            }
            throw new Error("unexpected_phase_request");
          },
        }),
      );
      expect(shoots).toHaveLength(2);
      expect(gun).toMatchObject({ armedOnNight: 1, remaining: 0, deathExpired: true });
      expect(game.world.getAliveEntityIds()).toEqual([4, 5, 6]);
      const events = game.phaseManager.getEvents();
      expect(
        events
          .filter((e) => e.type === "hunter_shot" || e.type === "player_shot")
          .map((e) => e.payload.targetId),
      ).toEqual([first, first === 1 ? 3 : 1]);
      expect(events.findIndex((e) => e.type === "player_shot")).toBeLessThan(
        events.findIndex((e) => e.type === "game_over"),
      );
      expect(events.at(-1)!.type).toBe("game_over");
      expect(game.phaseManager.getSnapshot().result).toMatchObject({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        decidedAt: { day: 1, phase: Phase.Day, checkpoint: "night_settled" },
        outcome: { winningPlayerIds: [2, 3, 4, 5, 6] },
      });
      recorder.flush([...opening, ...initial, ...events.slice(opening.length)]);
      await manager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: Camp.Good,
        finishReason: "test",
        gameResult: game.phaseManager.getSnapshot().result!,
        players: deck.map((role, i) => ({
          player_id: i + 1,
          role,
          camp: i === 0 ? "wolf" : "good",
          alive: game.world.getAliveEntityIds().includes(i + 1),
          name: `Seat ${i + 1}`,
        })),
      });
      await writeFile(
        `/tmp/awa-gift-gun-controlled-${first}-${locale}.replay.json`,
        await readFile(path.join(root, sessionId, "replay.json"), "utf8"),
      );
    });

test("only actual final night activation arms a gift; same World/night cannot replay its committed activation", async () => {
  const game = fixture("en", 5),
    pipeline = new NightPipeline({
      world: game.world,
      events: game.events,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
  let current = true;
  const provider = {
    async getAction(request: ActionRequest) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves" as const, args: { text: "Raw", end_chat: true } };
      if (request.allowedTools.includes("kill_vote")) {
        current = false;
        return { name: "kill_vote" as const, args: { target_id: 5, abstain: false } };
      }
      if (request.allowedTools.includes("guard"))
        return { name: "guard" as const, args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity" as const, args: { target_id: 1 } };
      throw new Error("unexpected_tool");
    },
  };
  expect(
    (await pipeline.execute(game.config, provider, 1, { isCurrent: () => current })).interrupted,
  ).toBe(true);
  expect(game.gun.armedOnNight).toBeNull();
  current = true;
  const complete = {
    async getAction(request: ActionRequest) {
      if (request.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves" as const, args: { text: "Raw", end_chat: true } };
      if (request.allowedTools.includes("kill_vote"))
        return { name: "kill_vote" as const, args: { target_id: 5, abstain: false } };
      if (request.allowedTools.includes("guard"))
        return { name: "guard" as const, args: { target_id: null, abstain: true } };
      if (request.allowedTools.includes("check_identity"))
        return { name: "check_identity" as const, args: { target_id: 1 } };
      throw new Error("unexpected_tool");
    },
  };
  expect((await pipeline.execute(game.config, complete, 2)).interrupted).toBe(false);
  expect(game.gun.armedOnNight).toBe(2);
  await expect(pipeline.execute(game.config, complete, 2)).rejects.toThrow(
    "death_ability_night_reentry_after_commit",
  );
});

test("a declared death capability collects final activation before a gift is produced during the night", async () => {
  const config = {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((r) => r === role).length,
      })),
    },
    game = bootstrapGame(config, { fixedRoles: roles }),
    events: GameEvent[] = [];
  const catalog = new RoleCatalog(
      getDefaultRoleCatalog()
        .all()
        .map((profile) =>
          profile.role === Role.Seer
            ? {
                ...profile,
                possibleDeathAbilities: ["gun" as const],
                nightStages: [
                  ...(profile.nightStages ?? []),
                  {
                    id: "controlled_gift",
                    priority: 230,
                    async execute(
                      ctx: import("../../../src/game/mechanisms/stages/night/contracts").NightStageContext,
                    ) {
                      grantDeathGun(ctx.world, 3, 5, ctx.currentDay(), ctx.events);
                    },
                  },
                ],
              }
            : profile,
        ),
    ),
    stageRegistry = new NightStageRegistry(catalog);
  expect(allDeathGuns(game.world.getComponent<RoleComponent>(5, COMPONENT.Role))).toHaveLength(0);
  expect(
    stageRegistry
      .getStages(config, game.world)
      .some((stage) => stage.id === "death_ability_activation"),
  ).toBe(true);
  const pipeline = new NightPipeline({
    world: game.world,
    events,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    stageRegistry,
  });
  const result = await pipeline.execute(
    config,
    {
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "Raw", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (request.allowedTools.includes("guard"))
          return { name: "guard", args: { target_id: null, abstain: true } };
        return { name: "check_identity", args: { target_id: 1 } };
      },
    },
    1,
  );
  expect(result.interrupted).toBe(false);
  expect(
    allDeathGuns(game.world.getComponent<RoleComponent>(5, COMPONENT.Role))[0].armedOnNight,
  ).toBe(1);
});
