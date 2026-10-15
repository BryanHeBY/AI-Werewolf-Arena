/**
 * 单元测试负责扩展传输oracle的独立受众判例；字面输入分别覆盖双方亲传、协助组和God事实。
 * 新oracle不能给旧oracle伪造行动或改真实事件；不启动网络、不执行ACP或生产引擎结算。
 */
import { expect, test } from "bun:test";
import { assertExpansionTransportEvents as verify } from "../../support/oracles/transport/expansion-observations";
const policy = "awa_awakened_witch_v1";
test("真实组内交流与本人隐票可见；同一输入不被适配器改写", () => {
  const events: Array<[number, string, Record<string, unknown>]> = [
      [1, "brew_started", { policy, day: 1, ordinal: 2, targetId: 6, assistantIds: [2, 3] }],
      [2, "brew_discussion", { policy, day: 1, ordinal: 2, actorId: 3, text: "原话 Raw" }],
      [3, "brew_approval", { policy, day: 1, ordinal: 2, actorId: 2, approve: false }],
    ],
    snapshot = structuredClone(events);
  expect(() => verify("wolf", events, 2, undefined, { currentDay: 1 })).not.toThrow();
  expect(events).toEqual(snapshot);
  expect(() => verify("villager", events, 4)).toThrow();
  expect(() => verify("awakened_witch", events, 2)).toThrow();
  const leak = structuredClone(events);
  leak[2]![2].actorId = 3;
  expect(() => verify("wolf", leak, 2)).toThrow();
});
test("亲传双方可读，局外与God过期不可读；源字段不因此统一放宽", () => {
  const e: [number, string, Record<string, unknown>] = [
    1,
    "awakened_claw_bequeathed",
    {
      policy: "awa_awakened_wolf_king_v1",
      day: 1,
      actorId: 4,
      targetId: 2,
      unitId: "awakened_claw:native:1",
      receivedUnitId: "awakened_claw:bequest:4:1:1",
    },
  ];
  expect(() => verify("wolf", [e], 2)).not.toThrow();
  expect(() => verify("awakened_wolf_king", [e], 4)).not.toThrow();
  expect(() => verify("wolf", [e], 3)).toThrow();
  expect(() =>
    verify(
      "wolf",
      [
        [
          1,
          "awakened_claws_expired",
          {
            policy: "awa_awakened_wolf_king_v1",
            day: 1,
            actorId: 2,
            unitIds: ["awakened_claw:native:1"],
          },
        ],
      ],
      2,
    ),
  ).toThrow();
  expect(() => verify("wolf", [[1, "awakened_mimic_fake", { actorId: 3 }]], 2)).toThrow();
});
test("新族God结果、其它人私选与未来事实均拒绝", () => {
  expect(() => verify("warden", [[1, "warden_resolved", {}]], 2)).toThrow();
  expect(() =>
    verify("crow", [[1, "crow_curse_chosen", { actorId: 3, day: 1, targetId: 6 }]], 2),
  ).toThrow();
  expect(() => verify("villager", [[1, "brew_resolved", {}]], 2)).toThrow();
  expect(() =>
    verify("crow", [[1, "crow_curse_chosen", { actorId: 2, day: 2, targetId: 6 }]], 2, undefined, {
      currentDay: 1,
    }),
  ).toThrow();
  expect(() => verify("villager", [[1, "god_private_game_info", {}]], 2)).toThrow();
});
