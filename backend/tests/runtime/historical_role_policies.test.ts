import { expect, test } from "bun:test";
import path from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import {
  createRandom,
  Phase,
  PotionType,
  Role,
  WinCondition,
  DeathCause,
  COMPONENT,
  type BoardConfig,
  type ActionProvider,
  type ActionRequest,
  type RoleComponent,
} from "../../src/core";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../src/runtime/config/board_definition";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { GameEventRecorder } from "../../src/runtime/game_event_recorder";
import {
  readReproduction,
  replayReproduction,
} from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/temp_directory";
import {
  permitsCharm,
  activeCharm,
  bindCharm,
} from "../../src/game/mechanisms/roles/wolf_beauty/relation";
import { DREAM_PROTECTION_POLICIES, BEAUTY_DEATH_LINK_POLICIES } from "../../src/core/domain/board";
import { getDreamerState, getWolfBeautyState } from "../../src/game/mechanisms/roles/private_state";
import { getDefaultConfigRenderRegistry, getDefaultRoleCatalog } from "../../src/game/mechanisms";
import {
  projectDreamerState,
  projectWolfBeautyState,
} from "../../src/game/mechanisms/roles/player_state";
import { DamageResolutionSystem } from "../../src/core/domain/systems/damage_resolution_system";
import { captureNightLife } from "../../src/core/domain/night_effects";
import { DreamNightFrame } from "../../src/game/mechanisms/roles/dreamer/night_frame";
import { captureNightAbilityScope } from "../../src/game/mechanisms/roles/ability_scope";
import { allNightAbilities } from "../../src/game/mechanisms/roles/abilities";

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

for (const policy of BEAUTY_DEATH_LINK_POLICIES)
  test(`${policy}: all single/pair causes use explicit suppression and native Hunter attribution`, () => {
    const causes = Object.values(DeathCause);
    for (const sources of [
      [],
      ...causes.map((x) => [x]),
      ...causes.flatMap((x) => causes.map((y) => [x, y])),
    ])
      for (const hunter of [false, true]) {
        const oracle =
          policy === "awa_exile_poison_v1"
            ? !sources.includes(DeathCause.Duel) &&
              !sources.includes(DeathCause.Dream) &&
              sources.some((x) => [DeathCause.Exile, DeathCause.Poison].includes(x))
            : sources.length > 0 &&
              sources.every((x) => x === DeathCause.Exile || (x === DeathCause.Shot && hunter));
        expect(permitsCharm(sources, policy, hunter)).toBe(oracle);
      }
  });

test("policy changes revoke captured dream scope and established charm binding; independent DTOs reject unknown values", () => {
  const roles = [Role.Dreamer, Role.WolfBeauty, Role.Wolf, Role.Hunter, Role.Witch, Role.Villager];
  const game = bootstrapGame(config(roles), { fixedRoles: roles });
  const dreamRole = game.world.getComponent<RoleComponent>(1, COMPONENT.Role)!,
    beautyRole = game.world.getComponent<RoleComponent>(2, COMPONENT.Role)!;
  const ability = allNightAbilities(dreamRole).find((a) => a.kind === "dream")!;
  const scope = captureNightAbilityScope(game.world, 1, ability, 1, () => true)!;
  expect(scope.isEligible()).toBe(true);
  getDreamerState(dreamRole)!.protectionPolicy = "netease_2026_night_immunity_v1";
  expect(scope.isEligible()).toBe(false);
  getWolfBeautyState(beautyRole)!.targetId = 6;
  bindCharm(game.world, 2, 6);
  expect(activeCharm(game.world, 2)).not.toBeNull();
  getWolfBeautyState(beautyRole)!.deathLinkPolicy = "heroes_s7_2017_exile_hunter_v1";
  expect(activeCharm(game.world, 2)).toBeNull();
  expect(
    projectDreamerState({ protectionPolicy: "arbitrary", history: [], secret: 1 }),
  ).not.toHaveProperty("protectionPolicy");
  expect(
    projectWolfBeautyState({ deathLinkPolicy: "arbitrary", history: [], secret: 1 }),
  ).not.toHaveProperty("deathLinkPolicy");
});

for (const policy of DREAM_PROTECTION_POLICIES)
  test(`${policy}: actual frame + compound mechanical failure/black backlash; Dream stays lethal`, () => {
    const roles = [Role.Dreamer, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Villager];
    const game = bootstrapGame(
      { ...config(roles), dreamer: { protectionPolicy: policy } },
      { fixedRoles: roles },
    );
    const actor = captureNightLife(game.world, 1)!,
      target = captureNightLife(game.world, 4)!;
    const frame = new DreamNightFrame([
      {
        actorId: 1,
        targetId: 4,
        day: 1,
        consecutive: false,
        protectionPolicy: policy,
        actorLife: actor.life,
        actorVersion: actor.version,
        targetLife: target.life,
        targetVersion: target.version,
      },
    ]);
    const damage = new DamageResolutionSystem().resolve(game.world, {
      protectedTargets: frame.protectedTargets(game.world),
      immuneNightTargets: frame.immuneNightTargets(game.world),
      blackMarketBacklashes: [{ target, isCurrent: () => true }],
      mechanicalEffects: {
        failures: [{ actorId: 4, target, isCurrent: () => true }],
        shields: [],
        attacks: [],
      },
      consecutiveDeaths: [4],
    });
    expect(damage.deathSources[4]).toEqual(
      policy === "awa_night_damage_v1"
        ? [DeathCause.MechanicalGuardFailure, DeathCause.BlackMarketBacklash, DeathCause.Dream]
        : [DeathCause.Dream],
    );
  });

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
          role = game.world.getComponent<RoleComponent>(holder, COMPONENT.Role)!;
        expect(
          getDefaultRoleCatalog().require(roles[holder - 1]).renderPrompt!(role, locale),
        ).toContain(policy);
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
          boardConfig: normalized,
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

