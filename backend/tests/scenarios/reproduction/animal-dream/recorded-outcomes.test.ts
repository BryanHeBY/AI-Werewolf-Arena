/**
 * 复现场景验证动物梦境字面录制对局保留精确夜死及终局存活事实。
 * 输入为原六个场景名、跳过／首夜矩阵，以及声明的 animalGolden 预期表。
 * 输出与预期为检查实际 Record 和重放的字面胜方／存活／夜间断言；现有行动矩阵及归档 fixture 字节不变。
 */
import { expect, test } from "bun:test";
import { recordAnimalLiteral } from "../../../support/features/animal-dream/drivers/recording";
import { animalGolden } from "../../../support/features/animal-dream/oracles/golden";
for (const name of [
  "fox_beauty",
  "cat_badge",
  "puffer_knife",
  "pk",
  "last_chain",
  "full_retaliation",
] as const)
  for (const skip of [false, true])
    for (const first of [false, true])
      test(`Animal real Record and exact Tape ${name}/${skip}/${first}`, async () => {
        const r = await recordAnimalLiteral(name, "en", skip, first),
          expected = animalGolden(name, skip, first);
        expect(r.replay.snapshot.result?.winner).toBe(expected.winner);
        expect(
          r.record.checkpoints
            .at(-1)!
            .players.filter((p) => p.alive)
            .map((p) => p.id),
        ).toEqual(expected.alive);
        expect(
          r.record.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
        ).toEqual(expected.night);
      }, 30000);
