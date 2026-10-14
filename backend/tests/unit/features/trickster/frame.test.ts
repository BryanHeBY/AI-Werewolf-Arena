/**
 * 单元测试：验证诡术师独立 frame 契约。输入为原内存 owner、frame、reader 与受控非法修改；原字面断言、对象身份及拒绝结果为预期，不组装完整对局或模型传输。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  Role,
  Camp,
  WinCondition,
  COMPONENT,
  type RoleComponent,
  type AliveComponent,
} from "../../../../src/core";
import {
  createTricksterState,
  getTricksterState,
} from "../../../../src/game/mechanisms/roles/trickster/state-slot";
import {
  installTricksterBoard,
  beginTricksterNight,
  tricksterChoiceTargets,
  tricksterChoicePending,
  tricksterMayPass,
  commitTricksterExchange,
  cancelTricksterExchange,
  finishTricksterNight,
  resolveTricksterExile,
  abortTricksterNight,
} from "../../../../src/game/mechanisms/roles/trickster/night_frame";
function fixture() {
  const fixedRoles = [
    ...Array.from({ length: 4 }, () => Role.Wolf),
    ...Array.from({ length: 8 }, () => Role.Villager),
  ];
  const { world } = bootstrapGame(
    {
      boardSize: 12,
      hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
      enableSheriff: false,
      winConditions: [WinCondition.SlaughterSide],
      roleSetups: [
        { role: Role.Wolf, count: 4 },
        { role: Role.Villager, count: 8 },
      ],
    },
    { fixedRoles },
  );
  // Isolated frame fixture; production role registration is a later integration step.
  const role = world.getComponent(1, COMPONENT.Role)!;
  role.role = "trickster" as Role;
  (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
    trickster: createTricksterState(),
  };
  installTricksterBoard(world);
  return { world, role };
}
test("trickster frame maps final exile once after completed night", () => {
  const f = fixture();
  expect(beginTricksterNight(f.world, 1)).toBe(1);
  expect(tricksterChoicePending(f.world, 1, 1)).toBe(true);
  commitTricksterExchange(f.world, 1, 1, [2, 6]);
  expect(() => resolveTricksterExile(f.world, 1, 2)).toThrow("trickster_exile_unsettled");
  finishTricksterNight(f.world, 1);
  expect(resolveTricksterExile(f.world, 1, 2)).toEqual({
    requestedId: 2,
    effectiveId: 6,
    missed: false,
  });
  expect(() => resolveTricksterExile(f.world, 1, 2)).toThrow("trickster_exile_unsettled");
  expect(beginTricksterNight(f.world, 2)).toBe(1);
  expect(tricksterChoiceTargets(f.world, 2)).not.toContain(2);
  expect(tricksterChoiceTargets(f.world, 2)).not.toContain(6);
});
test("trickster frame keeps committed mapping after caster death", () => {
  const f = fixture();
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, 1, 1, [2, 6]);
  f.world.getComponent(1, COMPONENT.Alive)!.alive = false;
  finishTricksterNight(f.world, 1);
  expect(resolveTricksterExile(f.world, 1, 2).effectiveId).toBe(6);
  expect(beginTricksterNight(f.world, 2)).toBeNull();
});
test("trickster mapped dead target yields no extra death rather than reverting", () => {
  const f = fixture();
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, 1, 1, [2, 6]);
  f.world.getComponent(6, COMPONENT.Alive)!.alive = false;
  finishTricksterNight(f.world, 1);
  expect(resolveTricksterExile(f.world, 1, 2)).toEqual({
    requestedId: 2,
    effectiveId: 6,
    missed: true,
  });
  expect(f.world.getAliveEntityIds()).toContain(2);
});
test("trickster cancellation preserves consumed numbers", () => {
  const f = fixture();
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, 1, 1, [2, 6]);
  cancelTricksterExchange(f.world, 1);
  finishTricksterNight(f.world, 1);
  expect(resolveTricksterExile(f.world, 1, 2).effectiveId).toBe(2);
  expect(getTricksterState(f.role)!.history).toEqual([{ day: 1, pair: [2, 6] }]);
  beginTricksterNight(f.world, 2);
  expect(tricksterChoiceTargets(f.world, 2)).not.toContain(2);
});
test("trickster rejects second voluntary pass and permits forced exhausted night", () => {
  const f = fixture();
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, 1, 1, null);
  finishTricksterNight(f.world, 1);
  beginTricksterNight(f.world, 2);
  expect(tricksterMayPass(f.world, 2)).toBe(false);
  expect(() => commitTricksterExchange(f.world, 1, 2, null)).toThrow("trickster_consecutive_pass");
  commitTricksterExchange(f.world, 1, 2, [1, 2]);
  finishTricksterNight(f.world, 2);
  for (const id of f.world.entityIds())
    if (id !== 1) f.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  expect(beginTricksterNight(f.world, 3)).toBeNull();
  finishTricksterNight(f.world, 3);
  expect(getTricksterState(f.role)!.history).toHaveLength(2);
});
test("trickster unfinished aborted night cannot yield an exile mapping", () => {
  const f = fixture();
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, 1, 1, [2, 6]);
  abortTricksterNight(f.world);
  expect(() => resolveTricksterExile(f.world, 1, 2)).toThrow();
  expect(() => beginTricksterNight(f.world, 2)).toThrow();
});
test("trickster normal finally cleanup preserves finished day mapping", () => {
  const f = fixture();
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, 1, 1, [2, 6]);
  finishTricksterNight(f.world, 1);
  abortTricksterNight(f.world);
  expect(resolveTricksterExile(f.world, 1, 2).effectiveId).toBe(6);
});
for (const kind of ["state", "role", "revival"] as const)
  test("trickster rejects revoked original " + kind, () => {
    const f = fixture();
    beginTricksterNight(f.world, 1);
    commitTricksterExchange(f.world, 1, 1, [2, 6]);
    finishTricksterNight(f.world, 1);
    if (kind === "state")
      (f.role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
        ...f.role.privateState,
      };
    if (kind === "role") f.role.camp = Camp.Good;
    if (kind === "revival") {
      const life = f.world.getComponent(6, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    expect(() => resolveTricksterExile(f.world, 1, 2)).toThrow("trickster_original_state_revoked");
  });
