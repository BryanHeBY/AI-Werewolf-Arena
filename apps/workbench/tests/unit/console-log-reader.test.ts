/** 测试负责核对服务文件与身份边界；输入独立临时文件或字面数据，输出由手写独立预期断言。
 * 不读取用户配置与认证，不触碰真实录制或 output；字节预算用于验证分页成本。 */
import { test, expect, spyOn } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConsoleLogReader } from "../../src/server/console-log-reader";

test("sequential pages and follow polls read linear bytes, not every prefix again", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-console-index-"));
  const file = path.join(root, "console.jsonl");
  const rows = Array.from({ length: 5000 }, (_, index) =>
    JSON.stringify({
      seq: index + 1,
      timestamp: "2026-01-01",
      text: `中文-${index}-` + "x".repeat(140),
      secret: "must-not-project",
    }),
  );
  await fs.writeFile(file, rows.join("\n") + "\n");
  const size = (await fs.stat(file)).size;
  let bytes = 0;
  const original = fs.open.bind(fs);
  const open = spyOn(fs, "open").mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args);
    const read = handle.read.bind(handle);
    spyOn(handle, "read").mockImplementation((async (
      buffer: Buffer,
      offset: number,
      length: number,
      position: number,
    ) => {
      bytes += length;
      return read(buffer, offset, length, position);
    }) as typeof handle.read);
    return handle;
  });
  try {
    const reader = new ConsoleLogReader();
    let cursor = 0,
      total = 0;
    while (true) {
      const page = await reader.read(file, cursor);
      if (!page.chunks.length) break;
      total += page.chunks.length;
      cursor = page.cursor;
      expect(JSON.stringify(page)).not.toContain("must-not-project");
    }
    expect(total).toBe(5000);
    expect(cursor).toBe(5000);
    expect(bytes).toBeLessThan(size * 3);
    const previous = bytes;
    for (let i = 0; i < 20; i++)
      expect(await reader.read(file, cursor)).toEqual({ chunks: [], cursor });
    expect(bytes).toBe(previous);
    expect((await reader.read(file, 400)).chunks[0]!.seq).toBe(401);
  } finally {
    open.mockRestore();
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("partial UTF-8 rows wait for newline, append resumes and atomic replacement resets the index", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-console-tail-"));
  const file = path.join(root, "console.jsonl");
  try {
    const reader = new ConsoleLogReader();
    await fs.writeFile(file, '{"seq":1,"timestamp":"one","text":"猫');
    expect(await reader.read(file, 0)).toEqual({ chunks: [], cursor: 0 });
    await fs.appendFile(file, '娘"}\n{"seq":2');
    expect(await reader.read(file, 0)).toEqual({
      chunks: [{ seq: 1, timestamp: "one", text: "猫娘" }],
      cursor: 1,
    });
    await fs.appendFile(file, ',"timestamp":"two","text":"done"}\n');
    expect((await reader.read(file, 1)).chunks).toEqual([
      { seq: 2, timestamp: "two", text: "done" },
    ]);
    await fs.writeFile(file + ".replacement", '{"seq":1,"timestamp":"new","text":"new"}\n');
    await fs.rename(file + ".replacement", file);
    expect((await reader.read(file, 0)).chunks).toEqual([
      { seq: 1, timestamp: "new", text: "new" },
    ]);
    await fs.truncate(file, 0);
    expect(await reader.read(file, 0)).toEqual({ chunks: [], cursor: 0 });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
