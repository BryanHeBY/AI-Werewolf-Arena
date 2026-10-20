/**
 * 负责追加式 ANSI JSONL 的分页读取；输入绝对文件与序号，输出本页以及稳定序号游标。
 * 每个文件保存稀疏字节检查点，后续翻页和轮询直接 seek；半行留待下次，文件替换／截断会重建索引。
 * 索引只驻内存，不向录制目录写入派生文件，也不返回未校验的 JSON 扩展字段。
 */
import { promises as fs } from "node:fs";
import type { ConsoleChunk } from "@ai-werewolf-arena/workbench-contract";

interface Checkpoint {
  seq: number;
  offset: number;
}
interface FileIndex {
  identity: string;
  size: number;
  checkpoints: Checkpoint[];
}
export class ConsoleLogReader {
  private files = new Map<string, FileIndex>();
  forget(file: string): void {
    this.files.delete(file);
  }
  async read(file: string, after: number): Promise<{ chunks: ConsoleChunk[]; cursor: number }> {
    const chunks: ConsoleChunk[] = [];
    let handle;
    try {
      handle = await fs.open(file, "r");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { chunks, cursor: after };
      throw error;
    }
    try {
      const stat = await handle.stat();
      const identity = `${stat.dev}:${stat.ino}`;
      let index = this.files.get(file);
      if (!index || index.identity !== identity || stat.size < index.size) {
        index = { identity, size: stat.size, checkpoints: [{ seq: 0, offset: 0 }] };
        this.files.set(file, index);
        // 服务可以长期运行：限制已访问会话的索引数量，淘汰只影响后续首次读取成本。
        if (this.files.size > 128) this.files.delete(this.files.keys().next().value!);
      }
      index.size = stat.size;
      let checkpoint = index.checkpoints[0]!;
      for (const point of index.checkpoints)
        if (point.seq <= after && point.offset >= checkpoint.offset) checkpoint = point;
      let offset = checkpoint.offset,
        consumed = offset,
        seq = checkpoint.seq;
      let pending = Buffer.alloc(0),
        rows = 0;
      const buffer = Buffer.allocUnsafe(65536);
      while (offset < stat.size && chunks.length < 400) {
        const { bytesRead } = await handle.read(
          buffer,
          0,
          Math.min(buffer.length, stat.size - offset),
          offset,
        );
        if (!bytesRead) break;
        offset += bytesRead;
        pending = Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
        let begin = 0,
          split: number;
        while ((split = pending.indexOf(10, begin)) >= 0) {
          const line = pending.subarray(begin, split);
          consumed += split - begin + 1;
          begin = split + 1;
          try {
            const row = JSON.parse(line.toString("utf8"));
            if (
              Number.isSafeInteger(row.seq) &&
              row.seq > seq &&
              typeof row.timestamp === "string" &&
              typeof row.text === "string"
            ) {
              seq = row.seq;
              if (row.seq > after)
                chunks.push({ seq: row.seq, timestamp: row.timestamp, text: row.text });
              rows++;
              if (rows % 400 === 0) index.checkpoints.push({ seq, offset: consumed });
            }
          } catch {
            /* 坏行不占用公开序号；后续完整行仍然可读。 */
          }
          if (chunks.length >= 400) break;
        }
        pending = pending.subarray(begin);
      }
      // EOF 的完整行位置也保存下来；高频轮询不会重读全部已消费日志。
      if (consumed > checkpoint.offset && seq >= after)
        index.checkpoints.push({ seq, offset: consumed });
      index.checkpoints = [
        ...new Map(index.checkpoints.map((point) => [point.seq, point])).values(),
      ];
      return { chunks, cursor: chunks.at(-1)?.seq ?? after };
    } finally {
      await handle.close();
    }
  }
}
