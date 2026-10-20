/**
 * 负责离线工作台测试的独立文件根和合成 HTTP 模型；输入仓库示例，输出本机配置、服务和清理命令。
 * 仅使用固定假认证，不读取 configs／record／output；预期由各测试独立断言，模型不访问外部网络。
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWorkbench } from "../../src/server/api";
export async function offlineWorkspace() {
  const repository = path.resolve(import.meta.dir, "../../../.."),
    root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-test-"));
  let delay = false,
    requests = 0;
  const model = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests++;
      if (delay) await new Promise((resolve) => setTimeout(resolve, 500));
      const input = (await request.json()) as { model: string };
      return Response.json({
        id: "offline",
        object: "chat.completion",
        created: 0,
        model: input.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Local synthetic turn." },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
  });
  const configs = path.join(root, "configs"),
    records = path.join(root, "record"),
    jobs = path.join(root, "jobs");
  await fs.mkdir(path.join(configs, "runtime"), { recursive: true });
  await fs.mkdir(path.join(configs, "boards"));
  await fs.mkdir(path.join(configs, "games"));
  await fs.copyFile(
    path.join(repository, "configs.example/boards/six_player_mvp.json"),
    path.join(configs, "boards/six_player_mvp.json"),
  );
  await fs.writeFile(
    path.join(configs, "runtime/backends.json"),
    JSON.stringify({
      schemaVersion: 2,
      items: {
        offline: {
          kind: "llm",
          config: {
            type: "openai",
            apiKey: "synthetic-test-only",
            baseURL: `http://127.0.0.1:${model.port}/v1`,
          },
        },
      },
    }),
  );
  await fs.writeFile(
    path.join(configs, "runtime/agents.json"),
    JSON.stringify({
      schemaVersion: 2,
      default: "offline",
      items: {
        offline: { backend: "offline", options: { model: "offline-model", maxTokens: 128 } },
      },
    }),
  );
  await fs.writeFile(
    path.join(configs, "games/offline_game.json"),
    JSON.stringify({
      board: "six_player_mvp",
      agent: "offline",
      maxDays: 1,
      maxRuntimeMs: 4000,
      llmTimeoutMs: 1000,
      streamEvents: true,
      printThinking: true,
      seed: "workbench-offline",
    }),
  );
  const application = createWorkbench({
    repository,
    configs,
    records,
    jobs,
    dist: path.join(repository, "apps/workbench/dist"),
  });
  return {
    root,
    repository,
    configs,
    records,
    jobs,
    application,
    model,
    slow: () => {
      delay = true;
    },
    requestCount: () => requests,
    async close() {
      await model.stop(true);
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
export async function eventually<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  timeout = 15000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  let last: T;
  do {
    last = await read();
    if (accept(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 80));
  } while (Date.now() < deadline);
  throw new Error(`offline_condition_timeout:${JSON.stringify(last!)}`);
}