for (const roleId of ["dreamer", "wolf_beauty"] as const)
  test(`${roleId}: defaults, omitted/empty parameters, finite names, reverse config and rejection paths`, () => {
    const roles = [
      Role.Dreamer,
      Role.WolfBeauty,
      Role.Wolf,
      Role.Hunter,
      Role.Witch,
      Role.Villager,
    ];
    const field = roleId === "dreamer" ? "protectionPolicy" : "deathLinkPolicy",
      values = roleId === "dreamer" ? DREAM_PROTECTION_POLICIES : BEAUTY_DEATH_LINK_POLICIES;
    const raw = boardDefinitionFromConfig("historical_schema", config(roles));
    for (const input of [undefined, {}, ...values.map((value) => ({ [field]: value }))]) {
      const candidate = structuredClone(raw);
      delete candidate.roles[roleId];
      if (input !== undefined) candidate.roles[roleId] = input;
      const parsed = parseBoardDefinition(candidate),
        selected = (input as Record<string, string> | undefined)?.[field] ?? values[0];
      expect(parsed.definition.roles[roleId]).toEqual({ [field]: selected });
      expect(
        parseBoardDefinition(boardDefinitionFromConfig("historical_schema", parsed.config)).config,
      ).toEqual(parsed.config);
    }
    for (const bad of [{ [field]: "unverified_v1" }, { selfDream: true }, { immunePoison: false }])
      expect(() =>
        parseBoardDefinition({ ...raw, roles: { ...raw.roles, [roleId]: bad } }),
      ).toThrow("board_config_invalid_field");
    const absent = boardDefinitionFromConfig(
      "absent",
      config([Role.Wolf, Role.Wolf, Role.Hunter, Role.Witch, Role.Villager, Role.Villager]),
    );
    absent.roles[roleId] = { [field]: values[0] };
    expect(() => parseBoardDefinition(absent)).toThrow("board_config_role_parameters_without_role");
  });

import {
  grantNightAbility,
  transferNightAbility,
} from "../../src/game/mechanisms/roles/ability_changes";
for (const policy of DREAM_PROTECTION_POLICIES)
  test(`${policy}: grant and transfer preserve instance policy/counters; receiver native config does not rewrite it`, () => {
    const roles = [Role.Dreamer, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Villager];
    const game = bootstrapGame(
      { ...config(roles), dreamer: { protectionPolicy: "netease_2026_night_immunity_v1" } },
      { fixedRoles: roles },
    );
    const events: import("../../src/core").GameEvent[] = [];
    const gift = grantNightAbility(
      game.world,
      4,
      {
        id: "gift:dream",
        kind: "dream",
        source: { kind: "gift", actorId: 1 },
        state: {
          lastTarget: 6,
          lastDay: 1,
          history: [{ day: 1, targetId: 6 }],
          protectionPolicy: policy,
        },
        startsOnDay: 1,
        maxUses: 3,
      },
      events,
    );
    gift.uses = 1;
    gift.lastUsedDay = 1;
    expect(() =>
      transferNightAbility(game.world, 4, 5, gift.id, "transfer:dream", events, {
        kind: "dream",
        statePolicy: (s) => ({
          ...s,
          protectionPolicy:
            policy === "awa_night_damage_v1"
              ? "netease_2026_night_immunity_v1"
              : "awa_night_damage_v1",
        }),
      }),
    ).toThrow("ability_transfer_resources_changed");
    expect(
      allNightAbilities(game.world.getComponent<RoleComponent>(4, COMPONENT.Role)).find(
        (a) => a.id === gift.id,
      ),
    ).toBe(gift);
    transferNightAbility(game.world, 4, 5, gift.id, "transfer:dream", events, {
      kind: "dream",
      statePolicy: (s) => structuredClone(s),
    });
    const received = allNightAbilities(
      game.world.getComponent<RoleComponent>(5, COMPONENT.Role),
    ).find((a) => a.id === "transfer:dream")!;
    expect(received.state).toEqual(gift.state);
    expect(received.uses).toBe(1);
    expect(received.lastUsedDay).toBe(1);
    expect(received.source).toEqual({ kind: "transfer", actorId: 4, abilityId: gift.id });
    expect(projectDreamerState(received.state).protectionPolicy).toBe(policy);
  });
