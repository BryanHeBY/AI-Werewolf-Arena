/**
 * 单元测试验证骑士真实阵营决斗、只读接收及有界 provider／actor／target 权限。输入保留原 locale、字面规则／目标修改及受控直接决斗收集／提交；精确库存、无身份泄露、错误身份和陈旧选择拒绝是预期，不推进完整 PhaseManager 周期或记录文件。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  KnightDuelWindow,
  WinCondition,
  COMPONENT,
  DeathCause,
  type RoleComponent,
  type GameEvent,
  type ActionRequest,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getKnightState, setKnightState } from "../../../../src/game/mechanisms/roles/knight/state";
import { commitKnightDuel } from "../../../../src/game/mechanisms/roles/knight/commit";
import { KnightDuelWindow as DuelCollector } from "../../../../src/game/engine/knight_duel_window";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { ActionReception } from "../../../../src/game/gateway/action-reception";
import { RoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { resolveInspection } from "../../../../src/game/mechanisms/roles/inspection";
import { setIdiotState } from "../../../../src/game/mechanisms/roles/idiot/ports";
import { DefaultTargetHintRegistry } from "../../../../src/game/mechanisms/llm/target_hint_registry";

const deck = [Role.Knight, Role.Wolf, Role.WolfKing, Role.Hunter, Role.Villager, Role.Villager];

const board = (window: KnightDuelWindow) => ({
  ...sixPlayerMvpConfig,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [
    { role: Role.Knight, count: 1 },
    { role: Role.Wolf, count: 1 },
    { role: Role.WolfKing, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Villager, count: 2 },
  ],
  knight: { enabledWindows: [window] },
});

const role = (world: ReturnType<typeof bootstrapGame>["world"], id: number) =>
  world.getComponent(id, COMPONENT.Role)!;

const duel = (target_id: number) => ({ name: "duel" as const, args: { target_id, confirm: true } });

const req: ActionRequest = {
  actorId: 1,
  phase: Phase.Day,
  allowedTools: ["duel"],
  context: {
    day: 1,
    stage: KnightDuelWindow.AfterSpeeches,
    duel_window: KnightDuelWindow.AfterSpeeches,
    visible_events: [],
    turn_constraints: {},
  },
};

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: inspection disguise and revealed Idiot immunity neither alter true-camp duels nor leak through target hints`, () => {
    const { world } = bootstrapGame(
      {
        ...board(KnightDuelWindow.AfterSpeeches),
        roleSetups: [
          { role: Role.Knight, count: 1 },
          { role: Role.Wolf, count: 1 },
          { role: Role.Seer, count: 1 },
          { role: Role.Idiot, count: 1 },
          { role: Role.Villager, count: 2 },
        ],
      },
      {
        locale,
        fixedRoles: [Role.Knight, Role.Wolf, Role.Seer, Role.Idiot, Role.Villager, Role.Villager],
      },
    );
    const defaultCatalog = getDefaultRoleCatalog(),
      catalog = createRoleCatalog({
        contributions: getDefaultRoleContributions().map((profile) =>
          profile.metadata.role === Role.Wolf
            ? { ...profile, runtime: { ...profile.runtime, inspectionLabels: { camp: Camp.Good } } }
            : profile,
        ),
      });
    expect(resolveInspection(world, 2, "camp", catalog)).toEqual({ kind: "camp", camp: Camp.Good });
    setIdiotState(role(world, 4), { revealed: true });
    expect(catalog.participation(role(world, 4)).canBeExiled).toBe(false);
    const hint = new DefaultTargetHintRegistry().buildActionableIdsHint({
      actorId: 1,
      actorRole: Role.Knight,
      allowedTools: ["duel"],
      world,
      roleCatalog: catalog,
    });
    expect(hint).toContain("2, 3, 4, 5, 6");
    expect(new ActionReception(world).validate(req, "duel", duel(4).args).ok).toBe(true);
    const events: GameEvent[] = [];
    expect(commitKnightDuel(world, { actorId: 1, targetId: 2 }, Phase.Day, events)).toEqual({
      deaths: [2],
      sources: { 2: [DeathCause.Duel] },
      endsDay: true,
    });
    expect(events[0].payload).toEqual({ actorId: 1, targetId: 2, result: "wolf" });
    const other = bootstrapGame(
      {
        ...board(KnightDuelWindow.AfterSpeeches),
        roleSetups: [
          { role: Role.Knight, count: 1 },
          { role: Role.Wolf, count: 1 },
          { role: Role.Seer, count: 1 },
          { role: Role.Idiot, count: 1 },
          { role: Role.Villager, count: 2 },
        ],
      },
      {
        locale,
        fixedRoles: [Role.Knight, Role.Wolf, Role.Seer, Role.Idiot, Role.Villager, Role.Villager],
      },
    );
    setIdiotState(role(other.world, 4), { revealed: true });
    expect(commitKnightDuel(other.world, { actorId: 1, targetId: 4 }, Phase.Day, [])).toEqual({
      deaths: [1],
      sources: { 1: [DeathCause.DuelFailure] },
      endsDay: false,
    });
  });

test("an optional duel provider failure propagates unchanged and consumes no resource or public fact", async () => {
  const config = board(KnightDuelWindow.AfterSpeeches),
    { world } = bootstrapGame(config, { fixedRoles: deck }),
    events: GameEvent[] = [],
    fault = new Error("original_duel_failure");
  let commits = 0;
  await expect(
    new DuelCollector(world, new ToolGateway()).execute(
      config,
      new GameActionRequestFactory(world, events, 1),
      {
        async getAction() {
          throw fault;
        },
      },
      KnightDuelWindow.AfterSpeeches,
      () => true,
      async () => {
        commits++;
        return "night";
      },
    ),
  ).rejects.toBe(fault);
  expect(commits).toBe(0);
  expect(getKnightState(role(world, 1))?.canDuel).toBe(true);
  expect(events).toEqual([]);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: strict readonly duel receipt and true-camp commit hide non-wolf third-party identity`, () => {
    const { world } = bootstrapGame(board(KnightDuelWindow.AfterSpeeches), {
        locale,
        fixedRoles: deck,
      }),
      receive = new ActionReception(world);
    expect(receive.validate(req, "duel", duel(2).args).ok).toBe(true);
    for (const target of [1, 999, 3.5])
      expect(receive.validate(req, "duel", duel(target).args)).toMatchObject({
        ok: false,
        error: "knight_duel_target",
      });
    expect(receive.validate(req, "duel", { target_id: 2, confirm: "true" }).ok).toBe(false);
    expect(receive.validate(req, "duel", { target_id: null, confirm: true }).ok).toBe(false);
    expect(receive.validate({ ...req, phase: Phase.Night }, "duel", duel(2).args)).toMatchObject({
      ok: false,
      error: "knight_duel_window",
    });
    expect(
      receive.validate(
        { ...req, context: { ...req.context, duel_window: undefined } },
        "duel",
        duel(2).args,
      ).ok,
    ).toBe(false);
    expect(
      receive.validate(
        { ...req, context: { ...req.context, stage: "day_speech" } },
        "duel",
        duel(2).args,
      ).ok,
    ).toBe(false);
    expect(receive.validate({ ...req, actorId: 4 }, "duel", duel(2).args).ok).toBe(false);
    expect(getKnightState(role(world, 1))).toEqual({ canDuel: true });
    role(world, 4).camp = Camp.ThirdParty;
    const events: GameEvent[] = [];
    expect(commitKnightDuel(world, { actorId: 1, targetId: 4 }, Phase.Day, events)).toEqual({
      deaths: [1],
      sources: { 1: [DeathCause.DuelFailure] },
      endsDay: false,
    });
    expect(events).toEqual([
      {
        timestamp: expect.any(Number),
        type: "knight_duel",
        payload: { actorId: 1, targetId: 4, result: "not_wolf" },
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("third_party");
    expect(getKnightState(role(world, 1))).toEqual({ canDuel: false });
    expect(world.getAliveEntityIds()).toHaveLength(6);
    expect(commitKnightDuel(world, { actorId: 1, targetId: 2 }, Phase.Day, events)).toBeNull();
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: multiple Knights use the smallest eligible actor and discard role/resource/target-life changes without spending others`, async () => {
    const fixed = [Role.Knight, Role.Knight, Role.Wolf, Role.Seer, Role.Villager, Role.Villager],
      config = {
        ...board(KnightDuelWindow.AfterSpeeches),
        roleSetups: [
          { role: Role.Knight, count: 2 },
          { role: Role.Wolf, count: 1 },
          { role: Role.Seer, count: 1 },
          { role: Role.Villager, count: 2 },
        ],
      };
    for (const mode of ["normal", "resource", "target", "role", "phase"] as const) {
      const { world } = bootstrapGame(config, { locale, fixedRoles: fixed }),
        events: GameEvent[] = [],
        original = getKnightState(role(world, 1))!;
      let current = true,
        commits = 0;
      const result = await new DuelCollector(world, new ToolGateway()).execute(
        config,
        new GameActionRequestFactory(world, events, 1),
        {
          async getAction(request) {
            if (request.actorId === 2) {
              if (mode === "resource") setKnightState(role(world, 1), { canDuel: true });
              if (mode === "target") {
                const life = world.getComponent(3, COMPONENT.Alive)!;
                life.alive = false;
                life.alive = true;
              }
              if (mode === "role") role(world, 1).role = Role.Villager;
              if (mode === "phase") current = false;
            }
            return duel(3);
          },
        },
        KnightDuelWindow.AfterSpeeches,
        () => current,
        async (choice) => {
          commits++;
          expect(commitKnightDuel(world, choice, Phase.Day, events)).not.toBeNull();
          return "night";
        },
      );
      expect(commits).toBe(mode === "target" || mode === "phase" ? 0 : 1);
      expect(result.selection?.actorId ?? null).toBe(
        mode === "target" || mode === "phase" ? null : mode === "normal" ? 1 : 2,
      );
      expect(original.canDuel).toBe(mode !== "normal");
      if (mode === "normal") expect(getKnightState(role(world, 2))?.canDuel).toBe(true);
    }
  });
