/**
 * 场景测试通过实际请求、死亡连锁、文件记录与严格 Tape 复现验证狼美人／摄梦人的历史政策。
 * 输入保留原语言／政策／行动矩阵；手写因果结果和篡改拒绝是预期，原 replay 与 World 对照
 * 仍保留，但不能把该对照称为独立完整对局验证。
 */
import { captureNativeRolePresentation } from "../../../src/game/observation/native-role-presentation-capture";
import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  createRandom,
  Phase,
  PotionType,
  Role,
  WinCondition,
  COMPONENT,
  type BoardConfig,
  type ActionProvider,
  type ActionRequest,
  type RoleComponent,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../src/runtime/config/board_definition";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../../src/runtime/game_event_recorder";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
import { getDreamerState } from "../../../src/game/mechanisms/roles/dreamer/ports";
import { getWolfBeautyState } from "../../../src/game/mechanisms/roles/wolf_beauty/ports";
import {
  getDefaultConfigRenderRegistry,
  getDefaultRoleCatalog,
} from "../../../src/game/mechanisms";
import {
  projectDreamerState,
  projectWolfBeautyState,
} from "../../../src/game/mechanisms/roles/player_state";

function config(roles: Role[]): BoardConfig {
  return {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    enableSheriff: false,
    winConditions: [WinCondition.SlaughterCity],
    selfDestruct: { enabledWindows: [] },
  };
}

