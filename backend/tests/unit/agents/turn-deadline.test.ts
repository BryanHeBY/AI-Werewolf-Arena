/**
 * 单元测试以可控时钟和微任务检查绝对期限；预期为零回调、原错误身份和拒绝迟到结果。
 * 不访问模型或领域状态，验证同步回退也不能借 setTimeout(0) 的调度空隙跨过截止时间。
 */
import { expect, test, spyOn } from "bun:test";
import {
  awaitBeforeDeadline,
  TurnDeadlineElapsed,
} from "../../../src/agents/runtime/turn-deadline";

test("已经到期的请求不会启动同步回退", async () => {
  let calls = 0;
  await expect(
    awaitBeforeDeadline(async () => {
      calls++;
      return "late";
    }, Date.now() - 1),
  ).rejects.toBeInstanceOf(TurnDeadlineElapsed);
  expect(calls).toBe(0);
});

test("开始微任务前期限耗尽时不调用回退", async () => {
  let clock = 100,
    calls = 0;
  const now = spyOn(Date, "now").mockImplementation(() => clock);
  try {
    const pending = awaitBeforeDeadline(async () => {
      calls++;
      return "late";
    }, 200);
    clock = 200;
    await expect(pending).rejects.toBeInstanceOf(TurnDeadlineElapsed);
    expect(calls).toBe(0);
  } finally {
    now.mockRestore();
  }
});

test("同步回退在时限后兑现也不能成为有效候选", async () => {
  let clock = 100;
  const now = spyOn(Date, "now").mockImplementation(() => clock);
  try {
    await expect(
      awaitBeforeDeadline(async () => {
        clock = 200;
        return "late";
      }, 200),
    ).rejects.toBeInstanceOf(TurnDeadlineElapsed);
  } finally {
    now.mockRestore();
  }
});

test("合法回退按原结果返回，取消及 provider 错误不被期限错误覆盖", async () => {
  expect(await awaitBeforeDeadline(async () => "on-time", Date.now() + 1000)).toBe("on-time");
  const controller = new AbortController(),
    reason = new Error("owner_cancelled");
  controller.abort(reason);
  await expect(
    awaitBeforeDeadline(async () => "unused", Date.now() - 1, controller.signal),
  ).rejects.toBe(reason);
  const failure = new Error("provider_failed");
  await expect(
    awaitBeforeDeadline(async () => {
      throw failure;
    }, Date.now() + 1000),
  ).rejects.toBe(failure);
});
