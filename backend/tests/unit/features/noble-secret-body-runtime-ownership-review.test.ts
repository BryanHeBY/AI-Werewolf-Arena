/**
 * 单元测试：验证贵族／不死之身原生请求与外来组件替换的所有权边界。输入为受控请求和替换样本；委托选择、checkpoint 和租约断言保留原权威失败前缀，不新增资源政策。
 */
import { expect, test, spyOn } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { nobleSecretBodyTwelveConfig } from "../../../src/runtime/scenarios/noble_secret_body_twelve";
import { COMPONENT, Phase, Role, type RoleComponent, World } from "../../../src/domain";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import {
  beginNobleBodyNight,
  openSecretBodyChoice,
  expireServantAtNightEnd,
  closeNobleBodyNight,
  resolveSecretBodyDamage,
  consumeSecretBodyExile,
  checkpointNobleBodyAuthority,
  installNobleBodyAuthority,
  nobleBodyChoiceTargets,
} from "../../../src/game/mechanisms/roles/noble_secret_body/authority";
import {
  createNobleState,
  createSecretBodyState,
} from "../../../src/game/mechanisms/roles/noble_secret_body/state";
import {
  installDemonHunter,
  demonHunterCheckpointPlayers,
  demonHunterAuditPlayer,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import {
  openNobleBodyRequest,
  openNobleBodyRevealRequest,
  commitNobleBodyChoice,
  commitNobleBodyRevealSpeech,
  nobleBodyRequestScope,
  inheritNobleBodyDeadlineRequest,
  closeNobleBodyRequest,
} from "../../../src/game/mechanisms/roles/noble_secret_body/requests";
function game() {
  const config = nobleSecretBodyTwelveConfig();
  return {
    ...bootstrapGame(config, {
      fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    config,
  };
}
function bodyRequest(g: ReturnType<typeof game>) {
  return new GameActionRequestFactory(g.world, [], 1).create({
    actorId: 5,
    phase: Phase.Night,
    stage: "secret_body",
    allowedTools: ["protect_secret_body"],
    requiresAction: true,
    summary: "",
    context: {
      allow_fallback: false,
      action_failure_policy: "error",
      secret_body_candidates: nobleBodyChoiceTargets(g.world, 1, "body"),
    },
  });
}
function readyReveal() {
  const g = game();
  beginNobleBodyNight(g.world, 1, () => true);
  openSecretBodyChoice(g.world, 1).commit(null);
  expireServantAtNightEnd(g.world, 1);
  closeNobleBodyNight(g.world, 1, "normal");
  resolveSecretBodyDamage(g.world, 1, {});
  consumeSecretBodyExile(g.world, 1);
  return g;
}
function revealRequest(g: ReturnType<typeof game>, actorId = 5) {
  return new GameActionRequestFactory(g.world, [], 1).create({
    actorId,
    phase: Phase.Voting,
    stage: "awakened_idiot_reveal_speech",
    allowedTools: ["speak"],
    requiresAction: true,
    summary: "",
    context: { allow_fallback: false, action_failure_policy: "error" },
  });
}

test("baseline native delegated body commit remains visible in complete Demon checkpoint", () => {
  const g = game();
  beginNobleBodyNight(g.world, 1, () => true);
  const r = bodyRequest(g),
    s = openNobleBodyRequest(g.world, 1, "body", r);
  commitNobleBodyChoice(g.world, s, { name: "protect_secret_body", args: { target_id: 6 } });
  expect(
    demonHunterCheckpointPlayers(g.world, true)!.find((p) => p.id === 5)!.privateState.secretBody,
  ).toMatchObject({ lastChoice: { day: 1, targetId: 6 }, body: { kind: "intact" } });
});
for (const kind of ["original-getter", "foreign-state", "foreign-role"] as const)
  test(`failed CP retains canonical delegated choice without reading ${kind}`, () => {
    const g = game();
    beginNobleBodyNight(g.world, 1, () => true);
    openSecretBodyChoice(g.world, 1).commit(6);
    const expected = checkpointNobleBodyAuthority(g.world, true).body,
      role = g.world.getComponent(5, COMPONENT.Role)!;
    let reads = 0;
    const foreign = {
      get body() {
        reads++;
        throw Error("foreign getter");
      },
    };
    if (kind === "original-getter")
      Object.defineProperty(
        (role.privateState as { readonly secretBody?: unknown }).secretBody,
        "body",
        {
          get() {
            reads++;
            throw Error("original getter");
          },
          configurable: true,
        },
      );
    if (kind === "foreign-state")
      (role.privateState as Record<string, unknown>).secretBody = foreign;
    // 保留缺少正常字段且带 getter 的原非法对象；类型断言不运行 getter 或授予角色能力。
    if (kind === "foreign-role")
      g.world.addComponent(5, COMPONENT.Role, {
        get privateState() {
          reads++;
          throw Error("foreign role getter");
        },
      } as unknown as import("../../../src/domain/component-map").ComponentWrite<typeof COMPONENT.Role>);
    expect(() => demonHunterCheckpointPlayers(g.world, true)).toThrow();
    const cp = demonHunterCheckpointPlayers(g.world, false)!;
    expect(cp.find((p) => p.id === 5)!.privateState.secretBody).toEqual(expected);
    expect(demonHunterAuditPlayer(g.world, 5)!.secretBody).toEqual(expected);
    expect(reads).toBe(0);
  });
test("delegation does not adopt another private key or changes to original Witch stock", () => {
  const g = game();
  beginNobleBodyNight(g.world, 1, () => true);
  openSecretBodyChoice(g.world, 1).commit(6);
  const role = g.world.getComponent(5, COMPONENT.Role)!;
  (role.privateState as Record<string, unknown>).foreign = { uses: 0 };
  expect(() => demonHunterCheckpointPlayers(g.world, true)).toThrow();
  expect(
    demonHunterCheckpointPlayers(g.world, false)!.find((p) => p.id === 5)!.privateState,
  ).not.toHaveProperty("foreign");
});
test("deadline aliases share the earliest budget and retain original context binding", () => {
  const g = game();
  beginNobleBodyNight(g.world, 1, () => true);
  const r = bodyRequest(g),
    scope = openNobleBodyRequest(g.world, 1, "body", r);
  const now = Date.now();
  const first = { ...r, deadlineAtMs: now + 2000 },
    second = { ...first, deadlineAtMs: now + 1000 },
    extension = { ...r, deadlineAtMs: now + 3000 };
  inheritNobleBodyDeadlineRequest(r, first);
  inheritNobleBodyDeadlineRequest(first, second);
  inheritNobleBodyDeadlineRequest(r, extension);
  expect(nobleBodyRequestScope(g.world, first)).toBe(scope);
  expect(nobleBodyRequestScope(g.world, second)).toBe(scope);
  expect(nobleBodyRequestScope(g.world, extension)).toBeUndefined();
  expect(nobleBodyRequestScope(new World(), r)).toBeUndefined();
  const nowSpy = spyOn(Date, "now").mockReturnValue(now + 1500);
  try {
    expect(nobleBodyRequestScope(g.world, r)).toBeUndefined();
    expect(nobleBodyRequestScope(g.world, first)).toBeUndefined();
    expect(() =>
      commitNobleBodyChoice(g.world, scope, {
        name: "protect_secret_body",
        args: { target_id: 6 },
      }),
    ).toThrow();
  } finally {
    nowSpy.mockRestore();
  }
  closeNobleBodyRequest(scope);
  expect(checkpointNobleBodyAuthority(g.world, true).body.lastChoice).toBeNull();
});
test("original context substitution revokes its previously authorized deadline alias", () => {
  const g = game();
  beginNobleBodyNight(g.world, 1, () => true);
  const r = bodyRequest(g),
    scope = openNobleBodyRequest(g.world, 1, "body", r),
    alias = { ...r, deadlineAtMs: Date.now() + 2000 };
  inheritNobleBodyDeadlineRequest(r, alias);
  r.context = { ...r.context };
  expect(nobleBodyRequestScope(g.world, alias)).toBeUndefined();
  expect(() =>
    commitNobleBodyChoice(g.world, scope, { name: "protect_secret_body", args: { target_id: 6 } }),
  ).toThrow();
});
test("baseline reveal commits one living speech after a real resource reveal", () => {
  const g = readyReveal(),
    r = revealRequest(g),
    scope = openNobleBodyRevealRequest(g.world, 1, r, () => true);
  expect(
    commitNobleBodyRevealSpeech(g.world, scope, { name: "speak", args: { text: "Alive reveal." } }),
  ).toEqual({ actorId: 5, day: 1, text: "Alive reveal." });
  expect(() =>
    commitNobleBodyRevealSpeech(g.world, scope, { name: "speak", args: { text: "Again" } }),
  ).toThrow();
});
test("wrong reveal actor is rejected before occupying the sole original living speech lease", () => {
  const g = readyReveal();
  expect(() => openNobleBodyRevealRequest(g.world, 1, revealRequest(g, 6), () => true)).toThrow(
    "noble_body_request_unavailable",
  );
  expect(checkpointNobleBodyAuthority(g.world, true).nights[0]!.revealOpened).toBe(false);
  const scope = openNobleBodyRevealRequest(g.world, 1, revealRequest(g), () => true);
  expect(
    commitNobleBodyRevealSpeech(g.world, scope, { name: "speak", args: { text: "Correct owner" } })
      .actorId,
  ).toBe(5);
});
test("Demon installation rejects an existing Noble owner bound to wrong native actor IDs", () => {
  const source = game(),
    world = new World();
  for (const id of source.world.entityIds()) {
    world.createEntity();
    for (const name of Object.values(COMPONENT)) {
      const v = source.world.getComponent(id, name);
      if (v !== undefined) world.addComponent(id, name, v);
    }
  }
  (
    world.getComponent(10, COMPONENT.Role)!.privateState as Record<string, unknown>
  ).noble = createNobleState();
  (
    world.getComponent(6, COMPONENT.Role)!.privateState as Record<string, unknown>
  ).secretBody = createSecretBodyState();
  installNobleBodyAuthority(world, 10, 6);
  expect(() => installDemonHunter(world, source.config)).toThrow();
});