for (const kind of ["poison", "hunter", "wolf_king", "black_backlash"] as const)
  for (const alternate of [false, true])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${kind}/${alternate}/${locale}: normalized policy, real requests/death chain and recorded strict Tape`, async () => {
        const roles =
          kind === "black_backlash"
            ? [
                Role.Dreamer,
                Role.BlackMarketMerchant,
                Role.Wolf,
                Role.Wolf,
                Role.Villager,
                Role.Villager,
              ]
            : [
                Role.WolfBeauty,
                Role.Wolf,
                kind === "wolf_king" ? Role.WolfKing : Role.Hunter,
                Role.Witch,
                Role.Dreamer,
                Role.Villager,
              ];
        const raw = boardDefinitionFromConfig("historical_policy", config(roles));
        if (kind === "black_backlash")
          raw.roles.dreamer = {
            protectionPolicy: alternate ? "netease_2026_night_immunity_v1" : "awa_night_damage_v1",
          };
        else
          raw.roles.wolf_beauty = {
            deathLinkPolicy: alternate ? "heroes_s7_2017_exile_hunter_v1" : "awa_exile_poison_v1",
          };
        const normalized = parseBoardDefinition(raw).config;
        expect(
          parseBoardDefinition(boardDefinitionFromConfig("historical_policy", normalized)).config,
        ).toEqual(normalized);
        const policy =
          kind === "black_backlash"
            ? normalized.dreamer!.protectionPolicy
            : normalized.wolfBeauty!.deathLinkPolicy;
        const game = bootstrapGame(normalized, {
          fixedRoles: roles,
          random: createRandom("historical-policy"),
        });
        const holder = 1,
          role = game.world.getComponent(holder, COMPONENT.Role)!;
        expect(captureNativeRolePresentation(roles[holder - 1], role, locale, undefined, () => game.world.getComponent(holder, COMPONENT.Camp))).toContain(policy);
        expect(
          getDefaultConfigRenderRegistry().renderBoardConfigPrompt(normalized, locale),
        ).toContain(policy);
        if (kind === "black_backlash")
          expect(
            String(
              projectDreamerState(getDreamerState(role)).protectionPolicy ?? "awa_night_damage_v1",
            ),
          ).toEqual(String(policy));
        else
          expect(
            String(
              projectWolfBeautyState(getWolfBeautyState(role)).deathLinkPolicy ??
                "awa_exile_poison_v1",
            ),
          ).toEqual(String(policy));
        const root = await createTestTempDirectory("awa-historical-policy-"),
          output = await createTestTempDirectory("awa-historical-policy-replay-");
        const manager = await SessionRecordManager.create(
          {
            sessionId: "historical-policy",
            board: "historical_policy",
            startedAtIso: "2026-10-09T00:00:00.000Z",
          },
          root,
        );
        const trace = beginGameReproduction(manager, game, {
          engine: await currentEngineVersion(),
          boardId: "historical_policy",
          ...(void normalized, {}),
          locale,
          maxDays: 1,
        });
        const requests: ActionRequest[] = [];
        const actions: ActionProvider = {
          async getAction(req) {
            requests.push(req);
            if (req.allowedTools.includes("dream"))
              return { name: "dream", args: { target_id: kind === "black_backlash" ? 2 : 6 } };
            if (req.allowedTools.includes("black_market_trade"))
              return { name: "black_market_trade", args: { target_id: 3, skill: "check" } };
            if (req.allowedTools.includes("speak_to_wolves"))
              return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
            if (req.allowedTools.includes("kill_vote"))
              return {
                name: "kill_vote",
                args: {
                  target_id: kind === "hunter" || kind === "wolf_king" ? 3 : null,
                  abstain: kind !== "hunter" && kind !== "wolf_king",
                },
              };
            if (req.allowedTools.includes("charm"))
              return { name: "charm", args: { target_id: 4 } };
            if (req.allowedTools.includes("use_potion"))
              return {
                name: "use_potion",
                args: {
                  target_id: kind === "poison" ? 1 : 4,
                  potion_type: kind === "poison" ? PotionType.Poison : PotionType.None,
                },
              };
            if (req.allowedTools.includes("shoot"))
              return { name: "shoot", args: { target_id: 1 } };
            if (req.allowedTools.includes("speak"))
              return { name: "speak", args: { text: "Offline" } };
            if (req.allowedTools.includes("vote"))
              return { name: "vote", args: { target_id: null, abstain: true } };
            throw new Error(`Unexpected ${req.context.stage}`);
          },
        };
        const provider = { getAction: (req: ActionRequest) => trace.decide(req, actions) };
        const recorder = new GameEventRecorder(
          { world: game.world, replayManager: manager },
          Phase.Night,
        );
        await runWithSessionRecorder(manager, async () => {
          let cycle = 0;
          while (!game.phaseManager.getSnapshot().gameOver) {
            await game.phaseManager.runSingleCycle(provider, 1);
            trace.checkpoint(
              captureCheckpoint(
                game.world,
                game.phaseManager.getSnapshot(),
                ++cycle,
                true,
                game.phaseManager.getEvents().length,
              ),
              game.phaseManager.getEvents(),
            );
            recorder.flush(game.phaseManager.getEvents());
          }
          const snapshot = game.phaseManager.getSnapshot();
          await manager.finalize({
            endedAtIso: "2026-10-09T00:01:00.000Z",
            winner: snapshot.result?.winner ?? null,
            ...(snapshot.result ? { gameResult: snapshot.result } : {}),
            finishReason: snapshot.result?.reason ?? "completed",
            players: captureCheckpoint(game.world, snapshot, cycle, true, 0).players.map((p) => ({
              player_id: p.id,
              role: p.role,
              camp: p.camp,
              alive: p.alive,
            })),
          });
        });
        const record = await readReproduction(
          path.join(root, "historical-policy/reproduction.json"),
        );
        expect(record.metadata.normalizedBoard).toEqual(normalized);
        expect(
          requests
            .filter((r) => r.allowedTools.includes("dream"))
            .every((r) => r.context.turn_constraints.min_valid_actions === 1),
        ).toBe(true);
        expect(
          requests
            .filter((r) => r.allowedTools.includes("charm"))
            .every((r) => r.context.turn_constraints.min_valid_actions === 0),
        ).toBe(true);
        const charms = record.events.filter((e) => e.type === "charm_death");
        if (kind === "black_backlash") {
          expect(game.world.getAliveEntityIds().includes(2)).toBe(alternate);
          expect(charms).toHaveLength(0);
          expect(
            record.events.filter((e) => e.type === "black_market_trade_committed"),
          ).toHaveLength(1);
        } else {
          expect(charms.map((e) => e.payload.targetId)).toEqual(
            (kind === "poison" ? !alternate : kind === "hunter" ? alternate : false) ? [4] : [],
          );
          expect(game.world.getAliveEntityIds().includes(4)).toBe(
            !(kind === "poison" ? !alternate : kind === "hunter" ? alternate : false),
          );
        }
        expect(game.world.activeDeathActionCount).toBe(0);
        const replay = await replayReproduction(record, output);
        expect(replay.snapshot).toEqual(game.phaseManager.getSnapshot());
        expect(replay.eventCount).toBe(record.events.length);
        expect(replay.decisionCount).toBe(record.decisions.length);
        // Changing policy while preserving recorded decisions/events cannot masquerade as the original Tape.
        const changed = structuredClone(record);
        if (kind === "black_backlash")
          changed.metadata.normalizedBoard.dreamer!.protectionPolicy = alternate
            ? "awa_night_damage_v1"
            : "netease_2026_night_immunity_v1";
        else
          changed.metadata.normalizedBoard.wolfBeauty!.deathLinkPolicy = alternate
            ? "awa_exile_poison_v1"
            : "heroes_s7_2017_exile_hunter_v1";
        if (kind !== "wolf_king")
          await expect(
            replayReproduction(changed, await createTestTempDirectory("awa-historical-tamper-")),
          ).rejects.toThrow();
      });
