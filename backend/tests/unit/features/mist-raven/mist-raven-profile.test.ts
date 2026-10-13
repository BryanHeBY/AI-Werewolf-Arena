/**
 * 单元测试：验证雾鸦 profile 的默认配置、语言与狼群政策。原双语文案、分离的知识能力和历史 audience 为字面预期；只调用有界模块，不运行模型或完整对局驱动。
 */
import {
  createAliveComponent,
  createCampComponent,
} from "../../../../src/game/observation/component-presentation";
import { captureNativeRolePresentation } from "../../../../src/game/observation/native-role-presentation-capture";
import { expect, test } from "bun:test";
import {
  World,
  Role,
  Camp,
  WinCondition,
  Phase,
  COMPONENT,
  createIdentityComponent,
  type RoleComponent,
  type ToolCall,
} from "../../../../src/core";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { getDreamerState } from "../../../../src/game/mechanisms/roles/dreamer/ports";
import { RoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../src/game/mechanisms/roles/role-catalog-assembly";
import {
  ALCHEMIST_ROLE_PROFILE,
  RAVEN_CLAW_ROLE_PROFILE,
} from "../../../../src/game/mechanisms/roles/mist_raven/profile";
import {
  installMistRavenBoard,
  beginMistNight,
  commitMistChoice,
  handOffMistNight,
  openSnakeWindow,
  commitSnakeChoice,
  closeMistNight,
  ravenAwakened,
} from "../../../../src/game/mechanisms/roles/mist_raven/night_frame";
import {
  knownWolfTeammates,
  wolfChatParticipants,
  wolfKnifeHolders,
  wolfTeamEvent,
} from "../../../../src/game/mechanisms/roles/wolf_team";

function fixture() {
  const catalog = createRoleCatalog({
      contributions: [
        ...getDefaultRoleContributions().filter(
          (p) => p.metadata.role !== Role.Alchemist && p.metadata.role !== Role.RavenClawWolf,
        ),
        ALCHEMIST_ROLE_PROFILE,
        RAVEN_CLAW_ROLE_PROFILE,
      ],
    }),
    world = new World();
  const roles = [
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
  ];
  for (const kind of roles) {
    const id = world.createEntity(),
      role = createRoleComponent(kind, catalog.getCamp(kind));
    catalog.applyRuntime(role, {
      boardConfig: {
        boardSize: 12,
        roleSetups: [...new Set(roles)].map((kind) => ({
          role: kind,
          count: roles.filter((value) => value === kind).length,
        })),
        winConditions: [WinCondition.SlaughterSide],
        enableSheriff: true,
        hooks: { onDaybreak: true, onPreElection: true, onPreVote: true, onPerSpeechGap: true },
        mistRaven: { policy: "awa_mist_raven_v1" },
        dreamer: { protectionPolicy: "netease_2026_night_immunity_v1" },
        seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
      },
    });
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(role.camp));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, id, `Player ${id}`));
  }
  expect(
    getDreamerState(world.getComponent(3, COMPONENT.Role)!)?.protectionPolicy,
  ).toBe("netease_2026_night_immunity_v1");
  installMistRavenBoard(world);
  const rule = (id: number, call: ToolCall, phase = Phase.Night, day = 1) =>
    catalog
      .requireRuntime(world.getComponent(id, COMPONENT.Role)!.role)
      .validationRules?.[call.name]?.({
        world,
        actorId: id,
        role: world.getComponent(id, COMPONENT.Role)!,
        roleCatalog: catalog,
        toolCall: call,
        phase,
        day,
      });
  const kill = (id: number) => {
    world.getComponent(id, COMPONENT.Alive)!.alive = false;
  };
  return { world, catalog, rule, kill };
}
test("original profiles contribute exact defaults and bilingual mechanism meaning", () => {
  for (const profile of [ALCHEMIST_ROLE_PROFILE, RAVEN_CLAW_ROLE_PROFILE]) {
    expect(
      profile.runtime.configuration?.schema.safeParse({ policy: "awa_mist_raven_v1" }).success,
    ).toBe(true);
    expect(profile.runtime.configuration?.schema.safeParse({ policy: "invented" }).success).toBe(
      false,
    );
    expect(profile.runtime.canSelfDestruct).toBe(false);
  }
  const { world } = fixture(),
    alchemist = world.getComponent(1, COMPONENT.Role)!,
    raven = world.getComponent(9, COMPONENT.Role)!;
  expect(
    captureNativeRolePresentation(ALCHEMIST_ROLE_PROFILE.presentation!.id, alchemist, "zh-CN"),
  ).toContain("发言结束");
  expect(
    captureNativeRolePresentation(ALCHEMIST_ROLE_PROFILE.presentation!.id, alchemist, "en"),
  ).toContain("after daytime speeches");
  expect(
    captureNativeRolePresentation(RAVEN_CLAW_ROLE_PROFILE.presentation!.id, raven, "zh-CN"),
  ).toContain("不补发");
  expect(
    captureNativeRolePresentation(RAVEN_CLAW_ROLE_PROFILE.presentation!.id, raven, "en"),
  ).toContain("fewer than three");
});
test("pack recognition, sealed exclusion, permanent snapshot and historical audience are separate", () => {
  const { world, catalog, kill } = fixture();
  expect(knownWolfTeammates(world, 10, catalog)).toEqual([9, 11, 12]);
  expect(knownWolfTeammates(world, 9, catalog)).toEqual([]);
  beginMistNight(world, 1);
  expect(wolfChatParticipants(world, catalog)).toEqual([10, 11, 12]);
  expect(wolfKnifeHolders(world, catalog)).toEqual([10, 11, 12]);
  const old = wolfTeamEvent(world, catalog, {
    timestamp: 1,
    type: "wolf_discussion",
    payload: { actorId: 10, text: "Old", endChat: false, round: 1 },
  });
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, null);
  openSnakeWindow(world, 1, [], () => true);
  commitSnakeChoice(world, 1, 1, null);
  closeMistNight(world, 1);
  kill(11);
  kill(12);
  expect(ravenAwakened(world)).toBe(false);
  beginMistNight(world, 2);
  expect(knownWolfTeammates(world, 9, catalog)).toEqual([10]);
  expect(wolfChatParticipants(world, catalog)).toEqual([9, 10]);
  expect(old.audience).toEqual([10, 11, 12]);
  kill(10);
  expect(knownWolfTeammates(world, 9, catalog)).toEqual([10]);
});
test("ordinary knife tools never confer a blast to the unsealed Raven", () => {
  const { world, catalog, rule, kill } = fixture();
  beginMistNight(world, 1);
  expect(rule(9, { name: "kill_vote", args: { target_id: 5, abstain: false } })).toMatchObject({
    code: "wolf_kill_permission",
  });
  expect(
    rule(9, { name: "self_destruct", args: { reason: "", confirm: true } }, Phase.Day),
  ).toMatchObject({ code: "wolf_blast_only" });
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, null);
  openSnakeWindow(world, 1, [], () => true);
  commitSnakeChoice(world, 1, 1, null);
  closeMistNight(world, 1);
  kill(11);
  kill(12);
  beginMistNight(world, 2);
  expect(wolfKnifeHolders(world, catalog)).toEqual([9, 10]);
  expect(
    rule(9, { name: "self_destruct", args: { reason: "", confirm: true } }, Phase.Day, 2),
  ).toMatchObject({ code: "wolf_blast_only" });
});
test("validators accept explicit passes but reject wrong phases, duplicate mist and false snake targets", () => {
  const { world, rule } = fixture();
  beginMistNight(world, 1);
  expect(rule(1, { name: "cast_mist", args: { target_ids: null } })).toBeNull();
  expect(rule(1, { name: "cast_mist", args: { target_ids: [1, 2, 3] } })).toBeNull();
  expect(rule(1, { name: "cast_mist", args: { target_ids: [1, 1, 2] } })).toMatchObject({
    code: "mist_target",
  });
  expect(rule(1, { name: "cast_mist", args: { target_ids: [1, 2, 3] } }, Phase.Day)).toMatchObject({
    code: "mist_unavailable",
  });
  expect(rule(1, { name: "use_snake", args: { target_id: 5 } }, Phase.Day)).toMatchObject({
    code: "snake_unavailable",
  });
  commitMistChoice(world, 1, null);
  handOffMistNight(world, 1, 5);
  openSnakeWindow(world, 1, [5], () => true);
  expect(rule(1, { name: "use_snake", args: { target_id: null } }, Phase.Day)).toBeNull();
  expect(rule(1, { name: "use_snake", args: { target_id: 5 } }, Phase.Day)).toBeNull();
  expect(rule(1, { name: "use_snake", args: { target_id: 6 } }, Phase.Day)).toMatchObject({
    code: "snake_target",
  });
  expect(rule(1, { name: "use_snake", args: { target_id: 5 } }, Phase.Night)).toMatchObject({
    code: "snake_unavailable",
  });
});
