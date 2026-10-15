/**
 * 单元测试负责验证贵族／隐秘之躯通知的 reader 与 feed 接受范围。手写合法／不可能 owner 事实及精确拒绝预期保证局部不可能通知不被发表，不调用完整对局或模型。
 */
import { expect, test } from "bun:test";
import { readNobleSecretBodyFact, NOBLE_SECRET_BODY_POLICY } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { nobleSecretBodyTwelveConfig } from "../../../src/rulesets/presets/noble-secret-body-twelve";
import { buildAgentVisibleEvent } from "../../../src/agents/observation/event-feed";
const noble = {
  policy: NOBLE_SECRET_BODY_POLICY,
  actorId: 1,
  day: 3,
  wolfActionPolicy: "standard",
  lastNotifiedNight: 3,
  lastChoice: { day: 2, targetId: 6 },
  contracts: [
    {
      id: "servant:night:2",
      targetId: 6,
      createdNight: 2,
      expiresNight: 3,
      status: { kind: "cleared", day: 2 },
    },
  ],
};
const body = {
  policy: NOBLE_SECRET_BODY_POLICY,
  actorId: 5,
  day: 3,
  protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
  lastNotifiedNight: 3,
  lastChoice: { day: 2, targetId: 6 },
  resource: "spent",
  publicRevealDay: null,
};
const cases: [string, string, any][] = [
  [
    "Noble cannot announce a self-target choice",
    "noble_night_notified",
    { ...noble, lastChoice: { day: 2, targetId: 1 } },
  ],
  [
    "Noble cannot announce a first-night choice",
    "noble_night_notified",
    { ...noble, lastChoice: { day: 1, targetId: null } },
  ],
  [
    "a pending contract cannot remain past its expiry night at a later night-start notice",
    "noble_night_notified",
    {
      ...noble,
      day: 4,
      lastNotifiedNight: 4,
      contracts: [{ ...noble.contracts[0], status: { kind: "pending" } }],
    },
  ],
  [
    "Body cannot be spent in the initial N1 notification before any choice",
    "secret_body_night_notified",
    { ...body, day: 1, lastNotifiedNight: 1, lastChoice: null },
  ],
  [
    "a publicly consumed Body cannot record a new choice after reveal",
    "secret_body_night_notified",
    { ...body, resource: "exile_revealed", publicRevealDay: 1 },
  ],
];
for (const [name, type, payload] of cases)
  test(name, () => expect(readNobleSecretBodyFact(type, payload)).toBeNull());
test("locally impossible owner notice must not be emitted to player feed", () => {
  const config = nobleSecretBodyTwelveConfig(),
    g = bootstrapGame(config, {
      fixedRoles: config.roleSetups.flatMap((r) => Array(r.count).fill(r.role)),
    });
  expect(
    buildAgentVisibleEvent(
      g.world,
      {
        timestamp: 1,
        type: "secret_body_night_notified",
        payload: { ...body, day: 1, lastNotifiedNight: 1, lastChoice: null },
        audience: [5],
      } as any,
      5,
      1,
    ),
  ).toBeNull();
});
