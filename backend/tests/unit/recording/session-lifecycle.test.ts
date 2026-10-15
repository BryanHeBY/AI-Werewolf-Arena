/**
 * 单元测试验证录制生命周期的串行刷盘、关闭前缀和失败 Promise 复用。
 * 输入为可暂停的内存刷盘和字面错误；预期独立列出开始顺序、同一错误与首次元数据身份。
 * 不使用文件、World 或生产归档生成预期，也不通过等待真实游戏检验生命周期。
 */
import { expect, test } from "bun:test";
import { SessionRecordingLifecycle } from "../../../src/recording/session/lifecycle";
import type { DebugSummaryInput, ReplayFinalizeMeta } from "../../../src/recording/contracts";

const meta: ReplayFinalizeMeta = {
  endedAtIso: "2026-10-13T00:00:00.000Z",
  winner: null,
  finishReason: "literal_stop",
  players: [],
};

test("failed prefix observation does not prevent the remaining serial flush or replace its error", async () => {
  const failure = new Error("literal_prefix_failure"),
    warnings: unknown[] = [],
    order: number[] = [];
  const held = Promise.withResolvers<void>();
  let count = 0;
  const lifecycle = new SessionRecordingLifecycle(
    async () => {
      order.push(++count);
      if (count === 1) throw failure;
      if (count === 2) await held.promise;
    },
    (error) => {
      warnings.push(error);
    },
  );

  await lifecycle.flushNow();
  const second = lifecycle.flushNow(),
    closing = lifecycle.beginClosing(meta),
    joined = lifecycle.flushNow();
  await Promise.resolve();
  expect(order).toEqual([1, 2]);
  expect(warnings).toEqual([failure]);
  expect(lifecycle.isClosing).toBe(true);
  expect(lifecycle.isClosed).toBe(false);
  held.resolve();
  await Promise.all([second, closing, joined]);
  expect(order).toEqual([1, 2, 3]);
  lifecycle.markClosed();
  await lifecycle.flushNow();
  expect(order).toEqual([1, 2, 3]);
});

test("repeated finalization retains the first failed promise and metadata without another publication", async () => {
  const failure = new Error("literal_final_failure");
  const lifecycle = new SessionRecordingLifecycle(
    async () => {},
    () => {},
  );
  let starts = 0;
  const first = lifecycle.finalize(async (): Promise<DebugSummaryInput> => {
    starts++;
    await lifecycle.beginClosing(meta);
    lifecycle.markClosed();
    throw failure;
  });
  const second = lifecycle.finalize(async (): Promise<DebugSummaryInput> => {
    starts++;
    throw new Error("second_publication_must_not_start");
  });
  expect(lifecycle.isClosing).toBe(true);
  expect(second).toBe(first);
  await expect(first).rejects.toBe(failure);
  expect(lifecycle.finalize(() => second)).toBe(first);
  expect(lifecycle.finalMetadata).toBe(meta);
  expect(starts).toBe(1);
});
