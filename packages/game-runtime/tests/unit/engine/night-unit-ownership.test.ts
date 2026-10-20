/**
 * 单元测试验证实际 prepare 的独立夜身份、Noble 接收方到期消费及旧元数据边界。
 * 输入是内存六席流水线、字面能力行动与原Noble子系统fixture；事件／期限和引用为手写预期。
 * 不运行整局或模型，不用生产规则生成期望，新增身份不出现在原JSON／checkpoint。
 */
import { expect, test } from "bun:test";
import { Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { ToolCall } from "../../../src/domain/actions";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { NightPipeline } from "../../../src/engine/phases/night-pipeline";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { openNightUnit, nightUnitOf } from "../../../src/domain/night-unit";
import {
  NobleNightUnit,
  attachNobleNightReceiver,
  expireNobleNight,
} from "../../../src/features/noble-secret-body/ports";
import {
  expireServantAtNightEnd,
  openSecretBodyChoice,
  openServantChoice,
  snapshotNobleBodyAuthority,
} from "../../../src/features/noble-secret-body/authority";
import { nobleBodyAuthorityFixture } from "../../support/features/noble-secret-body/drivers/authority";

async function executeNight() {
  const { world } = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard],
  });
  const pipeline = new NightPipeline({
    world,
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    events: [],
  });
  return pipeline.execute(
    sixPlayerMvpConfig,
    {
      async getAction(request): Promise<ToolCall | null> {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "wait", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        if (request.allowedTools.includes("guard"))
          return { name: "guard", args: { target_id: 3, abstain: false } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 3 } };
        return null;
      },
    },
    1,
  );
}

test("actual pipeline nights with the same day have distinct identity and unchanged result facts", async () => {
  const a = await executeNight(),
    b = await executeNight();
  expect(a.interrupted).toBe(false);
  expect(b.interrupted).toBe(false);
  expect(nightUnitOf(a)!.day).toBe(1);
  expect(nightUnitOf(a)!.id).not.toBe(nightUnitOf(b)!.id);
  expect(Object.keys(a)).not.toContain("nightUnit");
  expect(JSON.stringify(a)).not.toContain("night_unit");
});

test("Noble handoff expires the original N2 contract in the same bound N3 night", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  const events: GameEvent[] = [],
    night = openNightUnit(3);
  const owner = new NobleNightUnit({ world: f.world, events, recordOpening() {} }, 3, night);
  owner.open(() => true);
  openSecretBodyChoice(f.world, 3).commit(null);
  expect(() => openServantChoice(f.world, 3)).toThrow();
  expect(() => expireServantAtNightEnd(f.world, 3, openNightUnit(3))).toThrow(
    "noble_body_night_unit_mismatch",
  );
  const result = attachNobleNightReceiver({ interrupted: false as const }, owner.receiver);
  owner.transferToManager();
  expect(
    expireNobleNight(
      result,
      () => f.world,
      () => 3,
    ),
  ).toEqual({ contractId: "servant:night:2", targetId: 3, cause: "servant_expiry" });
  expect(snapshotNobleBodyAuthority(f.world).noble.contracts[0]!.status).toEqual({
    kind: "expired",
    day: 3,
  });
  expect(JSON.stringify(snapshotNobleBodyAuthority(f.world))).not.toContain("nightUnit");
});

test("legacy result Proxy and old receiver keep the original two-argument expiry path", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  let reads = 0;
  const proxy = new Proxy(
    {},
    {
      get() {
        reads++;
        throw Error("legacy_symbol_unused");
      },
      getOwnPropertyDescriptor() {
        reads++;
        throw Error("legacy_descriptor_unused");
      },
    },
  );
  expect(nightUnitOf(proxy)).toBeUndefined();
  expect(
    expireNobleNight(
      proxy,
      () => f.world,
      () => 1,
    ),
  ).toBeNull();
  expect(reads).toBe(0);
  const old = nobleBodyAuthorityFixture();
  old.night(1);
  const receiver = {
    abort() {},
    closeNormally() {},
    get expire() {
      reads++;
      throw Error("legacy_expire_unused");
    },
  };
  expect(
    expireNobleNight(
      attachNobleNightReceiver({}, receiver),
      () => old.world,
      () => 1,
    ),
  ).toBeNull();
  expect(reads).toBe(0);
});

test("an explicit owned night from another day is rejected before opening the Noble frame", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  const events: GameEvent[] = [];
  let calls = 0;
  const owner = new NobleNightUnit(
    { world: f.world, events, recordOpening() {} },
    2,
    openNightUnit(3),
  );
  expect(() =>
    owner.open(() => {
      calls++;
      return true;
    }),
  ).toThrow("noble_body_night_unit_day_mismatch");
  expect(calls).toBe(0);
  expect(events).toEqual([]);
  expect(snapshotNobleBodyAuthority(f.world).nights.map((n) => n.day)).toEqual([1]);
});
