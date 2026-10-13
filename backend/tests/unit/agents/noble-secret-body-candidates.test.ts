/**
 * 单元测试验证贵族／秘体受限策略只消费观察 DTO 的显式候选和已知队友。输入为手写 request、
 * 连续夜限制与自己的知识；原目标 ID／空选择断言为独立 oracle，不回读原体状态或运行完整对局。
 * 不调用模型或物理传输，保留原自保资格、可选已知队友和失败输入。
 */
import { expect, test } from "bun:test";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import type { BotStyle } from "../../../src/ai/agents/providers/observed_bot";
import type { PlayerObservation } from "../../../src/game/observation/player-observation";
import { Phase } from "../../../src/core";

function dto(
  tool: "choose_servant" | "protect_secret_body",
  candidates?: readonly number[],
  team: number[] = [],
) {
  const key = tool === "choose_servant" ? "servant_candidates" : "secret_body_candidates";
  const ownState = {};
  for (const field of ["secretBody", "nightNoble", "privateState", "actualStock"]) {
    Object.defineProperty(ownState, field, {
      get() {
        throw Error("BOT_READ_PRIVATE_OR_UNUSED_STATE");
      },
    });
  }
  return {
    request: {
      actorId: 5,
      phase: Phase.Night,
      allowedTools: [tool],
      context: {
        day: 2,
        stage: tool === "choose_servant" ? "night_noble" : "secret_body",
        visible_events: [],
        ...(candidates === undefined ? {} : { [key]: Object.freeze([...candidates]) }),
      },
    },
    identity: {},
    knownAliveIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    teammateIds: team,
    abilities: [],
    deathAbilities: [],
    ownNightActions: [],
    ownState,
  } as unknown as PlayerObservation;
}
async function decide(
  tool: "choose_servant" | "protect_secret_body",
  style: BotStyle,
  candidates?: readonly number[],
  team: number[] = [],
  draw = 0.9,
) {
  return new ObservedBot({ next: () => draw }, style).decide(dto(tool, candidates, team));
}
for (const tool of ["choose_servant", "protect_secret_body"] as const)
  for (const style of ["active", "conservative", "competitive", "random"] as const)
    test(`${tool}/${style}: unknown or empty candidate list does not fall back to known alive players`, async () => {
      expect(await decide(tool, style)).toEqual({ name: tool, args: { target_id: null } });
      expect(await decide(tool, style, [])).toEqual({ name: tool, args: { target_id: null } });
    });

test("Body competitive: self wins only when explicitly eligible", async () => {
  expect(await decide("protect_secret_body", "competitive", [6, 5, 7])).toEqual({
    name: "protect_secret_body",
    args: { target_id: 5 },
  });
  expect(await decide("protect_secret_body", "competitive", [6, 7], [], 0)).toEqual({
    name: "protect_secret_body",
    args: { target_id: 6 },
  });
});
test("Body competitive: consecutive-night exclusion is delegated to the DTO, without rereading lastChoice", async () => {
  const bot = new ObservedBot({ next: () => 0 }, "competitive");
  expect(await bot.decide(dto("protect_secret_body", [5, 6]))).toEqual({
    name: "protect_secret_body",
    args: { target_id: 5 },
  });
  expect(await bot.decide(dto("protect_secret_body", [6]))).toEqual({
    name: "protect_secret_body",
    args: { target_id: 6 },
  });
  expect(await bot.decide(dto("protect_secret_body", [5, 6]))).toEqual({
    name: "protect_secret_body",
    args: { target_id: 5 },
  });
});
test("Noble competitive: filters known teammates but invents no target if all candidates are teammates", async () => {
  expect(await decide("choose_servant", "competitive", [2, 3, 6], [2, 3], 0)).toEqual({
    name: "choose_servant",
    args: { target_id: 6 },
  });
  expect(await decide("choose_servant", "competitive", [2, 3], [2, 3], 0)).toEqual({
    name: "choose_servant",
    args: { target_id: null },
  });
});
test("Noble active can legally choose a known teammate because that remains an allowed contract", async () => {
  expect(await decide("choose_servant", "active", [2], [2], 0)).toEqual({
    name: "choose_servant",
    args: { target_id: 2 },
  });
});
for (const tool of ["choose_servant", "protect_secret_body"] as const)
  test(`${tool}: conservative pass and random select/pass stay inside candidate authorization`, async () => {
    expect(await decide(tool, "conservative", [6])).toEqual({
      name: tool,
      args: { target_id: null },
    });
    expect(await decide(tool, "random", [6], [], 0)).toEqual({
      name: tool,
      args: { target_id: null },
    });
    expect(await decide(tool, "random", [6], [], 0.9)).toEqual({
      name: tool,
      args: { target_id: 6 },
    });
  });
