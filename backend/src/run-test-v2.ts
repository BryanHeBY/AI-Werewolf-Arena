import { appConfig } from "./config";
import { GameFactoryV2 } from "./core/GameFactoryV2";
import { GameWorld } from "./ecs/World";
import { GameEngineV2 } from "./core/GameEngineV2";
import { GameLogger } from "./logger/GameLogger";
import { Broadcaster } from "./broadcaster/Broadcaster";
import { IdentityComponent, StatusComponent } from "./core/types";
import { Server } from "socket.io";
import { createServer } from "http";

// 辅助函数：获取角色中文名称
function getRoleChinese(roleType: string): string {
  switch (roleType.toLowerCase()) {
    case "wolf":
      return "狼人";
    case "seer":
      return "预言家";
    case "witch":
      return "女巫";
    case "villager":
      return "村民";
    default:
      return roleType;
  }
}

// 辅助函数：获取阵营中文名称
function getFactionChinese(faction: string): string {
  switch (faction.toLowerCase()) {
    case "wolf":
      return "狼人阵营";
    case "villager":
      return "好人阵营";
    default:
      return faction;
  }
}

// Create a dummy broadcaster that just logs events to console
class ConsoleBroadcaster extends Broadcaster {
  constructor() {
    super(null as any);
  }

  override broadcast(event: any): void {
    // Clean circular references for logging
    const cleanData = JSON.parse(
      JSON.stringify(event.data, (key, value) => {
        if (key === "client") return undefined;
        if (
          key === "role" &&
          typeof value === "object" &&
          "roleType" in value
        ) {
          return { roleType: value.roleType, faction: value.faction };
        }
        return value;
      }),
    );
    console.log(
      `[BROADCAST] ${event.type}:`,
      JSON.stringify(cleanData, null, 2),
    );
    console.log("---");
  }
}

async function runTest() {
  console.log("=".repeat(60));
  console.log("AI狼人杀竞技场 V2 - 开始6人AI对战测试游戏");
  console.log("使用 GameEngineV2 (Phase Stack + ECS + Prompt Pipeline)");
  console.log("游戏配置:", appConfig.gameConfig);
  console.log("模型配置:", appConfig.modelDefaults.model);
  console.log("=".repeat(60));
  console.log();

  const world = new GameWorld();
  const factory = new GameFactoryV2(
    appConfig.gameConfig,
    appConfig.modelDefaults,
    world,
  );
  factory.createPlayers(); // 现在返回void

  // 从World查询玩家信息
  const entities = world.query<{
    IdentityComponent: IdentityComponent;
    StatusComponent: StatusComponent;
  }>("IdentityComponent", "StatusComponent");

  console.log("玩家角色分配 (从ECS World查询):");
  entities.forEach((e: any) => {
    const roleChinese = getRoleChinese(e.IdentityComponent.roleType);
    const factionChinese = getFactionChinese(e.IdentityComponent.faction);
    console.log(
      `  实体 ${e.IdentityComponent.entityId}: ${roleChinese} - ${factionChinese}`,
    );
  });
  console.log();

  const logger = new GameLogger(appConfig.gameRecordsDir);
  const broadcaster = new ConsoleBroadcaster();
  const engine = new GameEngineV2(
    appConfig.gameConfig,
    world, // 传入World而不是players数组
    logger,
    broadcaster,
  );

  const startTime = Date.now();

  await engine.start();

  console.log();
  console.log("游戏结束");
  const gameState = engine.getGameState();
  const winner = gameState.winner;
  const winnerChinese = winner === "wolf" ? "狼人阵营" : "好人阵营";
  console.log("最终获胜者:", winnerChinese);
  console.log("游戏时长:", ((Date.now() - startTime) / 1000).toFixed(2) + "秒");
  console.log("游戏完成，日志保存至:", logger.getCurrentFilePath());

  // 演示机械狼示例
  console.log();
  console.log("=".repeat(60));
  console.log("ECS World已创建，包含", entities.length, "个玩家实体");
  console.log("=".repeat(60));

  process.exit(0);
}

runTest().catch((error) => {
  console.error("Test failed with error:", error);
  console.error("Error stack:", error.stack);
  process.exit(1);
});
