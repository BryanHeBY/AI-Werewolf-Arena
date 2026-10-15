/**
 * 单元测试以字面 owner 选择及无关村民为输入，用精确允许／拒绝事实核对 Noble／Secret Body 共享传输预期的消息私密语义，不创建真实 MCP 会话。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { nobleTransportScenario } from "../../support/features/noble-secret-body/builders/transport-plan";
import {
  assertTransportEvents,
  assertTransportPrompt,
} from "../../support/oracles/transport/observations";
import { Role } from "../../../src/domain/index";
const s = nobleTransportScenario("expiry"),
  noble = s.mapping.get(1)!,
  body = s.mapping.get(5)!,
  victim = s.mapping.get(6)!,
  villager = s.mapping.get(9)!;
const policy = "awa_noble_secret_body_v1";
test("positive own chosen fact passes current shared actual transport checker", () => {
  expect(() =>
    assertTransportEvents(
      Role.NightNoble,
      [
        [
          1,
          "noble_servant_chosen",
          { policy, actorId: noble, day: 2, targetId: victim, contractId: "servant:night:2" },
        ],
      ],
      noble,
    ),
  ).not.toThrow();
});
test("actual wire checker must reject servant target sent to unrelated villager", () => {
  expect(() =>
    assertTransportEvents(
      Role.Villager,
      [
        [
          1,
          "noble_servant_chosen",
          { policy, actorId: noble, day: 2, targetId: victim, contractId: "servant:night:2" },
        ],
      ],
      villager,
    ),
  ).toThrow();
});
test("actual wire checker must reject God contract closure even for Noble owner", () => {
  expect(() =>
    assertTransportEvents(
      Role.NightNoble,
      [
        [
          1,
          "noble_contract_closed",
          {
            policy,
            actorId: noble,
            day: 2,
            targetId: victim,
            contractId: "servant:night:2",
            createdNight: 2,
            expiresNight: 3,
            status: "cleared",
          },
        ],
      ],
      noble,
    ),
  ).toThrow();
});
test("actual wire checker must reject God body spend even for Body owner", () => {
  expect(() =>
    assertTransportEvents(
      Role.AwakenedIdiot,
      [
        [
          1,
          "secret_body_blocked",
          { policy, actorId: body, day: 3, targetId: victim, cause: "servant_expiry" },
        ],
      ],
      body,
    ),
  ).toThrow();
});
test("actual wire checker must reject Body notice delivered to wolf teammate", () => {
  expect(() =>
    assertTransportEvents(
      Role.NightNoble,
      [
        [
          1,
          "secret_body_night_notified",
          {
            policy,
            actorId: body,
            day: 4,
            protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
            lastNotifiedNight: 4,
            lastChoice: { day: 3, targetId: victim },
            resource: "spent",
            publicRevealDay: null,
          },
        ],
      ],
      noble,
    ),
  ).toThrow();
});
test("actual wire checker must reject future own Body notice before its request day", () => {
  expect(() =>
    assertTransportEvents(
      Role.AwakenedIdiot,
      [
        [
          1,
          "secret_body_night_notified",
          {
            policy,
            actorId: body,
            day: 4,
            protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
            lastNotifiedNight: 4,
            lastChoice: { day: 3, targetId: victim },
            resource: "spent",
            publicRevealDay: null,
          },
        ],
      ],
      body,
      undefined,
      { currentDay: 3, currentRequestOrdinal: 1 },
    ),
  ).toThrow();
});
const dayTurn = s.turns.get(body)!.find((t) => t.day === 3 && t.stage === "day_speech")!;
const actorPlan: any = {
  actorId: body,
  role: Role.AwakenedIdiot,
  locale: "en",
  turns: s.turns.get(body),
  ...s.promptAssertions!(body, "en"),
};
const prompt = `[Action prompt] Player ${body},\nCurrent game day: 3.\nstage: Day speech;\nCurrent turn ID: t99`;
test("positive ordinary prompt markers calibrate the shared checker", () => {
  expect(assertTransportPrompt(actorPlan, dayTurn, prompt)).toBe("t99");
});
test("Body daytime prompt must reject raw spent/source details before next-night notice", () => {
  const leaked = `${prompt}\nRaw Secret Body: ${JSON.stringify({ kind: "night_spent", day: 3, targetId: victim, cause: "servant_expiry" })}`;
  expect(() => assertTransportPrompt(actorPlan, dayTurn, leaked)).toThrow();
});
