/**
 * 单元测试负责 Promise 档案处理器的 getter 查找时点与 parser 原接收方；输入为字面 JSON 和可暂停的 then 接收器。
 * 输出由手写完整 trace、原文及局部序号核对；兑现前替换 JSON.parse 不得影响已捕获函数。
 * 使用实际 test-support 工厂，不加载完整脚本对局或文件／模型，不用生产派生结果生成预期。
 */
import { expect, test } from "bun:test";
import { mapPlayerArchive } from "../../support/drivers/recording/player-archive-handler";

test("then captures parser lookup before settlement and invokes it with the original bare receiver", () => {
  const trace: string[] = [],
    descriptor = Object.getOwnPropertyDescriptor(JSON, "parse")!;
  let handler!: ReturnType<typeof mapPlayerArchive>;
  const raw =
    '{"schemaVersion":2,"player_id":1,"role":"seer","camp":"good","timeline":[],"initial_prompt":{"day":1,"phase":"night","stage":"seer","request_id":"literal","prompt_system":"原文 / Original"}}';
  const parser = function (this: unknown, text: string) {
    trace.push(this === undefined ? "parser:bare" : "parser:bound");
    return descriptor.value(text);
  };
  const pending = {
    get then() {
      trace.push("lookup:then");
      return function (next: ReturnType<typeof mapPlayerArchive>) {
        trace.push("invoke:then");
        handler = next;
      };
    },
  };
  const read = () => {
    trace.push("readFile");
    return pending;
  };
  let result: ReturnType<ReturnType<typeof mapPlayerArchive>>;
  try {
    Object.defineProperty(JSON, "parse", {
      configurable: true,
      get() {
        trace.push("lookup:parse");
        return parser;
      },
    });
    read().then(mapPlayerArchive(JSON.parse));
    Object.defineProperty(JSON, "parse", {
      configurable: true,
      value: () => {
        throw new Error("late_parser_must_not_run");
      },
    });
    trace.push("settle");
    result = handler(raw);
  } finally {
    Object.defineProperty(JSON, "parse", descriptor);
  }
  expect(trace).toEqual([
    "readFile",
    "lookup:then",
    "lookup:parse",
    "invoke:then",
    "settle",
    "parser:bare",
  ]);
  expect(result.initial_prompt!.prompt_system).toBe("原文 / Original");
  expect(result.player_id).toBe(1);
});
