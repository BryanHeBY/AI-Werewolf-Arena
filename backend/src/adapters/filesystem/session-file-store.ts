/**
 * 负责会话目录的文本／JSON 文件写入。输入为原目录、相对路径和内容；输出原写入 Promise 或严格失败。
 * Store 只执行目录创建与单文件临时写入／rename；初始化时点、文件集合、会话和归档次序仍由录制调用方拥有。
 * 宽写入只捕获编码之后的写入阶段，JSON 编码错误仍传播；严格写入的错误原样交回调用方。
 * 固定同目录 .tmp 不承诺同路径并发隔离或多文件事务，失败不自动删除临时文件，也不补写终档。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import { formatErrorDiagnostic } from "../../utils/error-diagnostic";
import { promises as fs } from "fs";
import path from "path";

/** 构造只保存原目录和语言；不创建目录或读取会话，初始化与终档写入时点归上层录制生命周期。 */
export class ReplayFileStore {
  constructor(
    readonly sessionDir: string,
    private readonly locale: Locale = "zh-CN",
  ) {}

  /** 只在调用方实际调用时递归建立 players 目录；mkdir 错误传播，不在每次写入时隐式初始化。 */
  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.sessionDir, "players"), { recursive: true });
  }

  async writeJson(relativePath: string, data: unknown): Promise<void> {
    // 先求值 write 方法，再编码参数；stringify 在 write 的 catch 外，循环数据等错误仍拒绝本 Promise。
    await this.write(relativePath, JSON.stringify(data, null, 2), "json");
  }

  async writeText(relativePath: string, data: string): Promise<void> {
    await this.write(relativePath, data, "text");
  }

  /** 必需产品文件保原编码与写入错误，不降为可选告警；调用方仍负责聚合失败和终档完整性。 */
  async writeJsonStrict(relativePath: string, data: unknown): Promise<void> {
    await this.writeAtomic(relativePath, JSON.stringify(data, null, 2));
  }

  private async write(relativePath: string, content: string, kind: string): Promise<void> {
    try {
      await this.writeAtomic(relativePath, content);
    } catch (error) {
      // catch 覆盖原 writeAtomic 查找／调用／等待，不覆盖此前 JSON 编码；日志／诊断再次抛错仍传播。
      console.warn(
        `[observability] write_${kind}_failed file=${relativePath} err=${formatErrorDiagnostic(error, this.locale)}`,
      );
    }
  }

  private async writeAtomic(relativePath: string, content: string): Promise<void> {
    const target = path.join(this.sessionDir, relativePath);
    // 单个目标使用固定同目录临时名，先完整 write 再 rename；无唯一临时名、跨文件事务或失败 cleanup。
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, content, "utf-8");
    await fs.rename(temporary, target);
  }
}
