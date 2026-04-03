import { appConfig } from "./config";
import { GameFactory } from "./core/GameFactory";
import { GameEngine } from "./core/GameEngine";
import { GameLogger } from "./logger/GameLogger";
import { Broadcaster } from "./broadcaster/Broadcaster";
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
  console.log("AI狼人杀竞技场 - 开始6人AI对战测试游戏");
  console.log("游戏配置:", appConfig.gameConfig);
  console.log("模型配置:", appConfig.modelDefaults.model);
  console.log("=".repeat(60));
  console.log();

  const factory = new GameFactory(
    appConfig.gameConfig,
    appConfig.modelDefaults,
  );
  const players = factory.createPlayers();

  console.log("玩家角色分配:");
  players.forEach((p) => {
    const roleChinese = getRoleChinese(p.role.roleType);
    const factionChinese = getFactionChinese(p.faction);
    console.log(`  玩家 ${p.id}: ${roleChinese} - ${factionChinese}`);
  });
  console.log();

  const logger = new GameLogger(appConfig.gameRecordsDir);
  const broadcaster = new ConsoleBroadcaster();
  const engine = new GameEngine(
    appConfig.gameConfig,
    players,
    logger,
    broadcaster,
  );

  const startTime = Date.now();

  await engine.start();

  console.log();
  console.log("游戏结束");
  const winner = engine.getGameState().winner;
  const winnerChinese = winner === "wolf" ? "狼人阵营" : "好人阵营";
  console.log("最终获胜者:", winnerChinese);
  console.log("游戏时长:", ((Date.now() - startTime) / 1000).toFixed(2) + "秒");
  console.log("游戏完成，日志保存至:", logger.getCurrentFilePath());

  process.exit(0);
}

runTest().catch((error) => {
  console.error("Test failed with error:", error);
  process.exit(1);
});
