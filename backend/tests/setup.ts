/**
 * 后端测试预加载持有测试局部 mock 重置及受跟踪临时目录清理；输入为 Bun 的每测试／全部结束 hook 与原共享目录 owner。输出为 console／Jest mock 重置及等待目录清理，保留原 hook 顺序和十秒默认超时；这不是夹具或规则预期检查器。不改变生产模块、回调政策、归档输入或游戏结果预期。
 */
// AI-Werewolf-Arena 后端测试预加载文件。
// 此文件在每个测试文件之前执行。

import { afterAll, afterEach, beforeEach, jest } from "bun:test";
import { cleanupTestTempDirectories } from "./support/drivers/temp-directories";

// 全局测试超时。
jest.setTimeout(10000);

// 模拟 console 方法，减少测试输出噪声。
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// 每个测试之前重置全部 mock。
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanupTestTempDirectories();
});

// 所有测试结束后清理。
afterAll(() => {
  jest.restoreAllMocks();
});
