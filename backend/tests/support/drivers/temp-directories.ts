/**
 * 持有文件系统测试夹具目录及清理，保留原前缀、分配与跟踪生命周期。输入为调用方脚本、回调或资源请求，输出为原轨迹、句柄和边界响应；单元／场景预期仍由调用方字面数据给出。迁移不改变驱动所有权、清理或错误政策，不引入计费模型。
 */
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const activeDirectories = new Set<string>();

export async function createTestTempDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(tmpdir(), prefix));
  activeDirectories.add(directory);
  return directory;
}

export async function cleanupTestTempDirectories(): Promise<void> {
  const directories = [...activeDirectories];
  activeDirectories.clear();
  await Promise.all(
    directories.map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
}
