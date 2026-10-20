/**
 * Noble／Secret Body contract-boundaries 单元测试使用既有内存夹具、原回调和显式坏变体，在原生 owner／frame／reader 边界隔离核对。原字面预期、身份快照及拒绝断言为依据，不重新生成；不装配游戏循环、不运行模型或实体传输，保留支持文件、夹具字节、政策及状态。
 */
import { expect, test } from "bun:test";
import {
  createNobleState,
  chooseServant,
  endServant,
  readNobleState,
} from "../../../../src/features/noble-secret-body/state";
const living = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
for (const terminal of ["expired", "cleared", "target_dead"] as const) {
  const ended = () =>
    endServant(chooseServant(createNobleState(), 2, 6, 1, living), "servant:night:2", 3, terminal);
  for (const target of [7, null])
    test(`N3 ${terminal} rejects same-night ${target === null ? "pass" : "new servant"}`, () => {
      expect(() => chooseServant(ended(), 3, target, 1, living)).toThrow("night_noble_unavailable");
    });
  test(`reader rejects invented N3 pass after ${terminal}`, () => {
    expect(readNobleState({ ...ended(), lastChoice: { day: 3, targetId: null } })).toBeUndefined();
  });
  test(`N4 stays eligible after N3 ${terminal}`, () => {
    const next = chooseServant(ended(), 4, 7, 1, living);
    expect(readNobleState(next)).toEqual(next);
  });
}
