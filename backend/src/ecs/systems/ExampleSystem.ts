import { GamePhase, Entity } from "../../core/types";
import { BaseSystem } from "../System";
import { GameWorld } from "../World";

/**
 * 示例系统
 * 演示如何使用ECS框架创建游戏系统
 */
export class ExampleSystem extends BaseSystem {
  private updateCount = 0;

  constructor() {
    super("ExampleSystem");
    this.priority = 100; // 低优先级，最后执行
  }

  /**
   * 系统初始化
   */
  initialize(world: GameWorld): void {
    console.log(`[ExampleSystem] 系统初始化完成`);
    console.log(
      `[ExampleSystem] 世界中有 ${world.getEntitiesWithComponent("IdentityComponent").length} 个实体拥有IdentityComponent`,
    );
  }

  /**
   * 更新系统逻辑
   */
  update(phase: GamePhase, entities: Entity[]): void {
    this.updateCount++;

    // 根据游戏阶段执行不同的逻辑
    switch (phase) {
      case GamePhase.NightStart:
        this.handleNightStart(entities);
        break;
      case GamePhase.DayStart:
        this.handleDayStart(entities);
        break;
      default:
        // 其他阶段只记录日志
        console.log(
          `[ExampleSystem] 阶段 ${phase}，实体数量: ${entities.length}`,
        );
    }

    // 每10次更新输出一次统计信息
    if (this.updateCount % 10 === 0) {
      console.log(`[ExampleSystem] 已完成 ${this.updateCount} 次更新`);
    }
  }

  /**
   * 系统清理
   */
  cleanup(world: GameWorld): void {
    console.log(
      `[ExampleSystem] 系统清理，总共执行了 ${this.updateCount} 次更新`,
    );
    this.updateCount = 0;
  }

  /**
   * 处理夜晚开始阶段
   */
  private handleNightStart(entities: Entity[]): void {
    console.log(`[ExampleSystem] 夜晚开始，有 ${entities.length} 个活动实体`);

    // 这里可以添加夜晚特定的逻辑
    // 例如：检查哪些实体需要执行夜晚行动
  }

  /**
   * 处理白天开始阶段
   */
  private handleDayStart(entities: Entity[]): void {
    console.log(`[ExampleSystem] 白天开始，有 ${entities.length} 个活动实体`);

    // 这里可以添加白天特定的逻辑
    // 例如：重置实体状态，准备白天的行动
  }

  /**
   * 自定义方法：统计实体信息
   */
  getStatistics(): { updateCount: number; lastUpdate: Date } {
    return {
      updateCount: this.updateCount,
      lastUpdate: new Date(),
    };
  }
}

/**
 * 日志系统
 * 专门处理游戏日志的系统
 */
export class LoggingSystem extends BaseSystem {
  private logs: string[] = [];
  private readonly maxLogs = 1000;

  constructor() {
    super("LoggingSystem");
    this.priority = 10; // 较高优先级，较早执行
  }

  /**
   * 记录日志
   */
  log(message: string, level: "info" | "warn" | "error" = "info"): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    this.logs.push(logEntry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 控制台输出（根据级别）
    switch (level) {
      case "info":
        console.log(logEntry);
        break;
      case "warn":
        console.warn(logEntry);
        break;
      case "error":
        console.error(logEntry);
        break;
    }
  }

  /**
   * 更新系统逻辑
   */
  update(phase: GamePhase, entities: Entity[]): void {
    // 记录阶段变更
    this.log(`游戏阶段变更为: ${phase}`, "info");

    // 记录实体数量变化
    if (entities.length > 0) {
      this.log(`当前活动实体数量: ${entities.length}`, "info");
    }
  }

  /**
   * 获取所有日志
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * 获取最近N条日志
   */
  getRecentLogs(count: number): string[] {
    return this.logs.slice(-Math.min(count, this.logs.length));
  }

  /**
   * 清空日志
   */
  clearLogs(): void {
    this.logs = [];
    this.log("日志已清空", "info");
  }

  /**
   * 导出日志到文件（模拟）
   */
  exportLogs(): string {
    return this.logs.join("\n");
  }
}

/**
 * 性能监控系统
 * 监控系统性能并提供统计信息
 */
export class PerformanceSystem extends BaseSystem {
  private frameTimes: number[] = [];
  private lastUpdateTime = 0;
  private readonly maxSamples = 100;

  constructor() {
    super("PerformanceSystem");
    this.priority = 1; // 最高优先级，最先执行
    this.dependencies = ["LoggingSystem"]; // 依赖日志系统
  }

  /**
   * 更新系统逻辑
   */
  update(phase: GamePhase, entities: Entity[]): void {
    const now = performance.now();

    // 计算帧时间
    if (this.lastUpdateTime > 0) {
      const frameTime = now - this.lastUpdateTime;
      this.frameTimes.push(frameTime);

      // 限制样本数量
      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes = this.frameTimes.slice(-this.maxSamples);
      }
    }

    this.lastUpdateTime = now;

    // 每50帧输出一次性能报告
    if (this.frameTimes.length % 50 === 0 && this.frameTimes.length > 0) {
      this.reportPerformance();
    }
  }

  /**
   * 报告性能数据
   */
  private reportPerformance(): void {
    if (this.frameTimes.length === 0) return;

    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const maxFrameTime = Math.max(...this.frameTimes);
    const minFrameTime = Math.min(...this.frameTimes);

    console.log(`[PerformanceSystem] 性能报告:`);
    console.log(`  平均帧时间: ${avgFrameTime.toFixed(2)}ms`);
    console.log(`  最大帧时间: ${maxFrameTime.toFixed(2)}ms`);
    console.log(`  最小帧时间: ${minFrameTime.toFixed(2)}ms`);
    console.log(`  帧率: ${(1000 / avgFrameTime).toFixed(2)} FPS`);
    console.log(`  样本数量: ${this.frameTimes.length}`);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    avgFrameTime: number;
    maxFrameTime: number;
    minFrameTime: number;
    fps: number;
    sampleCount: number;
  } {
    if (this.frameTimes.length === 0) {
      return {
        avgFrameTime: 0,
        maxFrameTime: 0,
        minFrameTime: 0,
        fps: 0,
        sampleCount: 0,
      };
    }

    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    return {
      avgFrameTime,
      maxFrameTime: Math.max(...this.frameTimes),
      minFrameTime: Math.min(...this.frameTimes),
      fps: 1000 / avgFrameTime,
      sampleCount: this.frameTimes.length,
    };
  }

  /**
   * 重置性能数据
   */
  resetStats(): void {
    this.frameTimes = [];
    this.lastUpdateTime = 0;
    console.log("[PerformanceSystem] 性能数据已重置");
  }
}
