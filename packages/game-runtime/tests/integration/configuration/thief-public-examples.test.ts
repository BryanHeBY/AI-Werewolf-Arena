/**
 * 盗贼公开示例集成测试读取原六／十二人板子 JSON，经 JSON／板子解析后，以内部固定 RNG 调用真实 bootstrap。字面断言核对人数、身份总数、盗贼政策、N 名玩家及 N+2 张初始牌；不执行选择窗口、provider 失败 Tape、租约变体或游戏循环。
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/domain";
import { initialThiefDeal } from "../../../src/features/thief/deal";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";

test("public six/twelve Thief examples roundtrip N role parameters and execute actual N+2 initialization", async () => {
  for (const size of [6, 12]) {
    const raw = JSON.parse(
        await fs.readFile(
          path.resolve(process.cwd(), `../configs.example/boards/lui_meme_thief_${size}_v1.json`),
          "utf8",
        ),
      ),
      resolved = parseBoardDefinition(raw),
      g = bootstrapGame(resolved.config, { random: createRandom(`thief-example:${size}`) });
    expect(resolved.config.boardSize).toBe(size);
    expect(resolved.config.roleSetups.reduce((n, row) => n + row.count, 0)).toBe(size);
    expect(resolved.config.thief?.policy).toBe("lui_meme_thief_two_extra_villagers_v1");
    expect(g.playerIds).toHaveLength(size);
    expect(initialThiefDeal(g.world)).toHaveLength(size + 2);
  }
});
