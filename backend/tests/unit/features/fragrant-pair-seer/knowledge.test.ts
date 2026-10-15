/**
 * Fragrant Pair Seer knowledge 单元测试使用既有内存夹具、原回调和显式坏变体，在原生 owner／frame／reader 边界隔离核对。原字面预期、身份快照及拒绝断言为依据，不重新生成；不装配游戏循环、不运行模型或实体传输，保留支持文件、夹具字节、政策及状态。
 */
import { expect, test } from "bun:test";
import {
  freshFragrantKnowledge,
  readFragrantKnowledge,
  knowFragrantWolf,
  knowFragrantNightOpen,
  knowFragrantChoice,
  knowFragrantPublishedDeaths,
} from "../../../../src/features/fragrant-pair-seer/knowledge";
const start = () => knowFragrantWolf(knowFragrantNightOpen(freshFragrantKnowledge(), 1), 10);
test("only published relation-member deaths reveal consumption, with no root or count DTO", () => {
  const a = knowFragrantChoice(start(), 1, [6, 7]);
  expect(knowFragrantPublishedDeaths(a, 1, [3]).used).toBe(false);
  expect(knowFragrantPublishedDeaths(a, 2, [6]).used).toBe(false);
  expect(a.used).toBe(false);
  const b = knowFragrantPublishedDeaths(a, 1, [7]);
  expect(b.used).toBe(true);
  expect(b.activeBinding).toBeNull();
  expect(Object.keys(b)).toEqual([
    "knownWolfId",
    "lastOpenedNight",
    "lastChoice",
    "activeBinding",
    "used",
    "knifeNotices",
  ]);
  expect(readFragrantKnowledge({ ...b, rootId: 7 })).toBeNull();
  expect(readFragrantKnowledge({ ...b, lastChoice: null })).toBeNull();
  expect(readFragrantKnowledge({ ...freshFragrantKnowledge(), used: true })).toBeNull();
  expect(knowFragrantPublishedDeaths(b, 1, [6])).toEqual(b);
  expect(() => knowFragrantChoice(b, 1, [6, 8])).toThrow();
});
test("real next night expires known relation; no public death can trigger old relation", () => {
  const a = knowFragrantChoice(start(), 1, [6, 7]),
    b = knowFragrantNightOpen(a, 2);
  expect(a.activeBinding).not.toBeNull();
  expect(b.activeBinding).toBeNull();
  expect(b.lastChoice).toEqual({ day: 1, pairIds: [6, 7] });
  expect(knowFragrantPublishedDeaths(b, 1, [6]).used).toBe(false);
  expect(knowFragrantChoice(b, 2, null).lastChoice).toEqual({ day: 2, pairIds: null });
  expect(() => knowFragrantNightOpen(b, 2)).toThrow();
  expect(() => knowFragrantNightOpen(b, 1)).toThrow();
});
test("singleton wolf knowledge is historical and rejects duplicate or getter state", () => {
  const s = start();
  expect(knowFragrantPublishedDeaths(s, 1, [10]).knownWolfId).toBe(10);
  expect(readFragrantKnowledge({ ...freshFragrantKnowledge(), knownWolfId: 10 })).toBeNull();
  expect(() => knowFragrantWolf(s, 11)).toThrow();
  expect(readFragrantKnowledge(knowFragrantNightOpen(freshFragrantKnowledge(), 1))).not.toBeNull();
  expect(() =>
    knowFragrantChoice({ ...freshFragrantKnowledge(), knownWolfId: 10 }, 0, [6, 7]),
  ).toThrow();
  let reads = 0;
  const bad = {
    ...s,
    get used() {
      reads++;
      return true;
    },
  };
  expect(readFragrantKnowledge(bad)).toBeNull();
  expect(reads).toBe(0);
});
