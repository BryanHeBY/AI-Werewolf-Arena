/**
 * 单元测试验证女巫救药接收与原十六条件伤害表的独立死因事实。输入保留原 locale、字面标记／死因表及有界 World／接收／伤害操作；精确拒绝、未消费库存、手写致死来源和标记清理是预期，不运行完整夜晚或模型。
 */
import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  StatusMark,
  DeathCause,
  type ActionRequest,
  type RoleComponent,
  type StatusMarksComponent,
} from "../../../../src/core";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import { getWitchState } from "../../../../src/game/mechanisms/roles/witch/state";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { ActionTurn } from "../../../../src/ai/agents/player/action-turn";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { DamageResolutionSystem } from "../../../../src/core/domain/systems/damage_resolution_system";

const roles12 = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: roles12 });

const role = (world: ReturnType<typeof fixture>["world"], id: number) =>
  world.getComponent(id, COMPONENT.Role)!;

const marks = (world: ReturnType<typeof fixture>["world"], id: number) =>
  world.getComponent(id, COMPONENT.StatusMarks)!;

const request: ActionRequest = {
  actorId: 6,
  phase: Phase.Night,
  allowedTools: ["use_potion"],
  context: {
    day: 1,
    stage: "witch",
    ability_id: "native:potion",
    wolf_target: 9,
    visible_events: [],
    turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
  },
};

const cases: Array<[StatusMark[], DeathCause[]]> = [
  [[], []],
  [[StatusMark.GuardMark], []],
  [[StatusMark.HealMark], []],
  [[StatusMark.WolfKillMark], [DeathCause.WolfKill]],
  [[StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.GuardMark, StatusMark.HealMark], []],
  [[StatusMark.GuardMark, StatusMark.WolfKillMark], []],
  [[StatusMark.HealMark, StatusMark.WolfKillMark], []],
  [[StatusMark.GuardMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.HealMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [
    [StatusMark.WolfKillMark, StatusMark.PoisonMark],
    [DeathCause.Poison, DeathCause.WolfKill],
  ],
  [[StatusMark.GuardMark, StatusMark.HealMark, StatusMark.WolfKillMark], [DeathCause.WolfKill]],
  [[StatusMark.GuardMark, StatusMark.HealMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.GuardMark, StatusMark.WolfKillMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [[StatusMark.HealMark, StatusMark.WolfKillMark, StatusMark.PoisonMark], [DeathCause.Poison]],
  [
    [StatusMark.GuardMark, StatusMark.HealMark, StatusMark.WolfKillMark, StatusMark.PoisonMark],
    [DeathCause.Poison, DeathCause.WolfKill],
  ],
];

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: only the living current marked wolf target is healable; rejected calls keep the turn and resources intact`, () => {
    const { world } = fixture(locale),
      potion = getWitchState(role(world, 6))!,
      receive = new ActionReception(world),
      turn = new ActionTurn(receive, request, "t1");
    marks(world, 9).add(StatusMark.WolfKillMark);
    const before = structuredClone(role(world, 6).privateState);
    for (const target of [999, 10]) {
      expect(
        turn.submit("t1", "use_potion", { target_id: target, potion_type: PotionType.Heal }),
      ).toMatchObject({ ok: false, error: "heal_target" });
      expect(role(world, 6).privateState).toEqual(before);
      expect(turn.action).toBeNull();
    }
    world.getComponent(9, COMPONENT.Alive)!.alive = false;
    expect(
      turn.submit("t1", "use_potion", { target_id: 9, potion_type: PotionType.Heal }),
    ).toMatchObject({ ok: false, error: "heal_target" });
    world.getComponent(9, COMPONENT.Alive)!.alive = true;
    expect(turn.submit("t1", "use_potion", { target_id: 9, potion_type: PotionType.Heal })).toEqual(
      { ok: true, accepted: true, applied: false, action: "use_potion" },
    );
    expect(potion.heal).toBe(1); // Reception never applies or spends.
    marks(world, 9).remove(StatusMark.WolfKillMark);
    expect(
      new ToolGateway().validateAndSanitize(world, 6, turn.action!, {
        phase: Phase.Night,
        day: 1,
        abilityId: "native:potion",
      }),
    ).toMatchObject({ ok: false, error: "heal_target" });
    expect(role(world, 6).privateState).toEqual(before);
    // A forged visible context cannot create a real knife.
    expect(
      receive.validate(request, "use_potion", { target_id: 9, potion_type: PotionType.Heal }),
    ).toMatchObject({ ok: false, error: "heal_target" });
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: all 16 knife/poison/guard/heal combinations retain the independent lethal sources and clear marks`, () => {
    for (const [input, expected] of cases) {
      const { world } = fixture(locale);
      input.forEach((mark) => marks(world, 7).add(mark));
      const result = new DamageResolutionSystem().resolve(world);
      expect(result).toEqual({
        deaths: expected.length ? [7] : [],
        deathSources: expected.length ? { 7: expected } : {},
      });
      expect(marks(world, 7).values()).toEqual([]);
      expect(world.getComponent(7, COMPONENT.Alive)!.alive).toBe(true); // PhaseManager owns death settlement.
    }
  });
