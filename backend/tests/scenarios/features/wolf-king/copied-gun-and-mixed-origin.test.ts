/**
 * 狼王白天策略场景验证原生策略不能变成复制枪策略，且混合夜／日来源枪在判胜前完成。
 * 输入为原复制身份和语言矩阵，实际 PM 产生技能、狼刀、自爆及枪击请求。
 * 输出与预期为精确继承策略、请求顺序及终局状态，保留原因果断言；既有由生产生成的检查不升级为独立预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { DeathCause, Phase, Role, PotionType, ActionWindow, WinCondition, Camp, createRandom, type BoardConfig } from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";

const policy = "awa_day_deaths_v1" as const;

for (const copyRole of [Role.MechanicalWolf, Role.AwakenedHiddenWolf])
  test(`native Wolf King config does not become the copied gun policy/${copyRole}`, async () => {
    const deck = [copyRole, Role.Wolf, Role.Hunter, Role.Witch, Role.Guard, Role.Villager];
    const board: BoardConfig = {
      ...sixPlayerMvpConfig,
      selfDestruct: { enabledWindows: [] },
      wolfKing: { deathActionPolicy: policy },
      roleSetups: deck.map((role) => ({ role, count: 1 })),
    };
    const game = bootstrapGame(board, { fixedRoles: deck });
    const knifeNight = copyRole === Role.MechanicalWolf ? 2 : 1;
    const origins: Array<Phase | undefined> = [];
    const provider = {
      async getAction(
        r: import("../../../../src/domain").ActionRequest,
      ): Promise<import("../../../../src/domain").ToolCall | null> {
        const { day, stage } = r.context;
        if (stage === "mechanical_mode")
          return { name: "mechanical_mode", args: { mode: "skill" } };
        if (stage === "mechanical_mimic")
          return day === 1 ? { name: "mimic_role", args: { target_id: 3 } } : null;
        if (stage === "awakened_mimic") return { name: "awakened_mimic", args: { target_id: 3 } };
        if (r.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (r.allowedTools.includes("kill_vote"))
          return {
            name: "kill_vote",
            args: { target_id: day === knifeNight ? 1 : null, abstain: day !== knifeNight },
          };
        if (r.allowedTools.includes("guard"))
          return { name: "guard", args: { target_id: null, abstain: true } };
        if (r.allowedTools.includes("use_potion"))
          return { name: "use_potion", args: { target_id: 4, potion_type: PotionType.None } };
        if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "Words" } };
        if (r.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: null, abstain: true } };
        if (r.allowedTools.includes("shoot")) {
          expect(r.actorId).toBe(1);
          origins.push(r.context.death_phase);
          return { name: "shoot", args: { target_id: 2 } };
        }
        throw new Error("unexpected_copy_policy_turn:" + stage);
      },
    };
    for (let n = 0; n < knifeNight; n++) await game.phaseManager.runSingleCycle(provider);
    expect(origins).toEqual([Phase.Night]);
    expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
    expect(game.phaseManager.getSnapshot().gameOver).toBe(true);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`actual last-wolf mixed night knife and daytime blast finishes both guns before victory/${locale}`, async () => {
    const deck = [
      Role.WhiteWolfKing,
      Role.WolfKing,
      Role.Hunter,
      Role.Seer,
      Role.Witch,
      Role.Villager,
    ];
    const board: BoardConfig = {
      ...sixPlayerMvpConfig,
      enableSheriff: true,
      winConditions: [WinCondition.SlaughterSide],
      wolfKing: { deathActionPolicy: policy },
      hooks: { onDaybreak: false, onPreElection: true, onPreVote: false, onPerSpeechGap: false },
      selfDestruct: { enabledWindows: [ActionWindow.OnPreElection] },
      roleSetups: deck.map((role) => ({ role, count: 1 })),
    };
    const game = bootstrapGame(board, {
      locale,
      fixedRoles: deck,
      random: createRandom("day-king-last-wolf"),
    });
    const origins: Array<[number, Phase | undefined]> = [];
    const snapshot = await game.phaseManager.runSingleCycle(
      {
        async getAction(r) {
          if (r.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (r.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 2, abstain: false } };
          if (r.allowedTools.includes("use_potion"))
            return { name: "use_potion", args: { target_id: 5, potion_type: PotionType.None } };
          if (r.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 1 } };
          if (r.allowedTools.includes("self_destruct_with_target"))
            return {
              name: "self_destruct_with_target",
              args: { reason: "blast", confirm: true, target_id: 2 },
            };
          if (r.allowedTools.includes("self_destruct")) return null;
          if (r.allowedTools.includes("shoot")) {
            expect(game.world.getAliveEntityIds()).not.toContain(1);
            expect(game.world.getAliveEntityIds()).not.toContain(2);
            origins.push([r.actorId, r.context.death_phase]);
            if (r.actorId === 2) {
              expect(new Set(r.context.death_sources)).toEqual(
                new Set([DeathCause.WolfKill, DeathCause.WhiteWolfBlast]),
              );
              return { name: "shoot", args: { target_id: 3 } };
            }
            expect(r.actorId).toBe(3);
            expect(r.context.death_sources).toEqual([DeathCause.Shot]);
            return { name: "shoot", args: { target_id: 4 } };
          }
          throw new Error("unexpected_last_wolf_turn:" + r.context.stage);
        },
      },
      8,
    );
    expect(origins).toEqual([
      [2, Phase.Day],
      [3, Phase.Day],
    ]);
    expect(snapshot.gameOver).toBe(true);
    expect(snapshot.result?.winner).toBe(Camp.Good);
    expect(snapshot.result?.reason).toBe("all_wolves_eliminated");
    expect(game.world.getAliveEntityIds()).toEqual([5, 6]);
    const events = game.phaseManager.getEvents();
    expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
    const king = events.findIndex((e) => e.type === "wolf_king_shot"),
      hunter = events.findIndex((e) => e.type === "hunter_shot"),
      end = events.findIndex((e) => e.type === "game_over");
    expect(king).toBeGreaterThan(0);
    expect(hunter).toBeGreaterThan(king);
    expect(end).toBeGreaterThan(hunter);
  });
