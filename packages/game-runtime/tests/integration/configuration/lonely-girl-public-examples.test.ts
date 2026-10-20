/**
 * 集成测试负责验证孤独少女两个公开板子文件的解析和普通 N 张牌初始化。
 * 输入为真实 6／12 人公开 JSON；原 policy、人数和 pending 准备状态是字面预期。
 * 实际 Bun.file 读取公开文件并执行 bootstrap；不执行选择窗口、私有配置或付费模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { LONELY_GIRL_POLICY } from "../../../src/features/lonely-girl/state-slot";
import { projectLonelyGirlSetup } from "../../../src/features/lonely-girl/lifecycle";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";

for (const size of [6, 12])
  test(`public ${size}-seat sample parses and initializes the exact normal-N setup`, async () => {
    const json = await Bun.file(
      new URL(
        `../../../../configs.example/boards/awa_netease_lonely_girl_${size}_v1.json`,
        import.meta.url,
      ),
    ).json();
    const { config } = parseBoardDefinition(json);
    expect(config.lonelyGirl?.policy).toBe(LONELY_GIRL_POLICY);
    const g = bootstrapGame(config);
    expect(g.world.entityIds()).toHaveLength(size);
    expect(projectLonelyGirlSetup(g.world)?.status).toBe("pending");
  });
