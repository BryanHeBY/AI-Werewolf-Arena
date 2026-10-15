/**
 * 单元测试负责第一份实际SDK对局失败Tape的严格格式及受众反例。输入为本地合成SDK原始录制字节，输出完整parser接受／精确篡改拒绝。
 * 该局真实支付魅惑后，后续巡猎遇测试Provider协议错误而失败；不是正常终局，也不作为当前构建sourceHash的strict重执行证据。
 * 新fixture保原字节，不修改原历史fixture或manifest；只读schema/独立账本，不执行模型或恢复库存权限。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
const path = new URL(
  "../../../support/features/awakened-dark-stars/fixtures/choice-paid-patrol-protocol-error.reproduction.json",
  import.meta.url,
);
const load = () => JSON.parse(readFileSync(path, "utf8"));
test("实际已付Charm后续失败Tape仍可归档，原受众不被顶层whitelist误拒", () => {
  const r = parseReproductionRecord(load());
  expect(r.finalized).toBe(true);
  expect(r.checkpoints.at(-1)!.complete).toBe(false);
  expect(r.events.find((e) => e.type === "awakened_charm_chosen")!.audience).toEqual([5]);
  expect(r.decisions.at(-1)!.stage).toBe("awakened_patrol");
  expect(r.decisions.at(-1)!.outcome.kind).toBe("error");
});
for (const audience of [undefined, [], [1], [1, 5], [5, 5]])
  test(`实际私有魅惑拒伪造受众/${JSON.stringify(audience)}`, () => {
    const r = load(),
      e = r.events.find((e: any) => e.type === "awakened_charm_chosen");
    if (audience === undefined) delete e.audience;
    else e.audience = audience;
    expect(() => parseReproductionRecord(r)).toThrow();
  });
test("实际已付Charm不能从失败CP退款或把后续错误补成巡猎空过", () => {
  const r = load(),
    cp = r.checkpoints.at(-1),
    actor = r.metadata.players.find((p: any) => p.role === "awakened_wolf_beauty").id;
  cp.players.find((p: any) => p.id === actor).privateState.awakenedBeauty.choices = [];
  expect(() => parseReproductionRecord(r)).toThrow();
  const p = load(),
    hunter = p.metadata.players.find((p: any) => p.role === "awakened_hunter").id;
  p.checkpoints
    .at(-1)
    .players.find((x: any) => x.id === hunter).privateState.awakenedPatrol.payment = {
    day: 1,
    rootPhase: "night",
    direction: null,
    targetId: null,
  };
  expect(() => parseReproductionRecord(p)).toThrow();
});
