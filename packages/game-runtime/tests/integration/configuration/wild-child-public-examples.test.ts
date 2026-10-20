/**
 * 配置集成测试：验证野孩子公开示例与原榜样配置。输入为既有公开配置和局部装配；原字面预期及不可变 fixture 检查边界，不调用模型或重写样本。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, COMPONENT, type RoleComponent } from "../../../src/domain";
import { parseBoardDefinition } from "../../../src/app/config/board-definition";

for (const size of [6, 12])
  test(`public ${size}-player finite Wild Child example initializes exactly N cards`, () => {
    const board = parseBoardDefinition(
      JSON.parse(
        readFileSync(
          new URL(
            `../../../../configs.example/boards/awa_lui_meme_wild_child_${size}_v1.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    expect(board.config.wildChild).toEqual({ policy: "awa_lui_meme_wild_child_v1" });
    const g = bootstrapGame(board.config);
    expect(g.world.entityIds()).toHaveLength(size);
    expect(
      g.world
        .entityIds()
        .filter((id) => g.world.getComponent(id, COMPONENT.Role)?.role === Role.WildChild),
    ).toHaveLength(1);
  });
