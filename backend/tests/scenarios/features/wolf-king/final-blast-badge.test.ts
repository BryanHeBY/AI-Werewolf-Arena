/**
 * 狼王场景测试：验证最后原生狼王自爆没有枪，先结警徽再发布唯一终局。输入为原双语矩阵、狼王／警长装配与真实 PM 请求；枪缺席、警徽顺序及最终结果为精确预期，不用新规则推导预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Role,
  Phase,
  WinCondition,
  ActionWindow,
  type RoleComponent,
} from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { getWolfKingState } from "../../../../src/features/wolf-king/ports";

const config = {
  ...sixPlayerMvpConfig,
  boardSize: 6,
  winConditions: [WinCondition.SlaughterCity],
  roleSetups: [
    { role: Role.WolfKing, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Seer, count: 1 },
    { role: Role.Wolf, count: 1 },
    { role: Role.Villager, count: 2 },
  ],
};

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(config, {
    locale,
    fixedRoles: [Role.WolfKing, Role.Hunter, Role.Seer, Role.Wolf, Role.Villager, Role.Villager],
  });

const role = (world: ReturnType<typeof fixture>["world"], id: number) =>
  world.getComponent(id, COMPONENT.Role)!;

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a last Wolf King's ordinary self-destruct has no gun and settles its badge before one victory`, async () => {
    const game = bootstrapGame(
      {
        ...config,
        hooks: { ...config.hooks, onPreVote: true },
        selfDestruct: { enabledWindows: [ActionWindow.OnPreVote] },
        enableSheriff: true,
        initialSheriffSeat: 1,
        sheriff: { voteWeight: 2.25 },
        winConditions: [WinCondition.SlaughterSide],
        roleSetups: [
          { role: Role.WolfKing, count: 1 },
          { role: Role.Hunter, count: 1 },
          { role: Role.Seer, count: 1 },
          { role: Role.Villager, count: 3 },
        ],
      },
      {
        locale,
        fixedRoles: [
          Role.WolfKing,
          Role.Hunter,
          Role.Seer,
          Role.Villager,
          Role.Villager,
          Role.Villager,
        ],
      },
    );
    let shots = 0;
    const snapshot = await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("shoot")) {
          shots++;
          throw new Error("self_destruct_cannot_shoot");
        }
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (request.allowedTools.includes("self_destruct"))
          return { name: "self_destruct", args: { reason: "Ordinary blast", confirm: true } };
        throw new Error(`unexpected_stage:${request.context.stage}`);
      },
    });
    expect(shots).toBe(0);
    expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 6]);
    expect(getWolfKingState(role(game.world, 1))?.canShoot).toBe(false);
    expect(game.world.activeDeathActionCount).toBe(0);
    expect(snapshot.result).toEqual({
      winner: Camp.Good,
      reason: "all_wolves_eliminated",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] },
        additional: [],
        winningPlayerIds: [2, 3, 4, 5, 6],
      },
      decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "day_interrupted" },
    });
    const events = game.phaseManager.getEvents();
    expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
    expect(events.filter((event) => event.type === "wolf_king_shot")).toEqual([]);
    expect(
      events
        .filter((event) => event.type === "sheriff_badge_transferred")
        .map((event) => event.payload),
    ).toEqual([{ fromId: 1, toId: 2, reason: "self_destruct" }]);
    expect(events.findIndex((event) => event.type === "sheriff_badge_transferred")).toBeLessThan(
      events.findIndex((event) => event.type === "game_over"),
    );
  });
