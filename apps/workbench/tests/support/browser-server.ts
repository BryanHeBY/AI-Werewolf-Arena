/** 负责浏览器场景的合成服务生命周期；输入独立测试工作区，输出本机端口。退出先停止测试对局，再关闭服务并清理该临时根。 */
import { offlineWorkspace } from "./offline-workspace";
import { installNaturalGame } from "./natural-game";
import path from "node:path";
import { createWorkbench } from "../../src/server/api";
const workspace = await offlineWorkspace();
const natural = await installNaturalGame(workspace);
// 空根场景按测试私有标识隔离；真实应用没有该请求头或临时根分派。
const emptyApplications = new Map<string, ReturnType<typeof createWorkbench>>();
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4319,
  fetch: (request) => {
    const key = request.headers.get("x-awa-test-empty-workspace");
    if (!key || !/^[a-z0-9_-]{1,64}$/.test(key)) return workspace.application.fetch(request);
    let application = emptyApplications.get(key);
    if (!application) {
      const root = path.join(workspace.root, "empty", key);
      application = createWorkbench({
        repository: workspace.repository,
        configs: path.join(root, "configs"),
        records: path.join(root, "record"),
        jobs: path.join(root, "jobs"),
        dist: path.join(workspace.repository, "apps/workbench/dist"),
      });
      emptyApplications.set(key, application);
    }
    return application.fetch(request);
  },
});
const shutdown = async () => {
  for (const run of await workspace.application.sessions.list())
    if (run.canStop) {
      try {
        await workspace.application.sessions.stop(run.sessionId);
      } catch {}
    }
  await server.stop(true);
  await natural.close();
  await workspace.close();
  process.exit(0);
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void shutdown());
console.log(`Offline workbench ${server.url}`);
